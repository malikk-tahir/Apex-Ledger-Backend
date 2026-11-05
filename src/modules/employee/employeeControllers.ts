import { RequestHandler } from 'express';
import { isValidObjectId } from 'mongoose';
import HandleAsyncError from '../../middleware/handleAsyncError';
import ErrorHandler from '../../utils/errorHandler';
import Employee from './employeeModel';
import ApiFeatures from '../../utils/apiFeatures';


export const createEmployee: RequestHandler = HandleAsyncError(
  async (req, res, next) => {
    const { name, contact, designation, baseSalary, startDay, isActive } = req.body;

    if (!name || !contact || !designation || baseSalary === undefined) {
      return next(new ErrorHandler('Please provide all required employee fields', 400));
    }

    const salary = Number(baseSalary);
    if (!Number.isFinite(salary) || salary < 0) {
      return next(new ErrorHandler('Base salary must be a valid positive number', 400));
    }

    let parsedStartDay = 1;
    if (startDay !== undefined) {
      parsedStartDay = Number(startDay);
      if (!Number.isInteger(parsedStartDay) || parsedStartDay < 1 || parsedStartDay > 28) {
        return next(new ErrorHandler('StartDay must be range from 1 to 28', 400));
      }
    }

    const employee = await Employee.create({
      name,
      contact,
      designation,
      baseSalary: salary,
      startDay: parsedStartDay,
      isActive: isActive !== undefined ? isActive : true,
    });

    res.status(201).json({
      success: true,
      message: 'Employee created successfully',
      data: employee,
    });
  }
);


export const getAllEmployees: RequestHandler = HandleAsyncError(
  async (req, res, next) => {
    const resultPerPage = 10;

    const countApiFeatures = new ApiFeatures(Employee.find(), req.query)
      .search()
      .filter();

    const totalCount = await countApiFeatures.query.countDocuments();

    const apiFeatures = new ApiFeatures(Employee.find(), req.query)
      .search()
      .filter()
      .pagination(resultPerPage);

    const employees = await apiFeatures.query.sort({ createdAt: -1 });

    const [payroll] = await Employee.aggregate<{ activeEmployees: number; totalMonthlyPayroll: number }>([
      { $match: { isActive: true } },
      { $group: { _id: null, activeEmployees: { $sum: 1 }, totalMonthlyPayroll: { $sum: '$baseSalary' } } },
    ]);

    res.status(200).json({
      success: true,
      totalCount,
      totalPages: Math.ceil(totalCount / resultPerPage),
      currentPage: Number(req.query.page) || 1,
      resultsPerPage: resultPerPage,
      summary: {
        activeEmployees: payroll?.activeEmployees ?? 0,
        totalMonthlyPayroll: payroll?.totalMonthlyPayroll ?? 0,
      },
      data: employees,
    });
  }
);


export const getSingleEmployee: RequestHandler = HandleAsyncError(
  async (req, res, next) => {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return next(new ErrorHandler('Invalid employee ID', 400));
    }

    const employee = await Employee.findById(id);
    if (!employee) {
      return next(new ErrorHandler('Employee not found', 404));
    }

    res.status(200).json({
      success: true,
      data: employee,
    });
  }
);


export const updateEmployee: RequestHandler = HandleAsyncError(
  async (req, res, next) => {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return next(new ErrorHandler('Invalid employee ID', 400));
    }

    if (req.body.StartDay !== undefined) {
      const day = Number(req.body.StartDay);
      if (!Number.isInteger(day) || day < 1 || day > 28) {
        return next(new ErrorHandler('StartDay must be range from 1 to 28', 400));
      }
    }

    let employee = await Employee.findById(id);
    if (!employee) {
      return next(new ErrorHandler('Employee not found', 404));
    }

    employee = await Employee.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
      omitUndefined: true,
    });

    res.status(200).json({
      success: true,
      message: 'Employee updated successfully',
      data: employee,
    });
  }
);


export const setEmployeeStatus: RequestHandler = HandleAsyncError(
  async (req, res, next) => {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return next(new ErrorHandler('Invalid employee ID', 400));
    }

    const { isActive } = req.body ?? {};
    if (typeof isActive !== 'boolean') {
      return next(new ErrorHandler('isActive must be true or false', 400));
    }

    const employee = await Employee.findByIdAndUpdate(
      id,
      { isActive },
      { new: true, runValidators: true }
    );

    if (!employee) {
      return next(new ErrorHandler('Employee not found', 404));
    }

    res.status(200).json({
      success: true,
      message: isActive ? 'Employee activated successfully' : 'Employee deactivated successfully',
      data: employee,
    });
  }
);
