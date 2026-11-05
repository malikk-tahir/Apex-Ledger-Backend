import { Schema, model, Document, Types } from 'mongoose';

export interface IEmployeePayment extends Document {
  employeeId: Types.ObjectId;
  salaryMonth: string; // e.g. "2026-10"
  amountPaid: number;
  paymentType: 'card' | 'cash' | 'bank_transfer';
  paymentScreenshotUrl?: string;
  cloudinaryPublicId?: string | null;
  paymentDate?: Date;
  dueDate: Date;
  isPaid: boolean;
}

const EmployeePaymentSchema = new Schema<IEmployeePayment>(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    salaryMonth: { type: String, required: true },
    amountPaid: { type: Number, required: true, default: 0 },
    paymentType: { type: String, enum: ['card', 'cash', 'bank_transfer'], default: 'bank_transfer' },
    paymentScreenshotUrl: { type: String },
    cloudinaryPublicId: { type: String, default: null },
    paymentDate: { type: Date },
    dueDate: { type: Date, required: true },
    isPaid: { type: Boolean, required: true, default: false },
  },
  { timestamps: true }
);

export default model<IEmployeePayment>('EmployeeSalaryPayment', EmployeePaymentSchema);