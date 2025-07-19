# Environment Configuration Guide

This document provides detailed information about environment variables and configuration options for the Timezone API Server.

## 📋 Table of Contents

- [Environment Files](#environment-files)
- [Core Configuration](#core-configuration)
- [API Configuration](#api-configuration)
- [Security Configuration](#security-configuration)
- [Logging Configuration](#logging-configuration)
- [Monitoring Configuration](#monitoring-configuration)
- [Docker Configuration](#docker-configuration)
- [Environment Examples](#environment-examples)
- [Configuration Validation](#configuration-validation)

## 📁 Environment Files

### File Priority

The application loads environment variables in the following order (later files override earlier ones):

1. System environment variables
2. `.env` file (default)
3. `.env.local` file (local overrides, git-ignored)
4. `.env.{NODE_ENV}` file (environment-specific)
5. Command-line environment variables

### Environment File Examples

```bash
# Create environment files
cp .env.example .env                    # Default configuration
cp .env.example .env.development        # Development overrides
cp .env.example .env.staging           # Staging configuration
cp .env.example .env.production        # Production configuration
```

## ⚙️ Core Configuration

### NODE_ENV
- **Type**: String
- **Default**: `production`
- **Options**: `development`, `staging`, `production`, `test`
- **Description**: Application environment mode

```bash
NODE_ENV=production
```

**Effects by Environment:**
- `development`: Debug logging, detailed errors, hot reload support
- `staging`: Warning-level logging, limited error details
- `production`: Info-level logging, generic error messages, optimizations
- `test`: Minimal logging, test-specific configurations

### PORT
- **Type**: Number
- **Default**: `3000`
- **Range**: `1024-65535`
- **Description**: HTTP server port

```bash
PORT=3000
```

### HOST
- **Type**: String
- **Default**: `localhost`
- **Description**: Server host/interface to bind to

```bash
# Bind to localhost only (development)
HOST=localhost

# Bind to all interfaces (Docker/production)
HOST=0.0.0.0

# Bind to specific IP
HOST=192.168.1.100
```

### HTTPS
- **Type**: Boolean
- **Default**: `false`
- **Description**: Enable HTTPS protocol for server URLs

```bash
HTTPS=false
```

### PRODUCTION_URL
- **Type**: String
- **Optional**: Yes
- **Description**: Production server URL for Swagger documentation

```bash
PRODUCTION_URL=https://api.yourdomain.com
```

### LOG_LEVEL
- **Type**: String
- **Default**: `info`
- **Options**: `debug`, `info`, `warn`, `error`
- **Description**: Minimum logging level

```bash
LOG_LEVEL=info
```

**Log Levels:**
- `debug`: All messages (development only)
- `info`: Informational messages and above
- `warn`: Warning messages and above
- `error`: Error messages only

## 🔌 API Configuration

### API_RATE_LIMIT_WINDOW_MS
- **Type**: Number
- **Default**: `900000` (15 minutes)
- **Description**: Rate limiting time window in milliseconds

```bash
API_RATE_LIMIT_WINDOW_MS=900000
```

### API_RATE_LIMIT_MAX_REQUESTS
- **Type**: Number
- **Default**: `100`
- **Description**: Maximum requests per time window

```bash
API_RATE_LIMIT_MAX_REQUESTS=100
```

### API_REQUEST_TIMEOUT
- **Type**: Number
- **Default**: `30000` (30 seconds)
- **Description**: Request timeout in milliseconds

```bash
API_REQUEST_TIMEOUT=30000
```

### API_MAX_REQUEST_SIZE
- **Type**: String
- **Default**: `10mb`
- **Description**: Maximum request body size

```bash
API_MAX_REQUEST_SIZE=10mb
```

## 🔒 Security Configuration

### CORS_ORIGIN
- **Type**: String
- **Default**: `*`
- **Description**: CORS allowed origins (comma-separated for multiple)

```bash
# Allow all origins (development only)
CORS_ORIGIN=*

# Single origin
CORS_ORIGIN=https://yourdomain.com

# Multiple origins
CORS_ORIGIN=https://yourdomain.com,https://app.yourdomain.com
```

### HELMET_ENABLED
- **Type**: Boolean
- **Default**: `true`
- **Description**: Enable security headers via Helmet.js

```bash
HELMET_ENABLED=true
```

### TRUST_PROXY
- **Type**: Boolean/String
- **Default**: `false`
- **Description**: Trust proxy headers (for load balancers)

```bash
# Trust first proxy
TRUST_PROXY=true

# Trust specific proxy
TRUST_PROXY=127.0.0.1
```

### HEALTH_CHECK_TIMEOUT
- **Type**: Number
- **Default**: `5000` (5 seconds)
- **Description**: Health check timeout in milliseconds

```bash
HEALTH_CHECK_TIMEOUT=5000
```

## 📝 Logging Configuration

### LOG_FORMAT
- **Type**: String
- **Default**: `json`
- **Options**: `json`, `simple`, `combined`
- **Description**: Log output format

```bash
LOG_FORMAT=json
```

**Format Examples:**
- `json`: `{"level":"info","message":"Server started","timestamp":"2024-01-15T10:30:00.000Z"}`
- `simple`: `2024-01-15 10:30:00 [INFO] Server started`
- `combined`: Apache combined log format

### LOG_FILE_ENABLED
- **Type**: Boolean
- **Default**: `false`
- **Description**: Enable file logging

```bash
LOG_FILE_ENABLED=true
```

### LOG_FILE_PATH
- **Type**: String
- **Default**: `./logs/app.log`
- **Description**: Log file path

```bash
LOG_FILE_PATH=./logs/app.log
```

### LOG_MAX_FILES
- **Type**: Number
- **Default**: `5`
- **Description**: Maximum number of log files to keep

```bash
LOG_MAX_FILES=5
```

### LOG_MAX_SIZE
- **Type**: String
- **Default**: `10m`
- **Description**: Maximum log file size before rotation

```bash
LOG_MAX_SIZE=10m
```

## 📊 Monitoring Configuration

### METRICS_ENABLED
- **Type**: Boolean
- **Default**: `true`
- **Description**: Enable metrics collection

```bash
METRICS_ENABLED=true
```

### METRICS_PORT
- **Type**: Number
- **Default**: `9090`
- **Description**: Metrics server port (if separate from main port)

```bash
METRICS_PORT=9090
```

### METRICS_PATH
- **Type**: String
- **Default**: `/metrics`
- **Description**: Metrics endpoint path

```bash
METRICS_PATH=/metrics
```

### METRICS_COLLECT_DEFAULT
- **Type**: Boolean
- **Default**: `true`
- **Description**: Collect default Node.js metrics

```bash
METRICS_COLLECT_DEFAULT=true
```

## 🐳 Docker Configuration

### COMPOSE_PROJECT_NAME
- **Type**: String
- **Default**: `timezone-api`
- **Description**: Docker Compose project name

```bash
COMPOSE_PROJECT_NAME=timezone-api
```

### DOCKER_BUILDKIT
- **Type**: Boolean
- **Default**: `1`
- **Description**: Enable Docker BuildKit

```bash
DOCKER_BUILDKIT=1
```

## 🔧 Advanced Configuration

### Graceful Shutdown

### SHUTDOWN_TIMEOUT
- **Type**: Number
- **Default**: `10000` (10 seconds)
- **Description**: Graceful shutdown timeout in milliseconds

```bash
SHUTDOWN_TIMEOUT=10000
```

### KEEP_ALIVE_TIMEOUT
- **Type**: Number
- **Default**: `5000` (5 seconds)
- **Description**: HTTP keep-alive timeout in milliseconds

```bash
KEEP_ALIVE_TIMEOUT=5000
```

### Performance Tuning

### UV_THREADPOOL_SIZE
- **Type**: Number
- **Default**: `4`
- **Description**: Node.js thread pool size

```bash
UV_THREADPOOL_SIZE=8
```

### NODE_OPTIONS
- **Type**: String
- **Description**: Node.js runtime options

```bash
# Increase heap size
NODE_OPTIONS="--max-old-space-size=512"

# Enable experimental features
NODE_OPTIONS="--experimental-modules"
```

## 📝 Environment Examples

### Development Environment

```bash
# .env.development
NODE_ENV=development
PORT=3000
HOST=localhost
HTTPS=false
LOG_LEVEL=debug
LOG_FORMAT=simple

# API Configuration
API_RATE_LIMIT_MAX_REQUESTS=1000
API_REQUEST_TIMEOUT=60000

# Security (relaxed for development)
CORS_ORIGIN=*
HELMET_ENABLED=false

# Monitoring
METRICS_ENABLED=true
LOG_FILE_ENABLED=true
LOG_FILE_PATH=./logs/dev.log

# Docker
COMPOSE_PROJECT_NAME=timezone-api-dev
```

### Staging Environment

```bash
# .env.staging
NODE_ENV=staging
PORT=3000
HOST=0.0.0.0
HTTPS=false
PRODUCTION_URL=https://staging-api.yourdomain.com
LOG_LEVEL=warn
LOG_FORMAT=json

# API Configuration
API_RATE_LIMIT_MAX_REQUESTS=200
API_REQUEST_TIMEOUT=30000

# Security
CORS_ORIGIN=https://staging.yourdomain.com
HELMET_ENABLED=true
TRUST_PROXY=true

# Monitoring
METRICS_ENABLED=true
LOG_FILE_ENABLED=true
LOG_FILE_PATH=./logs/staging.log
LOG_MAX_FILES=10

# Docker
COMPOSE_PROJECT_NAME=timezone-api-staging
```

### Production Environment

```bash
# .env.production
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
HTTPS=true
PRODUCTION_URL=https://api.yourdomain.com
LOG_LEVEL=info
LOG_FORMAT=json

# API Configuration
API_RATE_LIMIT_WINDOW_MS=900000
API_RATE_LIMIT_MAX_REQUESTS=100
API_REQUEST_TIMEOUT=30000
API_MAX_REQUEST_SIZE=1mb

# Security
CORS_ORIGIN=https://yourdomain.com,https://app.yourdomain.com
HELMET_ENABLED=true
TRUST_PROXY=true
HEALTH_CHECK_TIMEOUT=3000

# Logging
LOG_FILE_ENABLED=true
LOG_FILE_PATH=/var/log/timezone-api/app.log
LOG_MAX_FILES=30
LOG_MAX_SIZE=50m

# Monitoring
METRICS_ENABLED=true
METRICS_COLLECT_DEFAULT=true

# Performance
SHUTDOWN_TIMEOUT=15000
KEEP_ALIVE_TIMEOUT=5000
UV_THREADPOOL_SIZE=8
NODE_OPTIONS="--max-old-space-size=256"

# Docker
COMPOSE_PROJECT_NAME=timezone-api-prod
```

### Testing Environment

```bash
# .env.test
NODE_ENV=test
PORT=0
LOG_LEVEL=error
LOG_FORMAT=simple

# Disable external services
METRICS_ENABLED=false
LOG_FILE_ENABLED=false

# Fast timeouts for testing
API_REQUEST_TIMEOUT=5000
HEALTH_CHECK_TIMEOUT=1000
SHUTDOWN_TIMEOUT=1000

# Security (disabled for testing)
HELMET_ENABLED=false
CORS_ORIGIN=*
```

## ✅ Configuration Validation

### Environment Validation Script

```bash
#!/bin/bash
# validate-env.sh

echo "Validating environment configuration..."

# Check required variables
REQUIRED_VARS=("NODE_ENV" "PORT")
for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        echo "❌ Required variable $var is not set"
        exit 1
    else
        echo "✅ $var=${!var}"
    fi
done

# Validate PORT range
if [ "$PORT" -lt 1024 ] || [ "$PORT" -gt 65535 ]; then
    echo "❌ PORT must be between 1024 and 65535"
    exit 1
fi

# Validate LOG_LEVEL
if [[ ! "$LOG_LEVEL" =~ ^(debug|info|warn|error)$ ]]; then
    echo "❌ LOG_LEVEL must be one of: debug, info, warn, error"
    exit 1
fi

# Validate NODE_ENV
if [[ ! "$NODE_ENV" =~ ^(development|staging|production|test)$ ]]; then
    echo "❌ NODE_ENV must be one of: development, staging, production, test"
    exit 1
fi

echo "✅ Environment configuration is valid"
```

### Runtime Configuration Check

The application includes built-in configuration validation:

```typescript
// Automatic validation on startup
validateProductionConfig();

// Manual validation
const config = getEnvironmentConfig();
console.log('Configuration loaded:', config);
```

### Docker Configuration Validation

```bash
# Validate Docker Compose configuration
docker compose config --quiet && echo "✅ Docker Compose config is valid"

# Check environment variable substitution
docker compose config | grep -A 10 environment
```

## 🔍 Debugging Configuration

### View Current Configuration

```bash
# View all environment variables
printenv | grep -E '^(NODE_ENV|PORT|LOG_|API_|CORS_|HELMET_|METRICS_)'

# View Docker Compose resolved configuration
docker compose config

# View application configuration (if endpoint exists)
curl http://localhost:3000/debug/config
```

### Configuration Troubleshooting

```bash
# Check if .env file is loaded
echo "NODE_ENV: $NODE_ENV"
echo "PORT: $PORT"

# Verify Docker environment
docker compose exec timezone-api printenv | grep NODE_ENV

# Test configuration changes
NODE_ENV=development LOG_LEVEL=debug npm run dev
```

## 🚨 Security Best Practices

### Production Security Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Configure specific `CORS_ORIGIN` (not `*`)
- [ ] Enable `HELMET_ENABLED=true`
- [ ] Set appropriate rate limits
- [ ] Use secure log file paths
- [ ] Enable `TRUST_PROXY` if behind load balancer
- [ ] Set reasonable timeouts
- [ ] Limit request body size
- [ ] Use environment-specific configuration files
- [ ] Never commit `.env` files to version control

### Environment File Security

```bash
# Secure environment files
chmod 600 .env*

# Add to .gitignore
echo ".env*" >> .gitignore
echo "!.env.example" >> .gitignore

# Use secrets management in production
# - Docker secrets
# - Kubernetes secrets
# - Cloud provider secret managers
```

---

**Remember**: Always validate your configuration before deploying to production!
