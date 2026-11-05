import { RequestHandler } from 'express';
import HandleAsyncError from '../../middleware/handleAsyncError';
import mongoose from 'mongoose';
import ErrorHandler from '../../utils/errorHandler';
import ApiFeatures from '../../utils/apiFeatures';
import Transaction, { IOfficeExpense } from './officeExpenseModel';
import { getDateFilter } from '../../utils/dateUtils';
import { uploadBufferToCloudinary } from '../../utils/cloudinary'
import { v2 as cloudinary } from 'cloudinary'

export const addTransaction: RequestHandler = HandleAsyncError(async (req, res, next) => {
  const { type, amount, purpose, paymentType, transactionDate } = req.body;

  let screenshotUrl: string | undefined = undefined;
  let cloudinaryPublicId: string | null = null;
  if (req.file) {
    const cloudinaryResponse = await uploadBufferToCloudinary(req.file.buffer, 'apex_office_expenses');
    screenshotUrl = cloudinaryResponse.secure_url;
    cloudinaryPublicId = cloudinaryResponse.public_id;
  }

  const transaction = await Transaction.create({
    type,
    amount: Number(amount),
    purpose,
    paymentType,
    transactionDate: transactionDate ? new Date(transactionDate) : new Date(),
    ...(screenshotUrl ? { receiptScreenshotUrl: screenshotUrl } : {}),
    ...(cloudinaryPublicId ? { cloudinaryPublicId } : {}),
  });

  res.status(201).json({
    success: true,
    message: 'Transaction added successfully',
    data: transaction,
  });
});

export const getTransactions: RequestHandler = HandleAsyncError(async (req, res) => {
  const resultsPerPage = 10;
  const dateFilter = getDateFilter(req.query);

  const queryCopy: Record<string, unknown> = { ...req.query };
  delete queryCopy.startDate;
  delete queryCopy.endDate;

  const baseFilter: Record<string, any> = {};
  if (Object.keys(dateFilter).length > 0) {
    baseFilter.transactionDate = dateFilter;
  }

  const countFeatures = new ApiFeatures(
    Transaction.find(baseFilter),
    queryCopy,
  ).filter();

  const totalCount = await countFeatures.query.countDocuments();

  const apiFeatures = new ApiFeatures(
    Transaction.find(baseFilter),
    queryCopy,
  )
    .filter()
    .pagination(resultsPerPage);

  const transactions = await apiFeatures.query.sort({ transactionDate: -1, createdAt: -1 });

  res.status(200).json({
    success: true,
    totalRecords: totalCount,
    resultsPerPage: resultsPerPage,
    currentPage: Number(req.query.page) || 1,
    totalPages: Math.ceil(totalCount / resultsPerPage) || 1,
    data: transactions,
  });
});


export const getTransactionSummary: RequestHandler = HandleAsyncError(async (req, res, next) => {
  let dateFilter = getDateFilter(req.query);

  const matchStage: Record<string, any> = {};
  if (Object.keys(dateFilter).length > 0) {
    matchStage.transactionDate = dateFilter;
  }

  const totals = await Transaction.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$type',
        totalAmount: { $sum: '$amount' },
      },
    },
  ]);

  const totalIncoming = totals.find((t) => t._id === 'in')?.totalAmount || 0;
  const totalOutgoing = totals.find((t) => t._id === 'out')?.totalAmount || 0;
  const netBalance = totalIncoming - totalOutgoing;

  res.status(200).json({
    success: true,
    summary: {
      totalIncoming,
      totalOutgoing,
      netBalance,
    },
  });
});


export const getTransactionById: RequestHandler = HandleAsyncError(async (req, res, next) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return next(new ErrorHandler('Invalid transaction ID', 400));
  }

  const transaction = await Transaction.findById(id);
  if (!transaction) {
    return next(new ErrorHandler('Transaction not found', 404));
  }

  res.status(200).json({ success: true, data: transaction });
});


export const updateTransaction: RequestHandler = HandleAsyncError(async (req, res, next) => {
  const { id } = req.params;
  const { type, amount, purpose, paymentType, transactionDate } = req.body;

  if (!mongoose.isValidObjectId(id)) {
    return next(new ErrorHandler('Invalid transaction ID', 400));
  }

  const transaction = await Transaction.findById(id);
  if (!transaction) {
    return next(new ErrorHandler('Transaction not found', 404));
  }

  const updateData: Partial<IOfficeExpense> & { cloudinaryPublicId?: string } = {};
  if (type !== undefined) updateData.type = type;
  if (amount !== undefined) updateData.amount = Number(amount);
  if (purpose !== undefined) updateData.purpose = purpose;
  if (paymentType !== undefined) updateData.paymentType = paymentType;
  if (transactionDate !== undefined) updateData.transactionDate = new Date(transactionDate);

  if (req.file) {
    const cloudinaryResponse = await uploadBufferToCloudinary(req.file.buffer, 'apex_office_expenses');
    updateData.receiptScreenshotUrl = cloudinaryResponse.secure_url;
    updateData.cloudinaryPublicId = cloudinaryResponse.public_id;

    if (transaction.cloudinaryPublicId) {
      try {
        await cloudinary.uploader.destroy(transaction.cloudinaryPublicId);
      } catch (err) {
        console.error('Failed to clean up old office expense receipt from Cloudinary:', err);
      }
    }
  }

  const updatedTransaction = await Transaction.findByIdAndUpdate(
    id,
    {
      ...(Object.keys(updateData).length > 0 ? { $set: updateData } : {}),
    },
    { new: true, runValidators: true }
  );

  res.status(200).json({
    success: true,
    message: 'Transaction updated successfully',
    data: updatedTransaction,
  });
});

export const deleteTransaction: RequestHandler = HandleAsyncError(async (req, res, next) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return next(new ErrorHandler('Invalid transaction ID', 400));
  }

  const transaction = await Transaction.findById(id);
  if (!transaction) {
    return next(new ErrorHandler('Transaction not found', 404));
  }

  if (transaction.cloudinaryPublicId) {
    try {
      await cloudinary.uploader.destroy(transaction.cloudinaryPublicId);
    } catch (cloudinaryError) {
      console.error('Failed to delete receipt from Cloudinary:', cloudinaryError);
    }
  }

  await transaction.deleteOne();

  res.status(200).json({
    success: true,
    message: 'Transaction and associated cloud receipt deleted successfully',
  });
});