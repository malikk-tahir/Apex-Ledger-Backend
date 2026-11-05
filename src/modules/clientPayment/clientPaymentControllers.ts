import { RequestHandler } from 'express';
import { Types, isValidObjectId } from 'mongoose';
import HandleAsyncError from '../../middleware/handleAsyncError';
import ErrorHandler from '../../utils/errorHandler';
import Client from '../client/clientModel';
import { ClientPayment } from './clientPaymentModel';
import ApiFeatures from '../../utils/apiFeatures';
import { MONTH_REGEX, toMonthKey, monthRange } from '../../utils/dateUtils';
import { uploadBufferToCloudinary } from '../../utils/cloudinary'
import { v2 as cloudinary } from 'cloudinary'

export const addClientPayment: RequestHandler = HandleAsyncError(
  async (req, res, next) => {
    const { clientId } = req.params;
    const {
      monthYear,
      amountPaid,
      paymentType,
      paymentDate,
    } = req.body;

    const client = await Client.findById(clientId);
    if (!client) {
      return next(new ErrorHandler('Client not found', 404));
    }

    const amount = Number(amountPaid);
    if (!Number.isFinite(amount) || amount <= 0) {
      return next(new ErrorHandler('Payment amount must be greater than 0', 400));
    }

    let paymentScreenshotUrl: string | undefined = undefined;
    let cloudinaryPublicId: string | undefined = undefined; 

    if (req.file) {
      const cloudinaryResponse = await uploadBufferToCloudinary(req.file.buffer, 'apex_client_payments');
      paymentScreenshotUrl = cloudinaryResponse.secure_url;
      cloudinaryPublicId = cloudinaryResponse.public_id;     
    }

    if (client.type === 'one_time') {
      const payment = await ClientPayment.create({
        clientId: client._id,
        monthYear: monthYear || toMonthKey(paymentDate ? new Date(paymentDate) : new Date()),
        amountPaid: amount,
        remainingBalance: 0,
        paymentType: paymentType || 'bank_transfer',
        paymentScreenshotUrl,
        cloudinaryPublicId, // <-- 3. Save to database document
        paymentDate: paymentDate || undefined,
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
      return next(new ErrorHandler('This retainer client has no valid monthly contract amount', 400));
    }
    if (typeof monthYear !== 'string' || !MONTH_REGEX.test(monthYear)) {
      return next(new ErrorHandler('monthYear must look like 2026-10', 400));
    }

    const [row] = await ClientPayment.aggregate<{ total: number }>([
      { $match: { clientId: client._id, monthYear } },
      { $group: { _id: null, total: { $sum: '$amountPaid' } } },
    ]);
    const paidBefore = row?.total ?? 0;
    const remainingBefore = contractAmount - paidBefore;

    if (remainingBefore <= 0) {
      return next(new ErrorHandler(`${monthYear} is already fully paid`, 400));
    }
    if (amount > remainingBefore) {
      return next(new ErrorHandler(`Amount exceeds remaining balance for ${monthYear} (${remainingBefore})`, 400));
    }

    const remainingBalance = remainingBefore - amount;

    const payment = await ClientPayment.create({
      clientId: client._id,
      monthYear,
      amountPaid: amount,
      remainingBalance,
      paymentType: paymentType || 'bank_transfer',
      paymentScreenshotUrl,
      cloudinaryPublicId, 
      paymentDate: paymentDate || undefined,
      status: remainingBalance === 0 ? 'paid' : 'partial',
    });

    res.status(201).json({
      success: true,
      message: remainingBalance === 0 ? `${monthYear} is now fully paid` : 'Payment added successfully',
      data: payment,
      month: {
        monthYear,
        contractAmount,
        paidAmount: paidBefore + amount,
        remainingBalance,
        // color: remainingBalance === 0 ? 'green' : 'red',
      },
    });
  }
);

// =====================================================================
// 2. Get All Payments (Simple list for One-Time clients)
// =====================================================================
export const getClientPayments: RequestHandler = HandleAsyncError(
  async (req, res, next) => {
    const { clientId } = req.params;
    const resultPerPage = 10;

    const client = await Client.findById(clientId);
    if (!client) {
      return next(new ErrorHandler('Client not found', 404));
    }

    const baseQuery = { clientId };

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

    const client = await Client.findById(clientId);
    if (!client) {
      return next(new ErrorHandler('Client not found', 404));
    }

    if (client.type !== 'retainer') {
      return next(new ErrorHandler('Monthly ledger is only for retainer clients', 400));
    }

    const contractAmount = client.monthlyContractAmount || 0;

    // Aggregate payments grouped by monthYear
    const rows = await ClientPayment.aggregate<{ _id: string; total: number }>([
      { $match: { clientId: client._id } },
      { $group: { _id: '$monthYear', total: { $sum: '$amountPaid' } } },
    ]);
    const paidByMonth = new Map(rows.map((row) => [row._id, row.total]));
    const paymentMonths = rows.map((row) => row._id).sort();

    const nowMonth = toMonthKey();
    const dateMonth = toMonthKey(client.date || client.createdAt);
    const firstPaymentMonth = paymentMonths[0];
    const lastPaymentMonth = paymentMonths[paymentMonths.length - 1];

    // Determine range from client start date up to current month (covering any advance payments)
    const startMonth = firstPaymentMonth && firstPaymentMonth < dateMonth ? firstPaymentMonth : dateMonth;
    const endMonth = lastPaymentMonth && lastPaymentMonth > nowMonth ? lastPaymentMonth : nowMonth;

    const months = monthRange(startMonth, endMonth)
      .reverse() // Newest month first
      .map((monthYear) => {
        const paidAmount = paidByMonth.get(monthYear) ?? 0;
        const isPaid = paidAmount >= contractAmount;
        const remainingBalance = Math.max(contractAmount - paidAmount, 0);

        return {
          monthYear,
          contractAmount,
          paidAmount,
          remainingBalance,
          status: isPaid ? 'paid' : paidAmount > 0 ? 'partial' : 'unpaid',
          // color: isPaid ? 'green' : 'red',
        };
      });

    // Summary calculations up to the current month
    const dueMonths = months.filter((m) => m.monthYear <= nowMonth);
    const totalDue = dueMonths.length * contractAmount;
    const totalPaid = dueMonths.reduce((sum, m) => sum + Math.min(m.paidAmount, contractAmount), 0);

    res.status(200).json({
      success: true,
      summary: {
        monthlyContractAmount: contractAmount,
        totalDue,
        totalPaid,
        totalRemaining: Math.max(totalDue - totalPaid, 0),
        unpaidMonths: dueMonths.filter((m) => m.status!=='paid').length,
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

    const targetMonth = Array.isArray(monthYear) ? monthYear[0] : monthYear;

    if (!MONTH_REGEX.test(targetMonth)) {
      return next(new ErrorHandler('monthYear must look like 2026-10', 400));
    }

    const client = await Client.findById(clientId);
    if (!client || client.type !== 'retainer') {
      return next(new ErrorHandler('Retainer client not found', 404));
    }

    const contractAmount = client.monthlyContractAmount || 0;
    const payments = await ClientPayment.find({ clientId: client._id, monthYear: targetMonth }).sort({ paymentDate: -1, createdAt: -1 });
    const paidAmount = payments.reduce((sum, p) => sum + p.amountPaid, 0);
    const isPaid = paidAmount >= contractAmount;

    res.status(200).json({
      success: true,
      month: {
        monthYear: targetMonth,
        contractAmount,
        paidAmount,
        remainingBalance: Math.max(contractAmount - paidAmount, 0),
        status: isPaid ? 'paid' : paidAmount > 0 ? 'partial' : 'unpaid',
        // color: isPaid ? 'green' : 'red',
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
      const cloudinaryResponse = await uploadBufferToCloudinary(req.file.buffer, 'apex_client_payments');
      
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