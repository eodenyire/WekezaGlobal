import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export interface AppError extends Error {
  statusCode?: number;
}

export function errorHandler(
  err: AppError | ZodError,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  // Handle Zod validation errors as 400 Bad Request
  if (err instanceof ZodError) {
    const message = err.errors.map((e) => e.message).join(', ');
    res.status(400).json({ error: 'BadRequest', message });
    return;
  }

  const appErr = err as AppError;
  const statusCode = appErr.statusCode ?? 500;
  const message = appErr.message || 'An unexpected error occurred';

  if (statusCode >= 500) {
    console.error('[Error]', err);
  }

  res.status(statusCode).json({
    error: statusCode === 500 ? 'InternalServerError' : appErr.name || 'Error',
    message,
  });
}

/** Helper to create a typed error with an HTTP status code. */
export function createError(message: string, statusCode = 500): AppError {
  const err = new Error(message) as AppError;
  err.statusCode = statusCode;
  err.name = httpStatusName(statusCode);
  return err;
}

function httpStatusName(code: number): string {
  const names: Record<number, string> = {
    400: 'BadRequest',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'NotFound',
    409: 'Conflict',
    422: 'UnprocessableEntity',
    429: 'TooManyRequests',
    500: 'InternalServerError',
    503: 'ServiceUnavailable',
  };
  return names[code] ?? 'Error';
}
