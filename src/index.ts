import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { validateRequest } from './middleware/validation';
import { getCurrentTime, convertTime } from './controllers/timeController';
import { getHealth } from './controllers/healthController';
import { getMetrics, getMetricsJson } from './controllers/metricsController';
import { setupSwagger } from './swagger/setup';
import { timezoneParamSchema, conversionRequestSchema } from './types/index';
import { config, validateProductionConfig, getEnvironmentConfig } from './config/index';
import { logger, createRequestLogger } from './utils/logger';
import { createMetricsMiddleware } from './utils/metrics';
import { gracefulShutdown, createShutdownMiddleware } from './utils/gracefulShutdown';

// Validate production configuration
validateProductionConfig();

// Get environment configuration
const envConfig = getEnvironmentConfig();

// Create Express application
const app = express();
const PORT = config.PORT;

// Security middleware
if (envConfig.security.helmetEnabled) {
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
    crossOriginEmbedderPolicy: false
  }));
}

// CORS configuration
app.use(cors({
  origin: envConfig.security.corsOrigin,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false
}));

// Shutdown middleware (check if server is shutting down)
app.use(createShutdownMiddleware());

// Rate limiting middleware
const limiter = rateLimit({
  windowMs: envConfig.api.rateLimit.windowMs,
  max: envConfig.api.rateLimit.maxRequests,
  message: {
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many requests from this IP, please try again later',
      timestamp: new Date().toISOString()
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to API routes
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use(createRequestLogger());

// Metrics collection middleware
if (config.METRICS_ENABLED) {
  app.use(createMetricsMiddleware());
}

// Health check endpoint (no rate limiting)
app.get('/health', getHealth);

// Metrics endpoints (if enabled)
if (config.METRICS_ENABLED) {
  app.get('/metrics', getMetrics);
  app.get('/metrics/json', getMetricsJson);
}

// API Routes with validation middleware

// Current time endpoint
app.get(
  '/api/time/current/:timezone',
  validateRequest({ params: timezoneParamSchema }),
  getCurrentTime
);

// Time conversion endpoint
app.post(
  '/api/time/convert',
  validateRequest({ body: conversionRequestSchema }),
  convertTime
);

// Setup Swagger documentation
setupSwagger(app);

// 404 handler for unknown routes
app.use(notFoundHandler);

// Global error handling middleware (must be last)
app.use(errorHandler);

// Start server
const server = app.listen(PORT, () => {
  logger.logStartup(PORT);
  logger.info(`📚 API Documentation: http://localhost:${PORT}/api/docs`);
  logger.info(`❤️  Health Check: http://localhost:${PORT}/health`);
  
  if (config.METRICS_ENABLED) {
    logger.info(`📊 Metrics: http://localhost:${PORT}/metrics`);
  }
});

// Initialize graceful shutdown handler
gracefulShutdown.init(server);

export default app;