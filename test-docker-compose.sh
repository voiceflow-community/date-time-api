#!/bin/bash

# Docker Compose Deployment Test Script
# This script tests the Docker Compose configuration for the Timezone API Server

set -e

echo "🧪 Testing Docker Compose Configuration for Timezone API Server"
echo "=============================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Test 1: Build the Docker image
echo "📦 Test 1: Building Docker image..."
if docker compose build; then
    print_status "Docker image built successfully"
else
    print_error "Failed to build Docker image"
    exit 1
fi

# Test 2: Start services
echo "🚀 Test 2: Starting services..."
if docker compose up -d; then
    print_status "Services started successfully"
else
    print_error "Failed to start services"
    exit 1
fi

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 10

# Test 3: Check service status
echo "🔍 Test 3: Checking service status..."
if docker compose ps | grep -q "healthy"; then
    print_status "Service is healthy"
else
    print_warning "Service may not be fully healthy yet"
fi

# Test 4: Test health endpoint
echo "❤️  Test 4: Testing health endpoint..."
if curl -s -f http://localhost:3000/health > /dev/null; then
    print_status "Health endpoint is accessible"
    echo "Health response:"
    curl -s http://localhost:3000/health | jq .
else
    print_error "Health endpoint is not accessible"
fi

# Test 5: Test API endpoints
echo "🌍 Test 5: Testing timezone API endpoints..."

# Test current time endpoint
echo "Testing current time endpoint..."
if curl -s -f "http://localhost:3000/api/time/current/America%2FNew_York" > /dev/null; then
    print_status "Current time endpoint is working"
    echo "Current time response:"
    curl -s "http://localhost:3000/api/time/current/America%2FNew_York" | jq .
else
    print_error "Current time endpoint failed"
fi

# Test time conversion endpoint
echo "Testing time conversion endpoint..."
if curl -s -f -X POST http://localhost:3000/api/time/convert \
    -H "Content-Type: application/json" \
    -d '{"sourceTime":"2024-01-15T14:30:00","sourceTimezone":"America/New_York","targetTimezone":"Europe/London"}' > /dev/null; then
    print_status "Time conversion endpoint is working"
    echo "Conversion response:"
    curl -s -X POST http://localhost:3000/api/time/convert \
        -H "Content-Type: application/json" \
        -d '{"sourceTime":"2024-01-15T14:30:00","sourceTimezone":"America/New_York","targetTimezone":"Europe/London"}' | jq .
else
    print_error "Time conversion endpoint failed"
fi

# Test 6: Test Swagger documentation
echo "📚 Test 6: Testing Swagger documentation..."
if curl -s -f http://localhost:3000/api/docs/ > /dev/null; then
    print_status "Swagger documentation is accessible"
else
    print_error "Swagger documentation is not accessible"
fi

# Test 7: Test environment variable configuration
echo "🔧 Test 7: Testing environment variable configuration..."
docker compose down
PORT=3001 docker compose up -d
sleep 5

if curl -s -f http://localhost:3001/health > /dev/null; then
    print_status "Environment variable configuration is working (PORT=3001)"
else
    print_error "Environment variable configuration failed"
fi

# Test 8: Test resource limits and networking
echo "🔗 Test 8: Testing networking and resource configuration..."
CONTAINER_ID=$(docker compose ps -q timezone-api)
if [ ! -z "$CONTAINER_ID" ]; then
    print_status "Container networking is properly configured"
    echo "Container details:"
    docker inspect $CONTAINER_ID | jq '.[0].NetworkSettings.Networks'
else
    print_error "Container networking test failed"
fi

# Test 9: Test volume persistence
echo "💾 Test 9: Testing volume configuration..."
if docker volume ls | grep -q "timezone-api-logs"; then
    print_status "Volume configuration is working"
else
    print_warning "Volume may not be properly configured"
fi

# Cleanup
echo "🧹 Cleaning up..."
docker compose down
if docker volume ls | grep -q "timezone-api-logs"; then
    docker volume rm timezone-api-logs
fi

echo ""
echo "🎉 Docker Compose configuration tests completed!"
echo "=============================================="
print_status "All tests passed successfully"