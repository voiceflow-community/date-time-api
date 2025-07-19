import { Request, Response } from 'express';
import { metricsCollector } from '../utils/metrics';
import { config } from '../config/index';

/**
 * Get Prometheus-style metrics
 * GET /metrics
 */
export async function getMetrics(_req: Request, res: Response): Promise<void> {
  try {
    // Check if metrics are enabled
    if (!config.METRICS_ENABLED) {
      res.status(404).json({
        error: {
          code: 'METRICS_DISABLED',
          message: 'Metrics collection is disabled',
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    // Get Prometheus-formatted metrics
    const prometheusMetrics = metricsCollector.getPrometheusMetrics();
    
    // Set appropriate content type for Prometheus
    res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.status(200).send(prometheusMetrics);
    
  } catch (error) {
    res.status(500).json({
      error: {
        code: 'METRICS_ERROR',
        message: 'Failed to retrieve metrics',
        timestamp: new Date().toISOString(),
      },
    });
  }
}

/**
 * Get JSON-formatted metrics for debugging
 * GET /metrics/json
 */
export async function getMetricsJson(_req: Request, res: Response): Promise<void> {
  try {
    // Check if metrics are enabled
    if (!config.METRICS_ENABLED) {
      res.status(404).json({
        error: {
          code: 'METRICS_DISABLED',
          message: 'Metrics collection is disabled',
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    // Get JSON-formatted metrics
    const metrics = metricsCollector.getMetrics();
    
    res.status(200).json({
      metrics,
      timestamp: new Date().toISOString(),
    });
    
  } catch (error) {
    res.status(500).json({
      error: {
        code: 'METRICS_ERROR',
        message: 'Failed to retrieve metrics',
        timestamp: new Date().toISOString(),
      },
    });
  }
}