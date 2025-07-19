#!/bin/bash

# Staging Deployment Script for Timezone API Server
# This script deploys the application in staging mode for testing

set -e

echo "🚀 Deploying Timezone API Server - Staging Mode"
echo "==============================================="

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

# Set staging environment variables
export NODE_ENV=staging
export LOG_LEVEL=${LOG_LEVEL:-warn}
export PORT=${PORT:-3000}

print_info "Environment: $NODE_ENV"
print_info "Port: $PORT"
print_info "Log Level: $LOG_LEVEL"

# Check for staging environment file
if [ -f .env.staging ]; then
    print_info "Using .env.staging configuration"
    export ENV_FILE=.env.staging
elif [ -f .env ]; then
    print_warning "Using .env file (consider creating .env.staging for staging)"
else
    print_error "No environment configuration found. Please create .env or .env.staging file."
    exit 1
fi

# Stop existing containers
print_info "Stopping existing containers..."
docker compose down 2>/dev/null || true

# Build staging image
print_info "Building staging image..."
if docker compose build; then
    print_status "Staging image built successfully"
else
    print_error "Failed to build staging image"
    exit 1
fi

# Start staging services
print_info "Starting staging services..."
if [ -n "$ENV_FILE" ]; then
    docker compose --env-file "$ENV_FILE" up -d
else
    docker compose up -d
fi

if [ $? -eq 0 ]; then
    print_status "Staging services started successfully"
else
    print_error "Failed to start staging services"
    exit 1
fi

# Wait for services to be ready
print_info "Waiting for services to be ready..."
sleep 10

# Health check with retries
print_info "Performing health checks..."
MAX_RETRIES=30
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -s -f http://localhost:$PORT/health > /dev/null 2>&1; then
        print_status "Service is healthy and ready!"
        break
    else
        RETRY_COUNT=$((RETRY_COUNT + 1))
        print_info "Waiting for service... (attempt $RETRY_COUNT/$MAX_RETRIES)"
        sleep 3
    fi
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    print_error "Service failed to become healthy within expected time"
    print_info "Checking logs..."
    docker compose logs --tail=20 timezone-api
    exit 1
fi

# Run staging tests
print_info "Running staging tests..."

# Test health endpoint
if curl -s http://localhost:$PORT/health | jq -e '.status == "healthy"' > /dev/null 2>&1; then
    print_status "Health endpoint test passed"
else
    print_error "Health endpoint test failed"
fi

# Test API endpoints
if curl -s -f "http://localhost:$PORT/api/time/current/UTC" > /dev/null 2>&1; then
    print_status "Current time API test passed"
else
    print_error "Current time API test failed"
fi

# Test time conversion
if curl -s -f -X POST http://localhost:$PORT/api/time/convert \
    -H "Content-Type: application/json" \
    -d '{"sourceTime":"2024-01-15T12:00:00","sourceTimezone":"UTC","targetTimezone":"America/New_York"}' > /dev/null 2>&1; then
    print_status "Time conversion API test passed"
else
    print_error "Time conversion API test failed"
fi

# Test documentation
if curl -s -f http://localhost:$PORT/api/docs/ > /dev/null 2>&1; then
    print_status "API documentation test passed"
else
    print_error "API documentation test failed"
fi

# Display staging information
echo ""
echo "🎉 Staging deployment completed successfully!"
echo "==========================================="
print_status "Service is running at: http://localhost:$PORT"
print_status "Health check: http://localhost:$PORT/health"
print_status "API documentation: http://localhost:$PORT/api/docs"

# Show container status
echo ""
print_info "Container status:"
docker compose ps

echo ""
print_info "Staging environment is ready for testing!"
print_info "To view logs: docker compose logs -f timezone-api"
print_info "To stop: docker compose down"