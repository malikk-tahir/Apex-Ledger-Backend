import { Schema, model, Document } from 'mongoose';

export type OfficeExpensePurpose = 
  | 'Office Rent'
  | 'Utility Bill'
  | 'Employee Salary'
  | 'Internet & Communication'
  | 'Software Subscriptions'
  | 'Marketing & Ads'
  | 'Office Supplies'
  | 'Maintenance & Repairs'
  | 'Miscellaneous';

export interface IOfficeExpense extends Document {
  type: 'in' | 'out'; // Money In (Revenue/Income) or Money Out (Office Expense)
  purpose: OfficeExpensePurpose | string; // e.g., 'Office Rent', 'Utility Bill', 'Employee Salary'
  amount: number;
  paymentType: 'cash' | 'bank_transfer';
  receiptScreenshotUrl?: string;
  cloudinaryPublicId?: string | null;
  transactionDate: Date;
}

const OfficeExpense = new Schema<IOfficeExpense>(
  {
    type: { type: String, enum: ['in', 'out'], required: true },
    purpose: { 
      type: String, 
      required: true, 
      trim: true, 
      enum: [
        'Office Rent',
        'Utility Bill',
        'Employee Salary',
        'Internet & Communication',
        'Software Subscriptions',
        'Marketing & Ads',
        'Office Supplies',
        'Maintenance & Repairs',
        'Miscellaneous'
      ]
     },
    amount: { type: Number, required: true },
    paymentType: { type: String, enum: ['cash', 'bank_transfer'], required: true },
    receiptScreenshotUrl: { type: String },
    cloudinaryPublicId: { type: String, default: null },
    transactionDate: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true }
);

export default model<IOfficeExpense>('Transaction', OfficeExpense);