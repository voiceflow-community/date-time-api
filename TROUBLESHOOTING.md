# Troubleshooting Guide

This guide helps you diagnose and resolve common issues with the Timezone API Server.

## 🔍 Quick Diagnostics

### Health Check Commands

```bash
# Basic health check
curl http://localhost:3000/health

# Detailed health check with formatting
curl -s http://localhost:3000/health | jq .

# Check if service is responding
curl -I http://localhost:3000/health
```

### Service Status Commands

```bash
# Check Docker containers
docker compose ps

# View container logs
docker compose logs timezone-api

# Check resource usage
docker stats timezone-api-server

# Inspect container configuration
docker inspect timezone-api-server
```

## 🚨 Common Issues

### 1. Service Won't Start

#### Symptoms
- Container exits immediately
- Health check fails
- Port binding errors

#### Diagnosis
```bash
# Check container logs
docker compose logs timezone-api

# Check if port is in use
lsof -i :3000

# Verify Docker Compose configuration
docker compose config
```

#### Solutions

**Port Already in Use:**
```bash
# Find process using the port
lsof -i :3000

# Kill the process
kill -9 <PID>

# Or use a different port
PORT=3001 docker compose up -d
```

**Environment Configuration Issues:**
```bash
# Verify .env file exists
ls -la .env*

# Check environment variables
docker compose config | grep -A 10 environment

# Recreate .env from example
cp .env.example .env
```

**Docker Issues:**
```bash
# Rebuild without cache
docker compose build --no-cache

# Remove old containers and volumes
docker compose down -v
docker system prune -f

# Restart Docker service (Linux)
sudo systemctl restart docker
```

### 2. API Endpoints Not Working

#### Symptoms
- 404 errors on API calls
- Validation errors
- Timeout errors

#### Diagnosis
```bash
# Test health endpoint first
curl http://localhost:3000/health

# Test with verbose output
curl -v "http://localhost:3000/api/time/current/UTC"

# Check API documentation
curl http://localhost:3000/api/docs/
```

#### Solutions

**Invalid Timezone Parameters:**
```bash
# Use URL-encoded timezone names
curl "http://localhost:3000/api/time/current/America%2FNew_York"

# List valid timezones (if endpoint exists)
curl "http://localhost:3000/api/timezones"
```

**Request Format Issues:**
```bash
# Ensure proper Content-Type header
curl -X POST http://localhost:3000/api/time/convert \
  -H "Content-Type: application/json" \
  -d '{"sourceTime":"2024-01-15T12:00:00","sourceTimezone":"UTC","targetTimezone":"America/New_York"}'

# Validate JSON format
echo '{"sourceTime":"2024-01-15T12:00:00","sourceTimezone":"UTC","targetTimezone":"America/New_York"}' | jq .
```

**Rate Limiting:**
```bash
# Check rate limit headers
curl -I http://localhost:3000/api/time/current/UTC

# Wait and retry if rate limited
sleep 60
```

### 3. Performance Issues

#### Symptoms
- Slow response times
- High memory usage
- CPU spikes

#### Diagnosis
```bash
# Monitor resource usage
docker stats timezone-api-server

# Check response times
time curl http://localhost:3000/health

# Monitor logs for errors
docker compose logs -f timezone-api | grep -i error
```

#### Solutions

**High Memory Usage:**
```bash
# Adjust memory limits in docker-compose.yml
deploy:
  resources:
    limits:
      memory: 256M

# Restart with new limits
docker compose down
docker compose up -d
```

**Slow Response Times:**
```bash
# Check if timezone data is loading properly
curl -s http://localhost:3000/health | jq '.memory'

# Verify rate limiting configuration
grep -i rate .env
```

### 4. Docker Issues

#### Symptoms
- Build failures
- Container crashes
- Volume mount issues

#### Diagnosis
```bash
# Check Docker daemon status
docker info

# Verify Docker Compose version
docker compose version

# Check available disk space
df -h
```

#### Solutions

**Build Failures:**
```bash
# Clean Docker cache
docker builder prune -f

# Rebuild from scratch
docker compose build --no-cache --pull

# Check Dockerfile syntax
docker compose config
```

**Container Crashes:**
```bash
# Check exit codes
docker compose ps

# View crash logs
docker compose logs --tail=50 timezone-api

# Restart with debug logging
LOG_LEVEL=debug docker compose up -d
```

**Volume Issues:**
```bash
# Remove and recreate volumes
docker compose down -v
docker volume prune -f
docker compose up -d
```

### 5. Network Issues

#### Symptoms
- Connection refused errors
- DNS resolution failures
- CORS errors

#### Diagnosis
```bash
# Test network connectivity
docker network ls
docker network inspect timezone-api-network

# Check port mapping
docker port timezone-api-server

# Test from inside container
docker exec timezone-api-server curl localhost:3000/health
```

#### Solutions

**Connection Issues:**
```bash
# Verify port mapping
docker compose ps

# Check firewall settings (Linux)
sudo ufw status

# Test with different port
PORT=3001 docker compose up -d
```

**CORS Issues:**
```bash
# Check CORS configuration
grep CORS .env

# Set appropriate CORS origin
echo "CORS_ORIGIN=http://localhost:3000" >> .env
docker compose restart
```

## 🔧 Advanced Troubleshooting

### Debug Mode

Enable debug logging for detailed information:

```bash
# Set debug environment
LOG_LEVEL=debug docker compose up -d

# View debug logs
docker compose logs -f timezone-api | grep DEBUG
```

### Container Shell Access

Access the container for internal debugging:

```bash
# Access running container
docker exec -it timezone-api-server sh

# Check internal processes
docker exec timezone-api-server ps aux

# Check internal network
docker exec timezone-api-server netstat -tlnp
```

### Configuration Validation

Validate your configuration:

```bash
# Check Docker Compose configuration
docker compose config

# Validate environment variables
docker compose config | grep -A 20 environment

# Test configuration changes
docker compose config --quiet && echo "Configuration is valid"
```

### Log Analysis

Analyze logs for patterns:

```bash
# Search for errors
docker compose logs timezone-api | grep -i error

# Search for specific patterns
docker compose logs timezone-api | grep -E "(timeout|failed|error)"

# Monitor real-time logs
docker compose logs -f timezone-api | grep -v "GET /health"
```

## 📊 Monitoring and Metrics

### Health Monitoring

Set up continuous health monitoring:

```bash
# Continuous health check
watch -n 5 'curl -s http://localhost:3000/health | jq .'

# Health check with alerting
while true; do
  if ! curl -s -f http://localhost:3000/health > /dev/null; then
    echo "ALERT: Service is unhealthy at $(date)"
  fi
  sleep 30
done
```

### Performance Monitoring

Monitor performance metrics:

```bash
# Resource usage monitoring
watch -n 2 'docker stats timezone-api-server --no-stream'

# API response time monitoring
while true; do
  time curl -s http://localhost:3000/health > /dev/null
  sleep 5
done
```

### Log Monitoring

Set up log monitoring:

```bash
# Monitor error logs
docker compose logs -f timezone-api | grep -i error

# Monitor access patterns
docker compose logs -f timezone-api | grep "GET\|POST"

# Save logs to file
docker compose logs timezone-api > logs/app-$(date +%Y%m%d).log
```

## 🆘 Emergency Procedures

### Service Recovery

Quick service recovery steps:

```bash
# 1. Stop all services
docker compose down

# 2. Clean up resources
docker system prune -f

# 3. Rebuild and restart
docker compose build --no-cache
docker compose up -d

# 4. Verify health
curl http://localhost:3000/health
```

### Data Recovery

If using persistent volumes:

```bash
# Backup volumes before recovery
docker run --rm -v timezone-api-logs:/data -v $(pwd):/backup alpine tar czf /backup/logs-backup.tar.gz -C /data .

# Restore from backup
docker run --rm -v timezone-api-logs:/data -v $(pwd):/backup alpine tar xzf /backup/logs-backup.tar.gz -C /data
```

### Rollback Procedure

Rollback to previous version:

```bash
# 1. Stop current deployment
docker compose down

# 2. Restore previous configuration
git checkout HEAD~1 -- docker-compose.yml

# 3. Rebuild and deploy
docker compose build
docker compose up -d

# 4. Verify rollback
curl http://localhost:3000/health
```

## 📞 Getting Help

### Information to Collect

When seeking help, collect this information:

```bash
# System information
uname -a
docker version
docker compose version

# Service status
docker compose ps
docker compose logs --tail=50 timezone-api

# Configuration
docker compose config
cat .env

# Resource usage
docker stats timezone-api-server --no-stream
df -h
```

### Support Channels

1. **Check Documentation**: Review README.md and API docs
2. **Search Issues**: Look for similar problems in the repository
3. **Create Issue**: Provide collected information above
4. **Community Support**: Check community forums or chat

### Useful Commands Reference

```bash
# Quick health check
curl -s http://localhost:3000/health | jq .

# View recent logs
docker compose logs --tail=20 timezone-api

# Restart service
docker compose restart timezone-api

# Full rebuild
docker compose down && docker compose build --no-cache && docker compose up -d

# Check configuration
docker compose config

# Monitor resources
docker stats timezone-api-server

# Access container shell
docker exec -it timezone-api-server sh
```

---

**Remember**: Always backup your data and configuration before making significant changes!