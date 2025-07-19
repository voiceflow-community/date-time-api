# Dynamic Swagger Server URLs

This document explains the dynamic server URL feature implemented for the Swagger/OpenAPI documentation.

## 🎯 Overview

The Swagger documentation now automatically detects and displays the correct server URLs based on your current environment configuration. This is especially useful when deploying to different environments (development, staging, production) or when using Docker containers.

## 🔧 Configuration

### Environment Variables

Configure server URLs using these environment variables:

| Variable         | Type    | Default     | Description                      |
| ---------------- | ------- | ----------- | -------------------------------- |
| `HOST`           | string  | `localhost` | Server host/interface to bind to |
| `PORT`           | number  | `3000`      | Server port                      |
| `HTTPS`          | boolean | `false`     | Enable HTTPS protocol            |
| `PRODUCTION_URL` | string  | optional    | Custom production URL            |

### Examples

#### Development (Local)
```bash
NODE_ENV=development
HOST=localhost
PORT=3000
HTTPS=false
```
**Result**: Shows `http://localhost:3000` and `http://0.0.0.0:3000`

#### Development (Docker)
```bash
NODE_ENV=development
HOST=0.0.0.0
PORT=3000
HTTPS=false
```
**Result**: Shows `http://0.0.0.0:3000` and `http://localhost:3000`

#### Production
```bash
NODE_ENV=production
HOST=0.0.0.0
PORT=3000
HTTPS=true
PRODUCTION_URL=https://api.example.com
```
**Result**: Shows `https://0.0.0.0:3000` and `https://api.example.com`

## 🐳 Docker Usage

### Docker Compose

The Docker Compose files have been updated to support the new environment variables:

```yaml
environment:
  - NODE_ENV=${NODE_ENV:-production}
  - HOST=${HOST:-0.0.0.0}
  - HTTPS=${HTTPS:-false}
  - PRODUCTION_URL=${PRODUCTION_URL}
```

### Example .env for Docker

```bash
# .env
NODE_ENV=production
HOST=0.0.0.0
PORT=3000
HTTPS=false
PRODUCTION_URL=https://your-domain.com
```

## 🧪 Testing

A test script is included to verify the dynamic URL generation:

```bash
# Run the test script
node test-swagger-config.js
```

This will test different environment configurations and show the generated server URLs.

## 📋 How It Works

1. **Configuration Loading**: Environment variables are loaded and validated using Zod schemas
2. **URL Generation**: The `generateServerUrls()` function creates appropriate server URLs based on:
   - Current environment (development/production)
   - Host and port configuration
   - HTTPS setting
   - Custom production URL (if provided)
3. **Deduplication**: Duplicate URLs are automatically removed
4. **Dynamic Updates**: URLs are generated at runtime, so changes to environment variables are reflected immediately

## 🔍 Implementation Details

### Key Files Modified

- `src/config/index.ts` - Added new environment variables
- `src/swagger/openapi.ts` - Implemented dynamic URL generation
- `src/swagger/setup.ts` - Enhanced logging for available servers
- `.env.example` - Added new environment variables
- `docker-compose.yml` - Updated environment configuration
- `ENVIRONMENT.md` - Documented new configuration options

### Code Structure

```typescript
function generateServerUrls(): OpenAPIV3.ServerObject[] {
  // Generate current server URL
  const currentUrl = `${protocol}://${host}:${port}`;
  
  // Add environment-specific alternatives
  // Remove duplicates
  // Return server list
}
```

## 🚀 Benefits

1. **Environment Awareness**: Automatically adapts to different deployment environments
2. **Docker Friendly**: Works seamlessly with containerized deployments
3. **Developer Experience**: No manual URL updates needed when switching environments
4. **Production Ready**: Supports custom production URLs for proper documentation
5. **Flexible**: Supports both HTTP and HTTPS configurations

## 🔧 Troubleshooting

### Common Issues

1. **Wrong Protocol**: Check `HTTPS` environment variable
2. **Incorrect Host**: Verify `HOST` setting (use `0.0.0.0` for Docker)
3. **Missing Production URL**: Set `PRODUCTION_URL` for production environments
4. **Port Conflicts**: Ensure `PORT` matches your server configuration

### Debug Commands

```bash
# Check current configuration
curl http://localhost:3000/api/docs/openapi.json | jq '.servers'

# Test configuration
node test-swagger-config.js

# Validate Docker Compose
docker compose config
```

## 📚 Related Documentation

- [Environment Configuration](ENVIRONMENT.md)
- [Docker Deployment](DOCKER_COMPOSE_README.md)
- [API Examples](API_EXAMPLES.md)