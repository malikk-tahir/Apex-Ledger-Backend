import { RequestHandler } from 'express';
import mongoose from 'mongoose';
import HandleAsyncError from '../../middleware/handleAsyncError';
import ErrorHandler from '../../utils/errorHandler';
import ApiFeatures from '../../utils/apiFeatures';
import Employee from '../employee/employeeModel';
import EmployeePayment, { IEmployeePayment } from './employeeSalaryModel';
import { generateSalaryRecords, getSalaryStatus } from './employeeSalaryService';
import { uploadBufferToCloudinary } from '../../utils/cloudinary'
import { v2 as cloudinary } from 'cloudinary'

// POST /salaries/generate - body: { salaryMonth: "2026-10" }
export const generateSalaries: RequestHandler = HandleAsyncError(async (req, res, next) => {
  const { salaryMonth } = req.body;
  if (!salaryMonth) {
    return next(new ErrorHandler('Salary month is required', 400));
  }

  const { createdCount, skippedCount } = await generateSalaryRecords(salaryMonth);

  res.status(201).json({
    success: true,
    message: `${createdCount} salary record(s) created for ${salaryMonth}`,
    createdCount,
    skippedCount,
  });
});

// GET /salaries?salaryMonth=2026-10&page=1
export const getSalaries: RequestHandler = HandleAsyncError(async (req, res, next) => {
  const resultsPerPage = 10;

  const countFeatures = new ApiFeatures(EmployeePayment.find(), req.query).filter();
  const totalCount = await countFeatures.query.countDocuments();

  const apiFeatures = new ApiFeatures(EmployeePayment.find(), req.query)
    .filter()
    .pagination(resultsPerPage);

  const salaries = await apiFeatures.query
    .populate('employeeId', 'name designation baseSalary')
    .sort({ dueDate: -1, createdAt: -1 });

  res.status(200).json({
    success: true,
    totalRecords: totalCount,
    resultsPerPage: resultsPerPage,
    currentPage: Number(req.query.page) || 1,
    totalPages: Math.ceil(totalCount / resultsPerPage) || 1,
    data: salaries.map((salary: IEmployeePayment) => ({
      ...salary.toObject(),
      status: getSalaryStatus(salary),
    })),
  });
});

// GET /salaries/:id
export const getEmployeeSalaries: RequestHandler = HandleAsyncError(async (req, res, next) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return next(new ErrorHandler('Invalid salary ID', 400));
  }

  // Ensure ApiFeatures automatically scopes the query to this specific employee
  const baseQuery = EmployeePayment.find({ employeeId: id });
  const resultsPerPage = 10;

  const countFeatures = new ApiFeatures(baseQuery.clone(), req.query).filter();
  const totalCount = await countFeatures.query.countDocuments();

  const apiFeatures = new ApiFeatures(baseQuery, req.query)
    .filter()
    .pagination(resultsPerPage);

  const salaries = await apiFeatures.query
    .populate('employeeId', 'name designation baseSalary contact')
    .sort({ dueDate: -1, createdAt: -1 });

  res.status(200).json({
    success: true,
    totalRecords: totalCount,
    resultsPerPage: resultsPerPage,
    currentPage: Number(req.query.page) || 1,
    totalPages: Math.ceil(totalCount / resultsPerPage) || 1,
    data: salaries.map((salary: IEmployeePayment) => ({
      ...salary.toObject(),
      status: getSalaryStatus(salary),
    })),
  });
});

export const paySalary: RequestHandler = HandleAsyncError(async (req, res, next) => {
  const { id } = req.params;
  const { amountPaid, paymentType, paymentDate } = req.body;

  if (!mongoose.isValidObjectId(id)) {
    return next(new ErrorHandler('Invalid salary ID', 400));
  }

  const salary = await EmployeePayment.findById(id);
  if (!salary) {
    return next(new ErrorHandler('Salary record not found', 404));
  }
  if (salary.isPaid) {
    return next(new ErrorHandler('This salary is already paid', 400));
  }

  const employee = await Employee.findById(salary.employeeId);
  if (!employee) {
    return next(new ErrorHandler('Employee not found', 404));
  }

  salary.isPaid = true;
  salary.amountPaid = amountPaid !== undefined ? Number(amountPaid) : employee.baseSalary;
  if (paymentType) salary.paymentType = paymentType;
  salary.paymentDate = paymentDate ? new Date(paymentDate) : new Date();

  if (req.file) {
    if (salary.cloudinaryPublicId) {
      try {
        await cloudinary.uploader.destroy(salary.cloudinaryPublicId);
      } catch (err) {
        console.error('Failed to clean up old salary screenshot:', err);
      }
    }

    const cloudinaryResponse = await uploadBufferToCloudinary(req.file.buffer, 'apex_employee_salaries');
    salary.paymentScreenshotUrl = cloudinaryResponse.secure_url;
    salary.cloudinaryPublicId = cloudinaryResponse.public_id;
  }

  await salary.save();

  res.status(200).json({
    success: true,
    message: `Salary for ${salary.salaryMonth} marked as paid`,
    data: salary,
  });
});

export const undoSalaryPayment: RequestHandler = HandleAsyncError(async (req, res, next) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return next(new ErrorHandler('Invalid salary ID', 400));
  }

  const salary = await EmployeePayment.findById(id);
  if (!salary) {
    return next(new ErrorHandler('Salary record not found', 404));
  }

  if (salary.cloudinaryPublicId) {
    try {
      await cloudinary.uploader.destroy(salary.cloudinaryPublicId);
    } catch (cloudinaryError) {
      console.error('Failed to delete salary screenshot from Cloudinary during undo:', cloudinaryError);
    }
  }

  salary.isPaid = false;
  salary.amountPaid = 0;
  salary.paymentDate = undefined;
  salary.paymentScreenshotUrl = undefined;
  salary.cloudinaryPublicId = undefined; 
  await salary.save();

  res.status(200).json({
    success: true,
    message: 'Salary payment undone',
    data: salary,
  });
});

// DELETE /salaries/:id
export const deleteSalary: RequestHandler = HandleAsyncError(async (req, res, next) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return next(new ErrorHandler('Invalid salary ID', 400));
  }

  const salary = await EmployeePayment.findByIdAndDelete(id);
  if (!salary) {
    return next(new ErrorHandler('Salary record not found', 404));
  }

  res.status(200).json({
    success: true,
    message: 'Salary record deleted successfully',
  });
});