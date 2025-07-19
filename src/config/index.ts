import { z } from 'zod';

/**
 * Environment configuration schema with validation
 */
const configSchema = z.object({
  // Application Configuration
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().min(1).max(65535).default(3000),
  HOST: z.string().default('localhost'),
  HTTPS: z.string().default('false').transform(val => val === 'true'),
  PRODUCTION_URL: z.string().optional(),
  SWAGGER_SHOW_ONLY_PRODUCTION: z.string().default('false').transform(val => val === 'true'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  
  // API Configuration
  API_RATE_LIMIT_WINDOW_MS: z.coerce.number().min(1000).default(15 * 60 * 1000), // 15 minutes
  API_RATE_LIMIT_MAX_REQUESTS: z.coerce.number().min(1).default(100),
  
  // Security Configuration
  CORS_ORIGIN: z.string().default('*'),
  HELMET_ENABLED: z.coerce.boolean().default(true),
  
  // Health Check Configuration
  HEALTH_CHECK_TIMEOUT: z.coerce.number().min(1000).default(5000),
  
  // Logging Configuration
  LOG_FORMAT: z.enum(['json', 'text']).default('text'),
  LOG_FILE_ENABLED: z.coerce.boolean().default(false),
  LOG_FILE_PATH: z.string().default('./logs/app.log'),
  LOG_MAX_FILES: z.coerce.number().min(1).default(5),
  LOG_MAX_SIZE: z.string().default('10m'),
  
  // Performance Monitoring
  METRICS_ENABLED: z.coerce.boolean().default(false),
  METRICS_PORT: z.coerce.number().min(1).max(65535).default(9090),
  METRICS_PATH: z.string().default('/metrics'),
  
  // Graceful Shutdown
  SHUTDOWN_TIMEOUT: z.coerce.number().min(1000).default(10000), // 10 seconds
  KEEP_ALIVE_TIMEOUT: z.coerce.number().min(1000).default(5000), // 5 seconds
});

/**
 * Configuration type derived from schema
 */
export type Config = z.infer<typeof configSchema>;

/**
 * Load and validate configuration from environment variables
 */
function loadConfig(): Config {
  try {
    const config = configSchema.parse(process.env);
    
    // Log configuration loading (only in development)
    if (config.NODE_ENV === 'development') {
      console.log('✅ Configuration loaded successfully');
      console.log('📋 Environment:', config.NODE_ENV);
      console.log('🚀 Port:', config.PORT);
      console.log('📊 Log Level:', config.LOG_LEVEL);
    }
    
    return config;
  } catch (error) {
    console.error('❌ Configuration validation failed:');
    if (error instanceof z.ZodError) {
      error.issues.forEach((err: any) => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
    } else {
      console.error(error);
    }
    process.exit(1);
  }
}

/**
 * Global configuration instance
 */
export const config = loadConfig();

/**
 * Environment-specific configuration helpers
 */
export const isDevelopment = config.NODE_ENV === 'development';
export const isProduction = config.NODE_ENV === 'production';
export const isTest = config.NODE_ENV === 'test';

/**
 * Get configuration for specific environment
 */
export function getEnvironmentConfig() {
  return {
    app: {
      name: 'timezone-api-server',
      version: process.env['npm_package_version'] || '1.0.0',
      environment: config.NODE_ENV,
      port: config.PORT,
      host: config.HOST,
      https: config.HTTPS,
      productionUrl: config.PRODUCTION_URL,
      swaggerShowOnlyProduction: config.SWAGGER_SHOW_ONLY_PRODUCTION,
    },
    api: {
      rateLimit: {
        windowMs: config.API_RATE_LIMIT_WINDOW_MS,
        maxRequests: config.API_RATE_LIMIT_MAX_REQUESTS,
      },
    },
    security: {
      corsOrigin: config.CORS_ORIGIN,
      helmetEnabled: config.HELMET_ENABLED,
    },
    logging: {
      level: config.LOG_LEVEL,
      format: config.LOG_FORMAT,
      fileEnabled: config.LOG_FILE_ENABLED,
      filePath: config.LOG_FILE_PATH,
      maxFiles: config.LOG_MAX_FILES,
      maxSize: config.LOG_MAX_SIZE,
    },
    monitoring: {
      metricsEnabled: config.METRICS_ENABLED,
      metricsPort: config.METRICS_PORT,
      metricsPath: config.METRICS_PATH,
    },
    shutdown: {
      timeout: config.SHUTDOWN_TIMEOUT,
      keepAliveTimeout: config.KEEP_ALIVE_TIMEOUT,
    },
    health: {
      timeout: config.HEALTH_CHECK_TIMEOUT,
    },
  };
}

/**
 * Validate required environment variables for production
 */
export function validateProductionConfig(): void {
  if (!isProduction) return;
  
  const requiredVars = ['NODE_ENV', 'PORT'];
  const missing = requiredVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables for production:');
    missing.forEach(varName => console.error(`  - ${varName}`));
    process.exit(1);
  }
  
  // Warn about insecure defaults in production
  if (config.CORS_ORIGIN === '*') {
    console.warn('⚠️  Warning: CORS_ORIGIN is set to "*" in production. Consider restricting to specific origins.');
  }
  
  if (config.LOG_LEVEL === 'debug') {
    console.warn('⚠️  Warning: LOG_LEVEL is set to "debug" in production. Consider using "info" or "warn".');
  }
}