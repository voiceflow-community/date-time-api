import { Request, Response, NextFunction } from 'express';
import { timezoneService, TimezoneError } from '../services/TimezoneService';
import { ErrorResponse } from '../types/index';

/**
 * Controller for handling current time requests
 * GET /api/time/current/{timezone}
 * POST /api/time/current with { "timezone": "..." }
 */
export async function getCurrentTime(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Extract timezone from either params (GET) or body (POST)
    let timezone: string;
    
    if (req.method === 'GET') {
      timezone = req.params.timezone;
    } else {
      // For POST requests
      timezone = req.body.timezone;
    }

    // Get current time from service (timezone is validated by middleware)
    const timeResponse = await timezoneService.getCurrentTime(timezone!);

    // Return successful response
    res.status(200).json(timeResponse);
  } catch (error) {
    // Handle TimezoneError specifically
    if (error instanceof TimezoneError) {
      const errorResponse: ErrorResponse = {
        error: {
          code: error.code,
          message: error.message,
          ...(error.details && { details: error.details }),
          timestamp: new Date().toISOString()
        }
      };

      res.status(error.statusCode).json(errorResponse);
      return;
    }

    // Pass unexpected errors to error handler middleware
    next(error);
  }
}

/**
 * Controller for handling time conversion requests
 * POST /api/time/convert
 */
export async function convertTime(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const conversionRequest = req.body;

    // Convert time using service
    const conversionResponse = await timezoneService.convertTime(conversionRequest);

    // Return successful response
    res.status(200).json(conversionResponse);
  } catch (error) {
    // Handle TimezoneError specifically
    if (error instanceof TimezoneError) {
      const errorResponse: ErrorResponse = {
        error: {
          code: error.code,
          message: error.message,
          ...(error.details && { details: error.details }),
          timestamp: new Date().toISOString()
        }
      };

      res.status(error.statusCode).json(errorResponse);
      return;
    }

    // Pass unexpected errors to error handler middleware
    next(error);
  }
}