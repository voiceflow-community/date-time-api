import { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';
import { ValidationError, ErrorResponse } from '../types/index';

/**
 * Middleware factory for Zod validation
 * Creates middleware that validates request data against provided Zod schemas
 */
export function validateRequest(schemas: {
  body?: z.ZodSchema;
  params?: z.ZodSchema;
  query?: z.ZodSchema;
}) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Validate request body if schema provided
      if (schemas.body) {
        req.body = schemas.body.parse(req.body);
      }

      // Validate request params if schema provided
      if (schemas.params) {
        req.params = schemas.params.parse(req.params) as any;
      }

      // Validate request query if schema provided
      if (schemas.query) {
        req.query = schemas.query.parse(req.query) as any;
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const validationErrors: ValidationError[] = (error.issues || []).map((err) => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code
        }));

        const errorResponse: ErrorResponse = {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed',
            details: validationErrors,
            timestamp: new Date().toISOString()
          }
        };

        res.status(400).json(errorResponse);
        return;
      }

      // Pass unexpected errors to error handler
      next(error);
    }
  };
}

/**
 * Middleware for validating request body only
 */
export function validateBody(schema: z.ZodSchema) {
  return validateRequest({ body: schema });
}

/**
 * Middleware for validating request params only
 */
export function validateParams(schema: z.ZodSchema) {
  return validateRequest({ params: schema });
}

/**
 * Middleware for validating request query only
 */
export function validateQuery(schema: z.ZodSchema) {
  return validateRequest({ query: schema });
}