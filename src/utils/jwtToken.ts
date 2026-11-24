import { Response } from 'express';
import { IUser } from '../modules/user/userModel'; 

export const sendToken = (user: IUser, statusCode: number, res: Response): void => {
  const token = user.getJWTToken();

  const cookieExpireDays = Number(process.env.COOKIE_EXPIRES) || 7;

  const options = {
    expires: new Date(
      Date.now() + cookieExpireDays * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: (process.env.NODE_ENV === 'production' ? 'none' : 'lax') as 'none' | 'lax',
    domain:
      process.env.NODE_ENV === 'production' ? '.apexmarketing.cc' : undefined,
  };

  res.status(statusCode).cookie('token', token, options).json({
    success: true,
    token,
    user,
  });
};

export default sendToken;