import { RequestHandler } from "express";

const handleAsyncError = (handler: RequestHandler): RequestHandler =>
  (req, res, next): void => {
    Promise.resolve(handler(req, res, next)).catch(next);
};

export default handleAsyncError;
