import { RequestHandler } from 'express';
import { ZodType, ZodError } from 'zod';
import ErrorHandler from '../utils/errorHandler';

export const validate = (schema: ZodType): RequestHandler => {
  return async (req, res, next): Promise<void> => {
    try {
      const validatedData = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      if (typeof validatedData === 'object' && validatedData !== null && 'body' in validatedData) {
        req.body = validatedData.body;
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errorMessages = error.issues.map((err) => err.message).join(', ');
        return next(new ErrorHandler(errorMessages, 400));
      }
      next(error);
    }
  };
};