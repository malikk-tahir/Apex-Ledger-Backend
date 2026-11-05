import { Schema, model, Document } from 'mongoose';

export interface IEmployee extends Document {
  name: string;
  contact: string;
  designation: string;
  baseSalary: number;
  startDay: number; 
  isActive: boolean;
  createdAt: Date;
}

const EmployeeSchema = new Schema<IEmployee>(
  {
    name: { type: String, required: true, trim: true },
    contact: { type: String, required: true },
    designation: { type: String, required: true },
    baseSalary: { type: Number, required: true },
    startDay: { type: Number, required: true, default: 1 }, // e.g., 15 for 15th-to-15th
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default model<IEmployee>('Employee', EmployeeSchema);