'use strict';

/**
 * Centralized error handler for Express 5.
 * Returns structured JSON errors with appropriate HTTP status codes.
 *
 * @param {Error} err
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function errorHandler(err, req, res, next) {
  const status = err.status ?? err.statusCode ?? 500;
  const message = err.message ?? 'Internal server error';

  if (process.env.NODE_ENV !== 'production') {
    console.error(`[error] ${req.method} ${req.url} → ${status}: ${message}`);
    if (err.stack) console.error(err.stack);
  }

  res.status(status).json({
    error: message,
    ...(process.env.NODE_ENV !== 'production' ? { stack: err.stack } : {}),
  });
}

module.exports = { errorHandler };
