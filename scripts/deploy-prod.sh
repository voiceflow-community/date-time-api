#!/bin/bash

# Production Deployment Script for Timezone API Server
# This script deploys the application in production mode with additional checks

set -e

echo "🚀 Deploying Timezone API Server - Production Mode"
echo "================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if running as root (not recommended for production)
if [ "$EUID" -eq 0 ]; then
    print_warning "Running as root is not recommended for production deployment"
    read -p "Do you want to continue? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if Docker Compose is available
if ! command -v docker compose > /dev/null 2>&1; then
    print_error "Docker Compose is not available. Please install Docker Compose."
    exit 1
fi

# Set production environment variables
export NODE_ENV=production
export LOG_LEVEL=${LOG_LEVEL:-info}
export PORT=${PORT:-3000}

print_info "Environment: $NODE_ENV"
print_info "Port: $PORT"
print_info "Log Level: $LOG_LEVEL"

# Check for production environment file
if [ ! -f .env.production ]; then
    if [ -f .env ]; then
        print_warning "Using .env file (consider creating .env.production for production)"
    else
        print_error "No environment configuration found. Please create .env or .env.production file."
        exit 1
    fi
else
    print_info "Using .env.production configuration"
    export ENV_FILE=.env.production
fi

# Pre-deployment checks
print_info "Running pre-deployment checks..."

# Check if required environment variables are set
REQUIRED_VARS=("NODE_ENV" "PORT")
for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        print_error "Required environment variable $var is not set"
        exit 1
    fi
done

# Check available disk space (require at least 1GB)
AVAILABLE_SPACE=$(df / | awk 'NR==2 {print $4}')
if [ "$AVAILABLE_SPACE" -lt 1048576 ]; then
    print_warning "Low disk space detected. Available: $(($AVAILABLE_SPACE / 1024))MB"
    read -p "Do you want to continue? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Check if port is available
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
    print_warning "Port $PORT is already in use"
    print_info "Existing containers will be stopped"
fi

# Backup existing deployment (if any)
if docker compose ps | grep -q "timezone-api"; then
    print_info "Creating backup of current deployment..."
    BACKUP_DIR="backups/$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$BACKUP_DIR"
    
    # Export current container logs
    docker compose logs timezone-api > "$BACKUP_DIR/logs.txt" 2>/dev/null || true
    
    # Export current configuration
    docker compose config > "$BACKUP_DIR/docker-compose-config.yml" 2>/dev/null || true
    
    print_status "Backup created in $BACKUP_DIR"
fi

# Stop existing containers gracefully
print_info "Stopping existing containers..."
docker compose down --timeout 30 2>/dev/null || true

# Pull latest images (if using external registry)
print_info "Pulling latest images..."
docker compose pull 2>/dev/null || print_warning "Could not pull images (using local build)"

# Build production image
print_info "Building production image..."
if docker compose -f docker-compose.yml -f docker-compose.prod.yml build --no-cache; then
    print_status "Production image built successfully"
else
    print_error "Failed to build production image"
    exit 1
fi

# Start production services
print_info "Starting production services..."
if [ -n "$ENV_FILE" ]; then
    docker compose --env-file "$ENV_FILE" -f docker-compose.yml -f docker-compose.prod.yml up -d
else
    docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
fi

if [ $? -eq 0 ]; then
    print_status "Production services started successfully"
else
    print_error "Failed to start production services"
    exit 1
fi

# Wait for services to be ready
print_info "Waiting for services to be ready..."
sleep 15

# Health check with retries
print_info "Performing health checks..."
MAX_RETRIES=60
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -s -f http://localhost:$PORT/health > /dev/null 2>&1; then
        print_status "Service is healthy and ready!"
        break
    else
        RETRY_COUNT=$((RETRY_COUNT + 1))
        print_info "Waiting for service... (attempt $RETRY_COUNT/$MAX_RETRIES)"
        sleep 5
    fi
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    print_error "Service failed to become healthy within expected time"
    print_info "Checking logs..."
    docker compose logs --tail=50 timezone-api
    
    print_error "Deployment failed. Rolling back..."
    docker compose down
    exit 1
fi

# Comprehensive health and functionality tests
print_info "Running comprehensive tests..."

# Test health endpoint
HEALTH_RESPONSE=$(curl -s http://localhost:$PORT/health)
if echo "$HEALTH_RESPONSE" | jq -e '.status == "healthy"' > /dev/null 2>&1; then
    print_status "Health endpoint is working correctly"
else
    print_error "Health endpoint test failed"
    echo "Response: $HEALTH_RESPONSE"
fi

# Test API endpoints
if curl -s -f "http://localhost:$PORT/api/time/current/UTC" > /dev/null 2>&1; then
    print_status "Current time API endpoint is working"
else
    print_warning "Current time API endpoint test failed"
fi

# Test time conversion endpoint
CONVERSION_TEST=$(curl -s -X POST http://localhost:$PORT/api/time/convert \
    -H "Content-Type: application/json" \
    -d '{"sourceTime":"2024-01-15T12:00:00","sourceTimezone":"UTC","targetTimezone":"America/New_York"}' \
    -w "%{http_code}")

if [[ "$CONVERSION_TEST" == *"200" ]]; then
    print_status "Time conversion API endpoint is working"
else
    print_warning "Time conversion API endpoint test failed"
fi

# Test Swagger documentation
if curl -s -f http://localhost:$PORT/api/docs/ > /dev/null 2>&1; then
    print_status "API documentation is accessible"
else
    print_warning "API documentation test failed"
fi

# Display deployment information
echo ""
echo "🎉 Production deployment completed successfully!"
echo "=============================================="
print_status "Service is running at: http://localhost:$PORT"
print_status "Health check: http://localhost:$PORT/health"
print_status "API documentation: http://localhost:$PORT/api/docs"

if grep -q "METRICS_ENABLED=true" .env* 2>/dev/null; then
    print_status "Metrics: http://localhost:$PORT/metrics"
fi

# Show container status
echo ""
print_info "Container status:"
docker compose ps

# Show resource usage
echo ""
print_info "Resource usage:"
docker stats --no-stream timezone-api-server 2>/dev/null || print_warning "Could not retrieve resource stats"

# Show recent logs
echo ""
print_info "Recent logs:"
docker compose logs --tail=5 timezone-api

# Security reminders
echo ""
print_warning "Security Reminders:"
echo "  - Ensure firewall is properly configured"
echo "  - Regularly update the application and dependencies"
echo "  - Monitor logs for suspicious activity"
echo "  - Set up proper backup procedures"
echo "  - Configure monitoring and alerting"

# Monitoring commands
echo ""
print_info "Monitoring commands:"
echo "  - View logs: docker compose logs -f timezone-api"
echo "  - Check status: docker compose ps"
echo "  - Resource usage: docker stats timezone-api-server"
echo "  - Health check: curl http://localhost:$PORT/health"

# Cleanup old images
print_info "Cleaning up old Docker images..."
docker image prune -f > /dev/null 2>&1 || true

echo ""
print_status "Production deployment completed successfully! 🚀"
print_info "Service is ready to handle production traffic."