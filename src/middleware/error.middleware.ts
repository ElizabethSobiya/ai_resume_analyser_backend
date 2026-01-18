import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

interface ErrorResponse {
  success: false;
  error: {
    message: string;
    code?: string;
    details?: unknown;
  };
}

/**
 * Global error handler middleware
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response<ErrorResponse>,
  next: NextFunction
): void {
  console.error('Error:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: {
        message: 'Validation error',
        code: 'VALIDATION_ERROR',
        details: err.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      },
    });
    return;
  }

  // Handle Prisma errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002':
        res.status(409).json({
          success: false,
          error: {
            message: 'A record with this value already exists',
            code: 'DUPLICATE_ENTRY',
          },
        });
        return;
      case 'P2025':
        res.status(404).json({
          success: false,
          error: {
            message: 'Record not found',
            code: 'NOT_FOUND',
          },
        });
        return;
      default:
        res.status(500).json({
          success: false,
          error: {
            message: 'Database error',
            code: err.code,
          },
        });
        return;
    }
  }

  // Handle Multer file upload errors
  if (err.message.includes('File too large')) {
    res.status(413).json({
      success: false,
      error: {
        message: 'File size exceeds the 10MB limit',
        code: 'FILE_TOO_LARGE',
      },
    });
    return;
  }

  if (err.message.includes('Invalid file type')) {
    res.status(400).json({
      success: false,
      error: {
        message: err.message,
        code: 'INVALID_FILE_TYPE',
      },
    });
    return;
  }

  // Handle OpenAI API errors
  if (err.message.includes('OpenAI') || err.message.includes('API key')) {
    res.status(503).json({
      success: false,
      error: {
        message: 'AI service temporarily unavailable',
        code: 'AI_SERVICE_ERROR',
      },
    });
    return;
  }

  // Handle Pinecone errors
  if (err.message.includes('Pinecone') || err.message.includes('vector')) {
    res.status(503).json({
      success: false,
      error: {
        message: 'Vector search service temporarily unavailable',
        code: 'VECTOR_SERVICE_ERROR',
      },
    });
    return;
  }

  // Default error response
  const statusCode = (err as any).statusCode || 500;

  // Show actual error message for debugging (can be hidden later)
  res.status(statusCode).json({
    success: false,
    error: {
      message: err.message || 'An unexpected error occurred',
      code: 'INTERNAL_ERROR',
    },
  });
}

/**
 * Handle 404 errors for unknown routes
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: {
      message: `Route ${req.method} ${req.path} not found`,
      code: 'NOT_FOUND',
    },
  });
}

/**
 * Request logging middleware
 */
export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(
      `${req.method} ${req.path} ${res.statusCode} - ${duration}ms`
    );
  });

  next();
}
