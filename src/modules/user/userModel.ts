import mongoose, { Document, Model, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import validator from 'validator';

// 1. Define the TypeScript interface for the User Document
export interface IUser extends Document {
  name: string;
  email: string;
  mobile_no: string;
  password: string;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(enteredPassword: string): Promise<boolean>;
  getJWTToken(): string;
}

interface IUserModel extends Model<IUser> {}

const UserSchema = new Schema<IUser, IUserModel>(
  {
    name: {
      type: String,
      required: [true, 'Please provide full name'],
      trim: true,
    },

    email: {
      type: String,
      required: [true, 'Please provide email'],
      unique: true,
      lowercase: true,
      trim: true,
      validate: [validator.isEmail, 'Please provide a valid email'],
    },

    mobile_no: {
      type: String,
      required: [true, 'Mobile number is required'],
      match: [
        /^(\+92|0|92)[0-9]{10}$/,
        'Please provide a valid Pakistani mobile number',
      ],
    },

    password: {
      type: String,
      required: [true, 'Please provide password'],
      minlength: [4, 'Password must be at least 4 characters'],
      select: false,
    },
  },
  {
    timestamps: true,
  }
);

// 4. Pre-save hook for password hashing
UserSchema.pre<IUser>('save', async function (next) {
  if (!this.isModified('password')) {
    return 
  }
  this.password = await bcrypt.hash(this.password, 10);
//   next();
});

// 5. Instance method to compare passwords
UserSchema.methods.comparePassword = async function (enteredPassword: string): Promise<boolean> {
  return await bcrypt.compare(enteredPassword, this.password);
};

// 6. Instance method to generate JWT token
UserSchema.methods.getJWTToken = function (): string {
  return jwt.sign({ id: this._id }, process.env.JWT_SECRET as string, {
    expiresIn: process.env.JWT_EXPIRES_TIME as string,
  } as jwt.SignOptions);
};

export default mongoose.model<IUser, IUserModel>('User', UserSchema);