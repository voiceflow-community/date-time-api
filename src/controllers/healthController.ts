import { Request, Response, NextFunction } from 'express';
import { HealthResponse } from '../types/index';
import { timezoneService } from '../services/TimezoneService';
import { getHealthMetrics, metricsCollector } from '../utils/metrics';
import { gracefulShutdown } from '../utils/gracefulShutdown';
import { config, getEnvironmentConfig } from '../config/index';

// Store the start time when the module is loaded
// const startTime = Date.now(); // TODO: Use for uptime calculation

/**
 * Get service version from package.json
 */
// function getServiceVersion(): string {
//   try {
//     const packageJsonPath = path.join(process.cwd(), 'package.json');
//     const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
//     return packageJson.version || '1.0.0';
//   } catch (error) {
//     return '1.0.0';
//   }
// }

/**
 * Get detailed memory usage information
 */
function getDetailedMemoryUsage() {
  const memoryUsage = process.memoryUsage();
  const totalMemory = memoryUsage.heapTotal;
  const usedMemory = memoryUsage.heapUsed;
  const memoryPercentage = totalMemory > 0 ? Math.round((usedMemory / totalMemory) * 100) : 0;

  return {
    used: usedMemory,
    total: totalMemory,
    percentage: memoryPercentage,
    external: memoryUsage.external,
    arrayBuffers: memoryUsage.arrayBuffers,
    rss: memoryUsage.rss
  };
}

/**
 * Check if the service is healthy based on various metrics
 */
function determineServiceStatus(memoryPercentage: number, uptime: number): 'healthy' | 'degraded' | 'unhealthy' {
  // Consider service unhealthy if memory usage is above 90%
  if (memoryPercentage > 90) {
    return 'unhealthy';
  }
  
  // Consider service degraded if memory usage is above 75%
  if (memoryPercentage > 75) {
    return 'degraded';
  }
  
  // Consider service degraded if it just started (less than 10 seconds)
  if (uptime < 10) {
    return 'degraded';
  }
  
  return 'healthy';
}

/**
 * Controller for handling health check requests
 * GET /health
 * 
 * Returns detailed health information including:
 * - Service status (healthy/degraded/unhealthy)
 * - Uptime in seconds
 * - Memory usage statistics
 * - Service version
 * - Timestamp
 */
export async function getHealth(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Record health check
    metricsCollector.recordHealthCheck();
    
    let uptime = 0;
    let memoryInfo = { used: 0, total: 0, percentage: 0, external: 0, arrayBuffers: 0, rss: 0 };
    let serviceVersion = '1.0.0';
    let timezoneServiceHealth = { status: 'healthy', supportedTimezones: 0 };
    let hasErrors = false;

    // Get environment configuration
    const envConfig = getEnvironmentConfig();

    // Get process uptime in seconds
    try {
      uptime = process.uptime();
    } catch (error) {
      hasErrors = true;
    }

    // Get detailed memory usage information
    try {
      memoryInfo = getDetailedMemoryUsage();
    } catch (error) {
      hasErrors = true;
    }

    // Get service version
    try {
      serviceVersion = envConfig.app.version;
    } catch (error) {
      hasErrors = true;
    }

    // Get timezone service health
    try {
      timezoneServiceHealth = timezoneService.getServiceHealth();
    } catch (error) {
      hasErrors = true;
      timezoneServiceHealth = { status: 'unhealthy', supportedTimezones: 0 };
    }

    // Get performance metrics if enabled
    const performanceMetrics = config.METRICS_ENABLED ? getHealthMetrics() : undefined;
    
    // Get shutdown status
    const shutdownStatus = gracefulShutdown.getShutdownStatus();

    // Determine overall service status
    let serviceStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (shutdownStatus.isShuttingDown) {
      serviceStatus = 'degraded';
    } else if (hasErrors || timezoneServiceHealth.status === 'unhealthy') {
      serviceStatus = 'unhealthy';
    } else {
      serviceStatus = determineServiceStatus(memoryInfo.percentage, uptime);
    }

    // Build enhanced health response
    const healthResponse: any = {
      status: serviceStatus,
      uptime: Math.round(uptime),
      memory: {
        used: memoryInfo.used,
        total: memoryInfo.total,
        percentage: memoryInfo.percentage,
        rss: memoryInfo.rss
      },
      version: serviceVersion,
      environment: envConfig.app.environment,
      timestamp: new Date().toISOString(),
      services: {
        api: 'operational',
        timezone: timezoneServiceHealth.status === 'healthy' ? 'operational' : 
                 timezoneServiceHealth.status === 'degraded' ? 'degraded' : 'down'
      }
    };

    // Add performance metrics if enabled
    if (performanceMetrics) {
      healthResponse.performance = performanceMetrics;
    }

    // Add shutdown status if relevant
    if (shutdownStatus.isShuttingDown || shutdownStatus.activeConnections > 0) {
      healthResponse.shutdown = {
        isShuttingDown: shutdownStatus.isShuttingDown,
        activeConnections: shutdownStatus.activeConnections,
      };
    }

    // Set appropriate HTTP status code based on service status
    let statusCode = 200;
    if (serviceStatus === 'degraded') {
      statusCode = shutdownStatus.isShuttingDown ? 503 : 200;
    } else if (serviceStatus === 'unhealthy') {
      statusCode = 503;
    }

    res.status(statusCode).json(healthResponse);
  } catch (criticalError) {
    // If even the health check fails, return a minimal unhealthy response
    try {
      const emergencyResponse: HealthResponse = {
        status: 'unhealthy',
        uptime: 0,
        memory: {
          used: 0,
          total: 0,
          percentage: 0
        },
        version: '1.0.0',
        timestamp: new Date().toISOString()
      };
      
      res.status(503).json(emergencyResponse);
    } catch (finalError) {
      // If even the emergency response fails, pass to error handler middleware
      next(criticalError);
    }
  }
}