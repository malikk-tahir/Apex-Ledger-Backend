import { z } from 'zod';

// ==================== USER VALIDATORS ====================
export const registerUserSchema = z.object({
  body: z.object({
    name: z.string({ message: 'Name is required' }).trim().min(1, 'Please provide full name'),
    email: z.string({ message: 'Email is required' }).email('Please provide a valid email').toLowerCase().trim(),
    mobile_no: z.string({ message: 'Mobile number is required' }).regex(
      /^(\+92|0|92)[0-9]{10}$/,
      'Please provide a valid Pakistani mobile number'
    ),
    password: z.string({ message: 'Password is required' }).min(4, 'Password must be at least 4 characters'),
  }),
});

export const loginUserSchema = z.object({
  body: z.object({
    email: z.string({ message: 'Email is required' }).email('Please provide a valid email'),
    password: z.string({ message: 'Password is required' }),
  }),
});


// ==================== CLIENT VALIDATORS ====================
const businessCategories = [
  'Restaurant & Cafe',
  'Real Estate',
  'E-Commerce & Retail',
  'Health & Fitness',
  'Education',
  'Corporate & Professional Services',
  'Automotive',
  'Events & Entertainment',
  'Other',
] as const;

const paymentCategoryEnum = z.enum([
  'client_amount',
  'influencer_expense',
  'fuel_expense',
]);

const serviceTypes = ['media', 'graphic', 'web', 'package', 'all'] as const;

export const createClientSchema = z.object({
  body: z.object({
    companyName: z.string({ message: 'Company name is required' }).trim().min(1),
    ownerName: z.string({ message: 'Owner name is required' }).trim().min(1),
    category: z.enum(businessCategories, { message: 'Valid business category is required' }),
    contact: z.string({ message: 'Contact is required' }),
    address: z.string({ message: 'Address is required' }),
    type: z.enum(['retainer', 'one_time'], { message: 'Client type is required' }),
    services: z.array(z.enum(serviceTypes)).min(1, 'Select at least one service'),
    monthlyContractAmount: z.coerce.number().optional(),
    date: z.string().optional().transform((val) => (val ? new Date(val) : new Date())),
  }),
});

export const updateClientSchema = z.object({
  body: createClientSchema.shape.body.partial(),
});


// ==================== CLIENT PAYMENT VALIDATORS ====================

export const createClientPaymentSchema = z.object({
  body: z.object({
    monthYear: z.string().optional(),
    category: paymentCategoryEnum.optional(),
    amountPaid: z.coerce.number({ message: 'Amount paid is required' }).positive(),
    paymentType: z.enum(['card', 'cash', 'bank_transfer', 'online']).optional(),
    paymentDate: z.string().optional(),
    note: z.string().trim().max(500).optional(),
  }),
});

export const updateClientPaymentSchema = z.object({
  body: createClientPaymentSchema.partial(),
});


// ==================== EMPLOYEE VALIDATORS ====================
export const createEmployeeSchema = z.object({
  body: z.object({
    name: z.string({ message: 'Employee name is required' }).trim().min(1),
    contact: z.string({ message: 'Contact is required' }),
    designation: z.string({ message: 'Designation is required' }),
    baseSalary: z.coerce.number({ message: 'Base salary is required' }).min(0),
    startDay: z.coerce.number().default(1),
    isActive: z.boolean().default(true),
  }),
});

export const updateEmployeeSchema = z.object({
  body: createEmployeeSchema.shape.body.partial(),
});

export const updateEmployeeStatusSchema = z.object({
  body: z.object({
    isActive: z.boolean(),
  }),
});


// ==================== EMPLOYEE PAYMENT VALIDATORS ====================
export const createEmployeePaymentSchema = z.object({
  body: z.object({
    employeeId: z.string({ message: 'Employee ID is required' }),
    salaryMonth: z.string({ message: 'Salary month is required (e.g. 2026-10)' }),
    amountPaid: z.coerce.number({ message: 'Amount paid is required' }).min(0),
    paymentType: z.enum(['card', 'cash', 'bank_transfer']).default('bank_transfer'),
    paymentScreenshotUrl: z.string().optional(),
    paymentDate: z.string().optional().transform((val) => (val ? new Date(val) : undefined)),
    dueDate: z.string({ message: 'Due date is required' }).transform((val) => new Date(val)),
    isPaid: z.boolean().default(false),
  }),
});

export const generateSalariesSchema = z.object({
  body: z.object({
    salaryMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Salary month must look like 2026-10'),
  }),
});

export const paySalarySchema = z.object({
  body: z.object({
    amountPaid: z.coerce.number().positive().optional(),
    paymentType: z.enum(['card', 'cash', 'bank_transfer']).optional(),
    paymentDate: z.string().optional(),
  }),
});


// ==================== OFFICE EXPENSE / TRANSACTION VALIDATORS ====================
const expensePurposes = [
  'Office Rent',
  'Utility Bill',
  'Employee Salary',
  'Internet & Communication',
  'Software Subscriptions',
  'Marketing & Ads',
  'Office Supplies',
  'Maintenance & Repairs',
  'Miscellaneous',
] as const;

export const createTransactionSchema = z.object({
  body: z.object({
    type: z.enum(['in', 'out'], { message: 'Transaction type (in/out) is required' }),
    purpose: z.enum(expensePurposes,{ message: 'Purpose is required' }),
    amount: z.coerce.number({ message: 'Amount is required' }).positive('Amount must be greater than 0'),
    paymentType: z.enum(['cash', 'bank_transfer'], { message: 'Payment type is required' }),
    receiptScreenshotUrl: z.string().optional(),
    transactionDate: z.string().optional().transform((val) => (val ? new Date(val) : new Date())),
  }),
});

export const updateTransactionSchema = z.object({
  body: createTransactionSchema.shape.body.partial(),
});