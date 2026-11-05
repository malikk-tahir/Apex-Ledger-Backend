import Employee from '../employee/employeeModel';
import EmployeePayment from './employeeSalaryModel';
import { toMonthKey } from '../../utils/dateUtils';

const ONE_DAY = 24 * 60 * 60 * 1000;

/** Gets the current salary month string in Pakistan timezone, e.g. "2026-10" */
export const getCurrentSalaryMonth = (): string => {
  return toMonthKey(new Date());
};

/** Salary of "2026-10" is due on the employee's StartDay of the NEXT month. */
export const getSalaryDueDate = (salaryMonth: string, startDay: number): Date => {
  const [year, month] = salaryMonth.split('-').map(Number);
  return new Date(Date.UTC(year, month, startDay));
};

/** Determines if a salary record is paid, overdue, or pending */
export const getSalaryStatus = (salary: { isPaid: boolean; dueDate: Date }): 'paid' | 'overdue' | 'pending' => {
  if (salary.isPaid) return 'paid';
  const endOfDueDay = new Date(salary.dueDate).getTime() + ONE_DAY;
  return Date.now() >= endOfDueDay ? 'overdue' : 'pending';
};

/** Creates salary records for all active employees for a target month. */
export const generateSalaryRecords = async (salaryMonth: string) => {
  const employees = await Employee.find({ isActive: true });

  const existingRecords = await EmployeePayment.find({ salaryMonth }).select('employeeId');
  const employeesWithRecord = new Set(existingRecords.map((record) => String(record.employeeId)));

  const newRecords = employees
    .filter((employee) => !employeesWithRecord.has(String(employee._id)))
    .map((employee) => ({
      employeeId: employee._id,
      salaryMonth,
      dueDate: getSalaryDueDate(salaryMonth, employee.startDay),
    }));

  if (newRecords.length > 0) {
    await EmployeePayment.insertMany(newRecords, { ordered: false });
  }

  return {
    createdCount: newRecords.length,
    skippedCount: employees.length - newRecords.length,
  };
};