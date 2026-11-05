import { RequestHandler } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import User, { IUser } from '../modules/user/userModel';
import ErrorHandler from '../utils/errorHandler';
import HandleAsyncError from '../middleware/handleAsyncError';

declare global {
  namespace Express {
    interface Request {
      user?: IUser;
      cookies: {
        token?: string;
        [key: string]: any;
      };
    }
  }
}

export const isAuthenticatedUser: RequestHandler = HandleAsyncError(
  async (req, res, next) => {
    const { token } = req.cookies;

    if (!token) {
      return next(new ErrorHandler('Please login to access this resource', 401));
    }

    const decodedData = jwt.verify(
      token,
      process.env.JWT_SECRET as string
    ) as JwtPayload & { id: string };

    const user = await User.findById(decodedData.id);

    if (!user) {
      return next(new ErrorHandler('User not found', 404));
    }

    req.user = user;
    next();
  }
);