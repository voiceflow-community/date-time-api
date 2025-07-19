#!/bin/bash

# Development Deployment Script for Timezone API Server
# This script deploys the application in development mode

set -e

echo "🚀 Deploying Timezone API Server - Development Mode"
echo "=================================================="

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

# Set development environment variables
export NODE_ENV=development
export LOG_LEVEL=debug
export PORT=${PORT:-3000}

print_info "Environment: $NODE_ENV"
print_info "Port: $PORT"
print_info "Log Level: $LOG_LEVEL"

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    print_warning ".env file not found. Creating from .env.example..."
    if [ -f .env.example ]; then
        cp .env.example .env
        print_status ".env file created from .env.example"
    else
        print_error ".env.example file not found. Please create .env file manually."
        exit 1
    fi
fi

# Stop existing containers
print_info "Stopping existing containers..."
docker compose down 2>/dev/null || true

# Build and start development services
print_info "Building and starting development services..."
if docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build; then
    print_status "Development services started successfully"
else
    print_error "Failed to start development services"
    exit 1
fi

# Wait for services to be ready
print_info "Waiting for services to be ready..."
sleep 10

# Check service health
print_info "Checking service health..."
MAX_RETRIES=30
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -s -f http://localhost:$PORT/health > /dev/null 2>&1; then
        print_status "Service is healthy and ready!"
        break
    else
        RETRY_COUNT=$((RETRY_COUNT + 1))
        print_info "Waiting for service... (attempt $RETRY_COUNT/$MAX_RETRIES)"
        sleep 2
    fi
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    print_error "Service failed to become healthy within expected time"
    print_info "Checking logs..."
    docker compose logs --tail=20 timezone-api
    exit 1
fi

# Display service information
echo ""
echo "🎉 Development deployment completed successfully!"
echo "=============================================="
print_status "Service is running at: http://localhost:$PORT"
print_status "Health check: http://localhost:$PORT/health"
print_status "API documentation: http://localhost:$PORT/api/docs"
print_status "Metrics: http://localhost:$PORT/metrics"

# Show container status
echo ""
print_info "Container status:"
docker compose ps

# Show recent logs
echo ""
print_info "Recent logs:"
docker compose logs --tail=10 timezone-api

echo ""
print_info "To view live logs, run: docker compose logs -f timezone-api"
print_info "To stop services, run: docker compose down"

# Test basic functionality
echo ""
print_info "Testing basic functionality..."

# Test health endpoint
if curl -s http://localhost:$PORT/health | jq . > /dev/null 2>&1; then
    print_status "Health endpoint is working"
else
    print_warning "Health endpoint test failed"
fi

# Test API endpoint
if curl -s "http://localhost:$PORT/api/time/current/UTC" | jq . > /dev/null 2>&1; then
    print_status "API endpoint is working"
else
    print_warning "API endpoint test failed"
fi

echo ""
print_status "Development deployment completed! 🚀"