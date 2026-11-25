import { RequestHandler } from 'express';
import { isValidObjectId } from 'mongoose';
import HandleAsyncError from '../../middleware/handleAsyncError';
import ErrorHandler from '../../utils/errorHandler';
import Client from '../client/clientModel';
import { ClientPayment } from './clientPaymentModel';
import ApiFeatures from '../../utils/apiFeatures';
import { MONTH_REGEX, toMonthKey, monthRange } from '../../utils/dateUtils';
import { uploadBufferToCloudinary } from '../../utils/cloudinary';
import { v2 as cloudinary } from 'cloudinary';

export const addClientPayment: RequestHandler = HandleAsyncError(
  async (req, res, next) => {
    const { clientId } = req.params;
    const {
      monthYear,
      amountPaid,
      paymentType,
      paymentDate,
      category,
      note,
    } = req.body;

    if (!isValidObjectId(clientId)) {
      return next(new ErrorHandler('Invalid client id', 400));
    }

    const client = await Client.findById(clientId);
    if (!client) {
      return next(new ErrorHandler('Client not found', 404));
    }

    const amount = Number(amountPaid);
    if (!Number.isFinite(amount) || amount <= 0) {
      return next(new ErrorHandler('Payment amount must be greater than 0', 400));
    }

    const paymentCategory =
      category === 'influencer_expense' || category === 'fuel_expense'
        ? category
        : 'client_amount';

    const cleanNote = typeof note === 'string' ? note.trim() : '';

    let paymentScreenshotUrl: string | undefined;
    let cloudinaryPublicId: string | undefined;

    if (req.file) {
      const cloudinaryResponse = await uploadBufferToCloudinary(
        req.file.buffer,
        'apex_client_payments'
      );
      paymentScreenshotUrl = cloudinaryResponse.secure_url;
      cloudinaryPublicId = cloudinaryResponse.public_id;
    }

    if (client.type === 'one_time') {
      const resolvedMonth =
        typeof monthYear === 'string' && monthYear.trim()
          ? monthYear.trim()
          : toMonthKey(paymentDate ? new Date(paymentDate) : new Date());

      const payment = await ClientPayment.create({
        clientId: client._id,
        monthYear: resolvedMonth,
        category: paymentCategory,
        amountPaid: amount,
        remainingBalance: 0,
        paymentType: paymentType || 'bank_transfer',
        paymentScreenshotUrl,
        cloudinaryPublicId,
        paymentDate: paymentDate || undefined,
        note: cleanNote,
        status: 'paid',
      });

      return res.status(201).json({
        success: true,
        message: 'Payment recorded successfully',
        data: payment,
      });
    }

    const contractAmount = client.monthlyContractAmount;
    if (!contractAmount || contractAmount <= 0) {
      return next(
        new ErrorHandler('This retainer client has no valid monthly contract amount', 400)
      );
    }

    if (typeof monthYear !== 'string' || !MONTH_REGEX.test(monthYear)) {
      return next(new ErrorHandler('monthYear must look like 2026-10', 400));
    }

    const [row] = await ClientPayment.aggregate<{
      contractPaid: number;
      allPaid: number;
    }>([
      { $match: { clientId: client._id, monthYear } },
      {
        $group: {
          _id: null,
          contractPaid: {
            $sum: {
              $cond: [{ $eq: ['$category', 'client_amount'] }, '$amountPaid', 0],
            },
          },
          allPaid: { $sum: '$amountPaid' },
        },
      },
    ]);

    const contractPaidBefore = row?.contractPaid ?? 0;
    const allPaidBefore = row?.allPaid ?? 0;

    const isContractPayment = paymentCategory === 'client_amount';
    const newContractPaid = isContractPayment
      ? contractPaidBefore + amount
      : contractPaidBefore;
    const totalPaidAfter = allPaidBefore + amount;
    const extraExpensesAmount = totalPaidAfter - newContractPaid;
    const remainingBalance = Math.max(contractAmount - newContractPaid, 0);

    const payment = await ClientPayment.create({
      clientId: client._id,
      monthYear,
      category: paymentCategory,
      amountPaid: amount,
      remainingBalance: isContractPayment ? remainingBalance : 0,
      paymentType: paymentType || 'bank_transfer',
      paymentScreenshotUrl,
      cloudinaryPublicId,
      paymentDate: paymentDate || undefined,
      note: cleanNote,
      status: isContractPayment
        ? newContractPaid >= contractAmount
          ? 'paid'
          : 'partial'
        : 'paid',
    });

    res.status(201).json({
      success: true,
      message:
        isContractPayment && newContractPaid >= contractAmount
          ? `${monthYear} is now fully paid`
          : 'Payment added successfully',
      data: payment,
      month: {
        monthYear,
        contractAmount,
        contractPaidAmount: newContractPaid,
        extraExpensesAmount,
        paidAmount: totalPaidAfter,
        remainingBalance,
      },
    });
  }
);

export const getClientPayments: RequestHandler = HandleAsyncError(
  async (req, res, next) => {
    const { clientId } = req.params;
    const resultPerPage = 10;

    const client = await Client.findById(clientId);
    if (!client) {
      return next(new ErrorHandler('Client not found', 404));
    }

    const baseQuery: Record<string, unknown> = { clientId };
    if (
      req.query.category &&
      ['client_amount', 'influencer_expense', 'fuel_expense'].includes(
        String(req.query.category)
      )
    ) {
      baseQuery.category = String(req.query.category);
    }

    const countApiFeatures = new ApiFeatures(ClientPayment.find(baseQuery), req.query)
      .search()
      .filter();

    const totalCount = await countApiFeatures.query.countDocuments();

    const apiFeatures = new ApiFeatures(ClientPayment.find(baseQuery), req.query)
      .search()
      .filter()
      .pagination(resultPerPage);

    const payments = await apiFeatures.query
      .populate('clientId', 'companyName ownerName type category')
      .sort({ paymentDate: -1, createdAt: -1 });

    res.status(200).json({
      success: true,
      totalCount,
      totalPages: Math.ceil(totalCount / resultPerPage),
      currentPage: Number(req.query.page) || 1,
      resultsPerPage: resultPerPage,
      data: payments,
    });
  }
);

// =====================================================================
// 3. Get Auto-Generated Monthly Ledger (For Retainer Clients)
// =====================================================================
export const getClientMonthlyLedger: RequestHandler = HandleAsyncError(
  async (req, res, next) => {
    const { clientId } = req.params;

    if (!isValidObjectId(clientId)) {
      return next(new ErrorHandler('Invalid client id', 400));
    }

    const client = await Client.findById(clientId);
    if (!client) {
      return next(new ErrorHandler('Client not found', 404));
    }

    if (client.type !== 'retainer') {
      return next(new ErrorHandler('Monthly ledger is only for retainer clients', 400));
    }

    const contractAmount = client.monthlyContractAmount || 0;

    const rows = await ClientPayment.aggregate<{
      _id: string;
      contractPaid: number;
      extraExpenses: number;
      total: number;
    }>([
      { $match: { clientId: client._id } },
      {
        $group: {
          _id: '$monthYear',
          contractPaid: {
            $sum: {
              $cond: [{ $eq: ['$category', 'client_amount'] }, '$amountPaid', 0],
            },
          },
          extraExpenses: {
            $sum: {
              $cond: [
                { $in: ['$category', ['influencer_expense', 'fuel_expense']] },
                '$amountPaid',
                0,
              ],
            },
          },
          total: { $sum: '$amountPaid' },
        },
      },
    ]);

    const statsByMonth = new Map(rows.map((row) => [row._id, row]));
    const paymentMonths = rows
      .map((row) => row._id)
      .filter((m): m is string => typeof m === 'string' && MONTH_REGEX.test(m))
      .sort();

    const nowMonth = toMonthKey();
    const dateMonth = toMonthKey(client.date || client.createdAt);
    const firstPaymentMonth = paymentMonths[0];
    const lastPaymentMonth = paymentMonths[paymentMonths.length - 1];

    const startMonth =
      firstPaymentMonth && firstPaymentMonth < dateMonth ? firstPaymentMonth : dateMonth;
    const endMonth =
      lastPaymentMonth && lastPaymentMonth > nowMonth ? lastPaymentMonth : nowMonth;

    const months = monthRange(startMonth, endMonth)
      .reverse()
      .map((monthYear) => {
        const stats = statsByMonth.get(monthYear);
        const contractPaidAmount = stats?.contractPaid ?? 0;
        const extraExpensesAmount = stats?.extraExpenses ?? 0;
        const paidAmount = stats?.total ?? 0;
        const isPaid = contractPaidAmount >= contractAmount;
        const remainingBalance = Math.max(contractAmount - contractPaidAmount, 0);

        return {
          monthYear,
          contractAmount,
          contractPaidAmount,
          extraExpensesAmount,
          paidAmount,
          remainingBalance,
          status: isPaid ? 'paid' : contractPaidAmount > 0 ? 'partial' : 'unpaid',
        };
      });

    const dueMonths = months.filter((m) => m.monthYear <= nowMonth);
    const totalDue = dueMonths.length * contractAmount;
    const totalPaid = dueMonths.reduce(
      (sum, m) => sum + Math.min(m.contractPaidAmount, contractAmount),
      0
    );

    res.status(200).json({
      success: true,
      summary: {
        monthlyContractAmount: contractAmount,
        totalDue,
        totalPaid,
        totalRemaining: Math.max(totalDue - totalPaid, 0),
        unpaidMonths: dueMonths.filter((m) => m.status !== 'paid').length,
      },
      data: months,
    });
  }
);

// =====================================================================
// 4. Get Payments for a Specific Month
// =====================================================================
export const getMonthPayments: RequestHandler = HandleAsyncError(
  async (req, res, next) => {
    const { clientId, monthYear } = req.params;

    if (!isValidObjectId(clientId)) {
      return next(new ErrorHandler('Invalid client id', 400));
    }

    const targetMonth = Array.isArray(monthYear) ? monthYear[0] : monthYear;

    if (!MONTH_REGEX.test(targetMonth)) {
      return next(new ErrorHandler('monthYear must look like 2026-10', 400));
    }

    const client = await Client.findById(clientId);
    if (!client || client.type !== 'retainer') {
      return next(new ErrorHandler('Retainer client not found', 404));
    }

    const contractAmount = client.monthlyContractAmount || 0;
    const payments = await ClientPayment.find({
      clientId: client._id,
      monthYear: targetMonth,
    }).sort({ paymentDate: -1, createdAt: -1 });

    let contractPaidAmount = 0;
    let extraExpensesAmount = 0;

    for (const p of payments) {
      if (p.category === 'client_amount') {
        contractPaidAmount += p.amountPaid;
      } else if (
        p.category === 'influencer_expense' ||
        p.category === 'fuel_expense'
      ) {
        extraExpensesAmount += p.amountPaid;
      }
    }

    const paidAmount = contractPaidAmount + extraExpensesAmount;
    const isPaid = contractPaidAmount >= contractAmount;

    res.status(200).json({
      success: true,
      month: {
        monthYear: targetMonth,
        contractAmount,
        contractPaidAmount,
        extraExpensesAmount,
        paidAmount,
        remainingBalance: Math.max(contractAmount - contractPaidAmount, 0),
        status: isPaid ? 'paid' : contractPaidAmount > 0 ? 'partial' : 'unpaid',
      },
      data: payments,
    });
  }
);

export const updateClientPayment: RequestHandler = HandleAsyncError(
  async (req, res, next) => {
    const { id } = req.params;

    let payment = await ClientPayment.findById(id);
    if (!payment) {
      return next(new ErrorHandler('Payment record not found', 404));
    }

    const updateData: any = { ...req.body };

    if (req.file) {
      const cloudinaryResponse = await uploadBufferToCloudinary(
        req.file.buffer,
        'apex_client_payments'
      );

      updateData.paymentScreenshotUrl = cloudinaryResponse.secure_url;
      updateData.cloudinaryPublicId = cloudinaryResponse.public_id;

      if (payment.cloudinaryPublicId) {
        try {
          await cloudinary.uploader.destroy(payment.cloudinaryPublicId);
        } catch (err) {
          console.error('Failed to clean up old Cloudinary image during update:', err);
        }
      }
    }

    payment = await ClientPayment.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
      omitUndefined: true,
    }).populate('clientId', 'companyName ownerName type');

    res.status(200).json({
      success: true,
      message: 'Payment record updated successfully',
      data: payment,
    });
  }
);

export const deleteClientPayment: RequestHandler = HandleAsyncError(
  async (req, res, next) => {
    if (!isValidObjectId(req.params.id)) {
      return next(new ErrorHandler('Invalid payment id', 400));
    }

    const payment = await ClientPayment.findById(req.params.id);
    if (!payment) {
      return next(new ErrorHandler('Payment not found', 404));
    }

    if (payment.cloudinaryPublicId) {
      try {
        await cloudinary.uploader.destroy(payment.cloudinaryPublicId);
      } catch (cloudinaryError) {
        console.error('Failed to delete image from Cloudinary:', cloudinaryError);
      }
    }

    await payment.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Payment and associated cloud receipt deleted successfully',
    });
  }
);