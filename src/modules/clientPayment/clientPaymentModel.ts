import { Schema, model, Document, Types } from 'mongoose';

export interface IClientPayment extends Document {
  clientId: Types.ObjectId;
  monthYear: string; 
  amountPaid: number;
  remainingBalance: number;
  paymentType: 'card' | 'cash' | 'bank_transfer' | 'online';
  paymentScreenshotUrl?: string;
  cloudinaryPublicId?: string | null;
  paymentDate: Date;
  status: 'paid' | 'partial' | 'pending';
}

const ClientPaymentSchema = new Schema<IClientPayment>(
  {
    clientId: { type: Schema.Types.ObjectId, ref: 'Client', required: true },
    monthYear: { type: String, required: true }, 
    amountPaid: { type: Number, required: true, default: 0 },
    remainingBalance: { type: Number, required: true, default: 0 },
    paymentType: { type: String, enum: ['card', 'cash', 'bank_transfer', 'online'], required: true },
    paymentScreenshotUrl: { type: String },
    cloudinaryPublicId: { type: String, default: null },
    paymentDate: { type: Date, required: true, default: Date.now },
    status: { type: String, enum: ['paid', 'partial', 'pending'], default: 'pending' },
  },
  { timestamps: true }
);

export const ClientPayment = model<IClientPayment>('ClientPayment', ClientPaymentSchema);