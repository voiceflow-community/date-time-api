import { config } from '../config/index';
import { logger } from './logger';

/**
 * Performance metrics interface
 */
interface PerformanceMetrics {
  // Request metrics
  totalRequests: number;
  requestsPerSecond: number;
  averageResponseTime: number;
  errorRate: number;
  
  // System metrics
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage: NodeJS.CpuUsage;
  uptime: number;
  
  // API specific metrics
  endpointStats: Record<string, EndpointStats>;
  
  // Health metrics
  healthCheckCount: number;
  lastHealthCheck: string;
}

/**
 * Endpoint statistics
 */
interface EndpointStats {
  count: number;
  totalTime: number;
  averageTime: number;
  errors: number;
  lastAccessed: string;
}

/**
 * Metrics collector class
 */
class MetricsCollector {
  private metrics: PerformanceMetrics;
  private startTime: number;
  private requestTimes: number[] = [];
  private maxRequestTimes = 1000; // Keep last 1000 request times for average calculation

  constructor() {
    this.startTime = Date.now();
    this.metrics = {
      totalRequests: 0,
      requestsPerSecond: 0,
      averageResponseTime: 0,
      errorRate: 0,
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
      uptime: 0,
      endpointStats: {},
      healthCheckCount: 0,
      lastHealthCheck: new Date().toISOString(),
    };

    // Start periodic metrics collection if enabled
    if (config.METRICS_ENABLED) {
      this.startPeriodicCollection();
    }
  }

  /**
   * Record a request
   */
  recordRequest(method: string, path: string, statusCode: number, responseTime: number): void {
    this.metrics.totalRequests++;
    
    // Update request times for average calculation
    this.requestTimes.push(responseTime);
    if (this.requestTimes.length > this.maxRequestTimes) {
      this.requestTimes.shift();
    }
    
    // Update average response time
    this.metrics.averageResponseTime = 
      this.requestTimes.reduce((sum, time) => sum + time, 0) / this.requestTimes.length;
    
    // Update requests per second (based on last minute)
    const uptimeSeconds = (Date.now() - this.startTime) / 1000;
    this.metrics.requestsPerSecond = this.metrics.totalRequests / uptimeSeconds;
    
    // Update endpoint statistics
    const endpointKey = `${method} ${path}`;
    if (!this.metrics.endpointStats[endpointKey]) {
      this.metrics.endpointStats[endpointKey] = {
        count: 0,
        totalTime: 0,
        averageTime: 0,
        errors: 0,
        lastAccessed: new Date().toISOString(),
      };
    }
    
    const endpointStats = this.metrics.endpointStats[endpointKey];
    endpointStats.count++;
    endpointStats.totalTime += responseTime;
    endpointStats.averageTime = endpointStats.totalTime / endpointStats.count;
    endpointStats.lastAccessed = new Date().toISOString();
    
    // Record errors
    if (statusCode >= 400) {
      endpointStats.errors++;
    }
    
    // Update error rate
    const totalErrors = Object.values(this.metrics.endpointStats)
      .reduce((sum, stats) => sum + stats.errors, 0);
    this.metrics.errorRate = (totalErrors / this.metrics.totalRequests) * 100;
  }

  /**
   * Record health check
   */
  recordHealthCheck(): void {
    this.metrics.healthCheckCount++;
    this.metrics.lastHealthCheck = new Date().toISOString();
  }

  /**
   * Update system metrics
   */
  updateSystemMetrics(): void {
    this.metrics.memoryUsage = process.memoryUsage();
    this.metrics.cpuUsage = process.cpuUsage();
    this.metrics.uptime = process.uptime();
  }

  /**
   * Get current metrics
   */
  getMetrics(): PerformanceMetrics {
    this.updateSystemMetrics();
    return { ...this.metrics };
  }

  /**
   * Get metrics in Prometheus format
   */
  getPrometheusMetrics(): string {
    this.updateSystemMetrics();
    
    const lines: string[] = [];
    
    // Request metrics
    lines.push(`# HELP timezone_api_requests_total Total number of requests`);
    lines.push(`# TYPE timezone_api_requests_total counter`);
    lines.push(`timezone_api_requests_total ${this.metrics.totalRequests}`);
    
    lines.push(`# HELP timezone_api_requests_per_second Requests per second`);
    lines.push(`# TYPE timezone_api_requests_per_second gauge`);
    lines.push(`timezone_api_requests_per_second ${this.metrics.requestsPerSecond.toFixed(2)}`);
    
    lines.push(`# HELP timezone_api_response_time_avg Average response time in milliseconds`);
    lines.push(`# TYPE timezone_api_response_time_avg gauge`);
    lines.push(`timezone_api_response_time_avg ${this.metrics.averageResponseTime.toFixed(2)}`);
    
    lines.push(`# HELP timezone_api_error_rate Error rate percentage`);
    lines.push(`# TYPE timezone_api_error_rate gauge`);
    lines.push(`timezone_api_error_rate ${this.metrics.errorRate.toFixed(2)}`);
    
    // System metrics
    lines.push(`# HELP timezone_api_memory_usage_bytes Memory usage in bytes`);
    lines.push(`# TYPE timezone_api_memory_usage_bytes gauge`);
    lines.push(`timezone_api_memory_usage_bytes{type="rss"} ${this.metrics.memoryUsage.rss}`);
    lines.push(`timezone_api_memory_usage_bytes{type="heapTotal"} ${this.metrics.memoryUsage.heapTotal}`);
    lines.push(`timezone_api_memory_usage_bytes{type="heapUsed"} ${this.metrics.memoryUsage.heapUsed}`);
    
    lines.push(`# HELP timezone_api_uptime_seconds Application uptime in seconds`);
    lines.push(`# TYPE timezone_api_uptime_seconds gauge`);
    lines.push(`timezone_api_uptime_seconds ${this.metrics.uptime.toFixed(2)}`);
    
    // Endpoint metrics
    lines.push(`# HELP timezone_api_endpoint_requests_total Requests per endpoint`);
    lines.push(`# TYPE timezone_api_endpoint_requests_total counter`);
    
    Object.entries(this.metrics.endpointStats).forEach(([endpoint, stats]) => {
      const [method, path] = endpoint.split(' ', 2);
      lines.push(`timezone_api_endpoint_requests_total{method="${method}",path="${path}"} ${stats.count}`);
    });
    
    lines.push(`# HELP timezone_api_endpoint_response_time_avg Average response time per endpoint`);
    lines.push(`# TYPE timezone_api_endpoint_response_time_avg gauge`);
    
    Object.entries(this.metrics.endpointStats).forEach(([endpoint, stats]) => {
      const [method, path] = endpoint.split(' ', 2);
      lines.push(`timezone_api_endpoint_response_time_avg{method="${method}",path="${path}"} ${stats.averageTime.toFixed(2)}`);
    });
    
    return lines.join('\n') + '\n';
  }

  /**
   * Start periodic metrics collection
   */
  private startPeriodicCollection(): void {
    // Log metrics every 60 seconds
    setInterval(() => {
      const metrics = this.getMetrics();
      logger.logMetrics({
        totalRequests: metrics.totalRequests,
        requestsPerSecond: parseFloat(metrics.requestsPerSecond.toFixed(2)),
        averageResponseTime: parseFloat(metrics.averageResponseTime.toFixed(2)),
        errorRate: parseFloat(metrics.errorRate.toFixed(2)),
        memoryUsageMB: Math.round(metrics.memoryUsage.heapUsed / 1024 / 1024),
        uptime: Math.round(metrics.uptime),
      });
    }, 60000);
  }

  /**
   * Reset metrics (useful for testing)
   */
  reset(): void {
    this.startTime = Date.now();
    this.requestTimes = [];
    this.metrics = {
      totalRequests: 0,
      requestsPerSecond: 0,
      averageResponseTime: 0,
      errorRate: 0,
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
      uptime: 0,
      endpointStats: {},
      healthCheckCount: 0,
      lastHealthCheck: new Date().toISOString(),
    };
  }
}

/**
 * Global metrics collector instance
 */
export const metricsCollector = new MetricsCollector();

/**
 * Metrics middleware
 */
export function createMetricsMiddleware() {
  return (req: any, res: any, next: any) => {
    const startTime = Date.now();
    
    // Override res.end to capture metrics
    const originalEnd = res.end;
    res.end = function(chunk?: any, encoding?: any) {
      const responseTime = Date.now() - startTime;
      
      // Record request metrics
      metricsCollector.recordRequest(
        req.method,
        req.route?.path || req.path || req.url,
        res.statusCode,
        responseTime
      );
      
      return originalEnd.call(this, chunk, encoding);
    };

    next();
  };
}

/**
 * Get formatted metrics for health check
 */
export function getHealthMetrics() {
  const metrics = metricsCollector.getMetrics();
  
  return {
    requests: {
      total: metrics.totalRequests,
      perSecond: parseFloat(metrics.requestsPerSecond.toFixed(2)),
      averageResponseTime: parseFloat(metrics.averageResponseTime.toFixed(2)),
      errorRate: parseFloat(metrics.errorRate.toFixed(2)),
    },
    system: {
      uptime: Math.round(metrics.uptime),
      memoryUsage: {
        heapUsed: Math.round(metrics.memoryUsage.heapUsed / 1024 / 1024), // MB
        heapTotal: Math.round(metrics.memoryUsage.heapTotal / 1024 / 1024), // MB
        rss: Math.round(metrics.memoryUsage.rss / 1024 / 1024), // MB
      },
    },
    endpoints: Object.entries(metrics.endpointStats).reduce((acc, [endpoint, stats]) => {
      acc[endpoint] = {
        count: stats.count,
        averageTime: parseFloat(stats.averageTime.toFixed(2)),
        errors: stats.errors,
        lastAccessed: stats.lastAccessed,
      };
      return acc;
    }, {} as Record<string, any>),
  };
}