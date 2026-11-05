import { Schema, model, Document, Types } from 'mongoose';

export type BusinessCategory = 
  | 'Restaurant & Cafe'
  | 'Real Estate'
  | 'E-Commerce & Retail'
  | 'Health & Fitness'
  | 'Education'
  | 'Corporate & Professional Services'
  | 'Automotive'
  | 'Events & Entertainment'
  | 'Other'; 

export interface IClient extends Document {
  companyName: string;
  ownerName: string;
  category: BusinessCategory; 
  contact: string;
  address: string;
  type: 'retainer' | 'one_time';
  services: ('media' | 'graphic' | 'web' | 'package' | 'all')[];
  monthlyContractAmount: number;
  date: Date;
  createdAt: Date;
}

const ClientSchema = new Schema<IClient>(
  {
    companyName: { type: String, required: true, trim: true },
    ownerName: { type: String, required: true, trim: true },
    category: { 
    type: String, 
    required: true, 
    enum: [
        'Restaurant & Cafe', 
        'Real Estate', 
        'E-Commerce & Retail', 
        'Health & Fitness', 
        'Education', 
        'Corporate & Professional Services', 
        'Automotive', 
        'Events & Entertainment',
        'Other'
    ]},
    contact: { type: String, required: true },
    address: { type: String, required: true },
    type: { type: String, enum: ['retainer', 'one_time'], required: true },
    services: {
      type: [{ type: String, enum: ['media', 'graphic', 'web', 'package', 'all'] }],
      validate: [(v: string[]) => v.length > 0, 'Select at least one service'],
      required: true,
    },
    monthlyContractAmount: { type: Number, default: undefined},
    date: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true }
);

export default model<IClient>('Client', ClientSchema);