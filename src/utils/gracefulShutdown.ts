import { Server } from 'http';
import { config } from '../config/index';
import { logger } from './logger';

/**
 * Graceful shutdown handler class
 */
class GracefulShutdownHandler {
  private server: Server | null = null;
  private isShuttingDown = false;
  private shutdownTimeout: NodeJS.Timeout | null = null;
  private connections = new Set<any>();

  /**
   * Initialize graceful shutdown handler
   */
  init(server: Server): void {
    this.server = server;
    
    // Track active connections
    server.on('connection', (connection) => {
      this.connections.add(connection);
      connection.on('close', () => {
        this.connections.delete(connection);
      });
    });

    // Set keep-alive timeout
    server.keepAliveTimeout = config.KEEP_ALIVE_TIMEOUT;
    server.headersTimeout = config.KEEP_ALIVE_TIMEOUT + 1000;

    // Register shutdown handlers
    this.registerShutdownHandlers();
    
    logger.info('✅ Graceful shutdown handler initialized', {
      shutdownTimeout: config.SHUTDOWN_TIMEOUT,
      keepAliveTimeout: config.KEEP_ALIVE_TIMEOUT,
    });
  }

  /**
   * Register process signal handlers
   */
  private registerShutdownHandlers(): void {
    // Handle SIGTERM (Docker, Kubernetes)
    process.on('SIGTERM', () => {
      logger.info('📨 SIGTERM received, initiating graceful shutdown');
      this.shutdown('SIGTERM');
    });

    // Handle SIGINT (Ctrl+C)
    process.on('SIGINT', () => {
      logger.info('📨 SIGINT received, initiating graceful shutdown');
      this.shutdown('SIGINT');
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error: Error) => {
      logger.error('💥 Uncaught Exception detected', {
        name: error.name,
        message: error.message,
        stack: error.stack,
      }, error);
      
      this.shutdown('uncaughtException');
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
      logger.error('💥 Unhandled Promise Rejection detected', {
        reason: reason instanceof Error ? reason.message : String(reason),
        stack: reason instanceof Error ? reason.stack : undefined,
        promise: promise.toString(),
      });
      
      // In production, don't exit on unhandled rejection, just log
      if (config.NODE_ENV !== 'production') {
        this.shutdown('unhandledRejection');
      }
    });

    // Handle process warnings
    process.on('warning', (warning) => {
      logger.warn('⚠️  Process warning', {
        name: warning.name,
        message: warning.message,
        stack: warning.stack,
      });
    });
  }

  /**
   * Initiate graceful shutdown
   */
  private async shutdown(reason: string): Promise<void> {
    if (this.isShuttingDown) {
      logger.warn('🔄 Shutdown already in progress, ignoring signal');
      return;
    }

    this.isShuttingDown = true;
    logger.logShutdown(reason);

    // Set shutdown timeout
    this.shutdownTimeout = setTimeout(() => {
      logger.error('⏰ Shutdown timeout reached, forcing exit');
      this.forceExit(1);
    }, config.SHUTDOWN_TIMEOUT);

    try {
      // Step 1: Stop accepting new connections
      if (this.server) {
        logger.info('🚫 Stopping server from accepting new connections');
        this.server.close(() => {
          logger.info('✅ Server stopped accepting new connections');
        });
      }

      // Step 2: Wait for existing connections to finish
      await this.waitForConnections();

      // Step 3: Perform cleanup tasks
      await this.performCleanup();

      // Step 4: Clear shutdown timeout and exit gracefully
      if (this.shutdownTimeout) {
        clearTimeout(this.shutdownTimeout);
      }

      logger.info('✅ Graceful shutdown completed successfully');
      process.exit(0);

    } catch (error) {
      logger.error('❌ Error during graceful shutdown', {}, error as Error);
      this.forceExit(1);
    }
  }

  /**
   * Wait for existing connections to finish
   */
  private async waitForConnections(): Promise<void> {
    if (this.connections.size === 0) {
      logger.info('✅ No active connections to wait for');
      return;
    }

    logger.info(`⏳ Waiting for ${this.connections.size} active connections to finish`);

    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (this.connections.size === 0) {
          clearInterval(checkInterval);
          logger.info('✅ All connections finished');
          resolve();
        } else {
          logger.debug(`⏳ Still waiting for ${this.connections.size} connections`);
        }
      }, 1000);

      // Force close connections after half the shutdown timeout
      setTimeout(() => {
        if (this.connections.size > 0) {
          logger.warn(`🔨 Force closing ${this.connections.size} remaining connections`);
          this.connections.forEach(connection => {
            connection.destroy();
          });
          this.connections.clear();
          clearInterval(checkInterval);
          resolve();
        }
      }, config.SHUTDOWN_TIMEOUT / 2);
    });
  }

  /**
   * Perform cleanup tasks
   */
  private async performCleanup(): Promise<void> {
    logger.info('🧹 Performing cleanup tasks');

    // Add any cleanup tasks here, such as:
    // - Closing database connections
    // - Flushing logs
    // - Saving state
    // - Notifying external services

    // For now, just a simple delay to simulate cleanup
    await new Promise(resolve => setTimeout(resolve, 100));

    logger.info('✅ Cleanup tasks completed');
  }

  /**
   * Force exit the process
   */
  private forceExit(code: number): void {
    logger.error(`🚨 Force exiting with code ${code}`);
    process.exit(code);
  }

  /**
   * Check if shutdown is in progress
   */
  isShutdownInProgress(): boolean {
    return this.isShuttingDown;
  }

  /**
   * Get shutdown status for health checks
   */
  getShutdownStatus() {
    return {
      isShuttingDown: this.isShuttingDown,
      activeConnections: this.connections.size,
      shutdownTimeout: config.SHUTDOWN_TIMEOUT,
    };
  }
}

/**
 * Global graceful shutdown handler instance
 */
export const gracefulShutdown = new GracefulShutdownHandler();

/**
 * Middleware to check if server is shutting down
 */
export function createShutdownMiddleware() {
  return (_req: any, res: any, next: any) => {
    if (gracefulShutdown.isShutdownInProgress()) {
      res.status(503).json({
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Server is shutting down, please try again later',
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }
    next();
  };
}