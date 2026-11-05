import { RequestHandler } from 'express';
import ErrorHandler from '../../utils/errorHandler';
import HandleAsyncError from '../../middleware/handleAsyncError';
import User from './userModel';
import sendToken from '../../utils/jwtToken';

export const loginUser: RequestHandler = HandleAsyncError(async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return next(new ErrorHandler('Please enter email and password', 400));
  }

  const user = await User.findOne({ email }).select('+password');

  if (!user) {
    return next(new ErrorHandler('Invalid email', 401));
  }

  const isPasswordMatched = await user.comparePassword(password);

  if (!isPasswordMatched) {
    return next(new ErrorHandler('Invalid password', 401));
  }

  sendToken(user, 200, res);
});

export const logout: RequestHandler = HandleAsyncError(async (req, res, next) => {
  res.cookie('token', '', {
    expires: new Date(0),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    domain:
      process.env.NODE_ENV === 'production' ? '' : undefined,
  });

  res.status(200).json({
    success: true,
    message: 'Logged out',
  });
});

export const getCurrentUser: RequestHandler = HandleAsyncError(async (req, res, next) => {
  const user = await User.findById(req.user?._id);

  res.status(200).json({
    success: true,
    user,
  });
});