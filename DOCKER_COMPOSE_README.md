# Docker Compose Configuration Guide

This document provides comprehensive information about the Docker Compose configuration for the Timezone API Server.

## Overview

The Timezone API Server includes multiple Docker Compose configurations to support different deployment scenarios:

- `docker-compose.yml` - Main production configuration
- `docker-compose.override.yml` - Local development overrides
- `docker-compose.dev.yml` - Development-specific configuration
- `docker-compose.prod.yml` - Production-specific configuration with additional features

## Quick Start

### Basic Deployment

```bash
# Build and start the services
docker compose up -d

# Check service status
docker compose ps

# View logs
docker compose logs -f

# Stop services
docker compose down
```

### Development Mode

```bash
# Use development configuration
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

### Production Mode

```bash
# Use production configuration
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## Configuration Details

### Environment Variables

The following environment variables can be configured in the `.env` file or passed directly:

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `production` | Application environment |
| `PORT` | `3000` | External port mapping |
| `LOG_LEVEL` | `info` | Logging level (debug, info, warn, error) |
| `API_RATE_LIMIT_WINDOW_MS` | `900000` | Rate limiting window (15 minutes) |
| `API_RATE_LIMIT_MAX_REQUESTS` | `100` | Maximum requests per window |
| `HEALTH_CHECK_TIMEOUT` | `5000` | Health check timeout in milliseconds |
| `CORS_ORIGIN` | `*` | CORS allowed origins |
| `HELMET_ENABLED` | `true` | Enable security headers |
| `COMPOSE_PROJECT_NAME` | `timezone-api` | Docker Compose project name |

### Service Configuration

#### Main Service (`timezone-api`)

- **Image**: Built from local Dockerfile
- **Container Name**: `timezone-api-server`
- **Restart Policy**: `unless-stopped`
- **Port Mapping**: `${PORT:-3000}:3000`
- **Health Check**: Built-in health endpoint monitoring
- **Resource Limits**: 
  - CPU: 1.0 cores (limit), 0.25 cores (reservation)
  - Memory: 512MB (limit), 128MB (reservation)

#### Networking

- **Network**: `timezone-api-network` (bridge driver)
- **Internal Communication**: Services can communicate using service names
- **External Access**: API accessible on configured port (default: 3000)

#### Volumes

- **Logs Volume**: `timezone-api-logs` for persistent log storage
- **Type**: Local driver for development, can be configured for production storage

### Health Monitoring

The service includes comprehensive health monitoring:

- **Health Check Endpoint**: `/health`
- **Check Interval**: 30 seconds
- **Timeout**: 10 seconds
- **Retries**: 3 attempts
- **Start Period**: 40 seconds

Health check returns:
- Service status (healthy/degraded/unhealthy)
- Uptime in seconds
- Memory usage statistics
- Service version
- Timestamp

## Deployment Scenarios

### Local Development

```bash
# Create .env file from example
cp .env.example .env

# Start with development overrides
docker compose up -d

# Enable debug mode
NODE_ENV=development LOG_LEVEL=debug docker compose up -d
```

### Staging Environment

```bash
# Use custom port
PORT=8080 docker compose up -d

# With custom environment variables
NODE_ENV=staging LOG_LEVEL=warn docker compose up -d
```

### Production Deployment

```bash
# Use production configuration
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# With environment file
docker compose --env-file .env.production up -d
```

### Platform-Specific Deployments

#### Coolify

The configuration is compatible with Coolify deployment platform:

1. Import the repository
2. Set environment variables in Coolify dashboard
3. Use the main `docker-compose.yml` configuration
4. Configure domain and SSL through Coolify

#### Docker Swarm

```bash
# Deploy to swarm
docker stack deploy -c docker-compose.yml timezone-api
```

#### Kubernetes

Convert using Kompose:

```bash
# Install kompose
curl -L https://github.com/kubernetes/kompose/releases/download/v1.26.0/kompose-linux-amd64 -o kompose

# Convert to Kubernetes manifests
kompose convert -f docker-compose.yml
```

## Security Considerations

### Container Security

- **Non-root User**: Application runs as `nodeuser` (UID 1001)
- **Minimal Base Image**: Alpine Linux for reduced attack surface
- **Security Headers**: Helmet.js enabled by default
- **Resource Limits**: CPU and memory limits prevent resource exhaustion

### Network Security

- **Isolated Network**: Services run in dedicated bridge network
- **CORS Configuration**: Configurable CORS origins
- **Rate Limiting**: Built-in API rate limiting

### Secrets Management

Environment variables should be managed securely:

```bash
# Use Docker secrets (Swarm mode)
echo "secret_value" | docker secret create api_secret -

# Use external secret management
docker compose --env-file /secure/path/.env up -d
```

## Monitoring and Logging

### Application Logs

```bash
# View real-time logs
docker compose logs -f timezone-api

# View logs with timestamps
docker compose logs -t timezone-api

# View last 100 lines
docker compose logs --tail=100 timezone-api
```

### Health Monitoring

```bash
# Check health status
curl http://localhost:3000/health

# Monitor health with watch
watch -n 5 'curl -s http://localhost:3000/health | jq .'
```

### Resource Monitoring

```bash
# Monitor resource usage
docker stats timezone-api-server

# View container details
docker inspect timezone-api-server
```

## Troubleshooting

### Common Issues

#### Port Already in Use

```bash
# Check what's using the port
lsof -i :3000

# Use different port
PORT=3001 docker compose up -d
```

#### Container Won't Start

```bash
# Check logs for errors
docker compose logs timezone-api

# Check container status
docker compose ps

# Rebuild image
docker compose build --no-cache
```

#### Health Check Failing

```bash
# Check health endpoint manually
curl http://localhost:3000/health

# Check container logs
docker compose logs timezone-api

# Restart service
docker compose restart timezone-api
```

### Performance Issues

#### High Memory Usage

```bash
# Check memory usage
docker stats timezone-api-server

# Adjust memory limits in docker-compose.yml
deploy:
  resources:
    limits:
      memory: 256M
```

#### Slow Response Times

```bash
# Check API response times
time curl http://localhost:3000/health

# Monitor container performance
docker stats timezone-api-server
```

## Testing

### Automated Testing

Run the comprehensive test suite:

```bash
# Make test script executable
chmod +x test-docker-compose.sh

# Run all tests
./test-docker-compose.sh
```

### Manual Testing

```bash
# Test health endpoint
curl http://localhost:3000/health

# Test current time endpoint
curl "http://localhost:3000/api/time/current/America%2FNew_York"

# Test time conversion
curl -X POST http://localhost:3000/api/time/convert \
  -H "Content-Type: application/json" \
  -d '{"sourceTime":"2024-01-15T14:30:00","sourceTimezone":"America/New_York","targetTimezone":"Europe/London"}'

# Test Swagger documentation
curl http://localhost:3000/api/docs/
```

## Maintenance

### Updates

```bash
# Pull latest changes
git pull

# Rebuild and restart
docker compose down
docker compose build
docker compose up -d
```

### Cleanup

```bash
# Stop and remove containers
docker compose down

# Remove volumes
docker compose down -v

# Remove images
docker compose down --rmi all

# Full cleanup
docker system prune -a
```

### Backup

```bash
# Backup volumes
docker run --rm -v timezone-api-logs:/data -v $(pwd):/backup alpine tar czf /backup/logs-backup.tar.gz -C /data .

# Backup configuration
tar czf config-backup.tar.gz docker-compose*.yml .env*
```

## Support

For issues and questions:

1. Check the logs: `docker compose logs timezone-api`
2. Verify configuration: `docker compose config`
3. Test endpoints manually
4. Review this documentation
5. Check the main project README for API-specific issues