import { Response } from 'express';

export const ok = (res: Response, data: any = {}, message?: string) => {
  return res.json({
    success: true,
    ...(message ? { message } : {}),
    ...data
  });
};

export const fail = (res: Response, status: number, message: string) => {
  return res.status(status).json({
    success: false,
    message
  });
};