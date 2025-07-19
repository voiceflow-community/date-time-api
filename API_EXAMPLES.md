# API Usage Examples

This document provides comprehensive examples of how to use the Timezone API Server endpoints.

## 📋 Table of Contents

- [Base URL](#base-url)
- [Authentication](#authentication)
- [Health Check](#health-check)
- [Current Time API](#current-time-api)
- [Time Conversion API](#time-conversion-api)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)
- [Client Examples](#client-examples)
- [Testing Examples](#testing-examples)

## 🌐 Base URL

- **Local Development**: `http://localhost:3000`
- **Docker**: `http://localhost:3000` (or your configured port)
- **Production**: `https://your-domain.com`

## 🔐 Authentication

The API currently does not require authentication. All endpoints are publicly accessible but rate-limited.

## ❤️ Health Check

### Basic Health Check

```bash
curl http://localhost:3000/health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 3600,
  "version": "1.0.0",
  "memory": {
    "used": 45.2,
    "total": 512
  }
}
```

### Health Check with Headers

```bash
curl -I http://localhost:3000/health
```

**Response:**
```
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8
Content-Length: 156
Date: Mon, 15 Jan 2024 10:30:00 GMT
```

## 🌍 Current Time API

### Get Current Time in UTC

```bash
curl "http://localhost:3000/api/time/current/UTC"
```

**Response:**
```json
{
  "timestamp": "2024-01-15T15:30:00.000Z",
  "timezone": "UTC",
  "utcOffset": "+00:00",
  "formatted": {
    "date": "2024-01-15",
    "time": "15:30:00",
    "full": "January 15, 2024 at 3:30:00 PM UTC"
  }
}
```

### Get Current Time in New York

```bash
curl "http://localhost:3000/api/time/current/America%2FNew_York"
```

**Response:**
```json
{
  "timestamp": "2024-01-15T15:30:00.000Z",
  "timezone": "America/New_York",
  "utcOffset": "-05:00",
  "formatted": {
    "date": "2024-01-15",
    "time": "10:30:00",
    "full": "January 15, 2024 at 10:30:00 AM EST"
  }
}
```

### Get Current Time in London

```bash
curl "http://localhost:3000/api/time/current/Europe%2FLondon"
```

**Response:**
```json
{
  "timestamp": "2024-01-15T15:30:00.000Z",
  "timezone": "Europe/London",
  "utcOffset": "+00:00",
  "formatted": {
    "date": "2024-01-15",
    "time": "15:30:00",
    "full": "January 15, 2024 at 3:30:00 PM GMT"
  }
}
```

### Get Current Time in Tokyo

```bash
curl "http://localhost:3000/api/time/current/Asia%2FTokyo"
```

**Response:**
```json
{
  "timestamp": "2024-01-15T15:30:00.000Z",
  "timezone": "Asia/Tokyo",
  "utcOffset": "+09:00",
  "formatted": {
    "date": "2024-01-16",
    "time": "00:30:00",
    "full": "January 16, 2024 at 12:30:00 AM JST"
  }
}
```

### Common Timezone Examples

```bash
# Pacific Time
curl "http://localhost:3000/api/time/current/America%2FLos_Angeles"

# Central European Time
curl "http://localhost:3000/api/time/current/Europe%2FParis"

# Australian Eastern Time
curl "http://localhost:3000/api/time/current/Australia%2FSydney"

# India Standard Time
curl "http://localhost:3000/api/time/current/Asia%2FKolkata"

# Brazil Time
curl "http://localhost:3000/api/time/current/America%2FSao_Paulo"
```

## 🔄 Time Conversion API

### Basic Time Conversion

```bash
curl -X POST http://localhost:3000/api/time/convert \
  -H "Content-Type: application/json" \
  -d '{
    "sourceTime": "2024-01-15T14:30:00",
    "sourceTimezone": "America/New_York",
    "targetTimezone": "Europe/London"
  }'
```

**Response:**
```json
{
  "original": {
    "timestamp": "2024-01-15T19:30:00.000Z",
    "timezone": "America/New_York",
    "formatted": "January 15, 2024 at 2:30:00 PM EST"
  },
  "converted": {
    "timestamp": "2024-01-15T19:30:00.000Z",
    "timezone": "Europe/London",
    "formatted": "January 15, 2024 at 7:30:00 PM GMT"
  },
  "utcOffsetDifference": "+05:00"
}
```

### Convert Business Hours

```bash
# Convert 9 AM EST to various timezones
curl -X POST http://localhost:3000/api/time/convert \
  -H "Content-Type: application/json" \
  -d '{
    "sourceTime": "2024-01-15T09:00:00",
    "sourceTimezone": "America/New_York",
    "targetTimezone": "Asia/Tokyo"
  }'
```

### Convert with ISO 8601 Format

```bash
curl -X POST http://localhost:3000/api/time/convert \
  -H "Content-Type: application/json" \
  -d '{
    "sourceTime": "2024-01-15T14:30:00.000Z",
    "sourceTimezone": "UTC",
    "targetTimezone": "America/Los_Angeles"
  }'
```

### Multiple Conversion Examples

```bash
# UTC to multiple timezones
for tz in "America/New_York" "Europe/London" "Asia/Tokyo" "Australia/Sydney"; do
  echo "Converting to $tz:"
  curl -s -X POST http://localhost:3000/api/time/convert \
    -H "Content-Type: application/json" \
    -d "{\"sourceTime\":\"2024-01-15T12:00:00\",\"sourceTimezone\":\"UTC\",\"targetTimezone\":\"$tz\"}" | jq .
  echo ""
done
```

## ❌ Error Handling

### Invalid Timezone

```bash
curl "http://localhost:3000/api/time/current/Invalid%2FTimezone"
```

**Response (400 Bad Request):**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid timezone identifier",
    "details": [
      {
        "field": "timezone",
        "message": "Invalid timezone identifier"
      }
    ],
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

### Missing Required Fields

```bash
curl -X POST http://localhost:3000/api/time/convert \
  -H "Content-Type: application/json" \
  -d '{
    "sourceTime": "2024-01-15T14:30:00"
  }'
```

**Response (400 Bad Request):**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "field": "sourceTimezone",
        "message": "Required"
      },
      {
        "field": "targetTimezone",
        "message": "Required"
      }
    ],
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

### Invalid Date Format

```bash
curl -X POST http://localhost:3000/api/time/convert \
  -H "Content-Type: application/json" \
  -d '{
    "sourceTime": "invalid-date",
    "sourceTimezone": "UTC",
    "targetTimezone": "America/New_York"
  }'
```

**Response (400 Bad Request):**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid datetime format",
    "details": [
      {
        "field": "sourceTime",
        "message": "Invalid datetime format"
      }
    ],
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

### Not Found Error

```bash
curl "http://localhost:3000/api/nonexistent"
```

**Response (404 Not Found):**
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Endpoint not found",
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

## 🚦 Rate Limiting

### Rate Limit Headers

```bash
curl -I "http://localhost:3000/api/time/current/UTC"
```

**Response Headers:**
```
HTTP/1.1 200 OK
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 99
X-RateLimit-Reset: 1642248600
```

### Rate Limit Exceeded

When rate limit is exceeded:

**Response (429 Too Many Requests):**
```json
{
  "error": {
    "code": "TOO_MANY_REQUESTS",
    "message": "Too many requests from this IP, please try again later",
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

## 💻 Client Examples

### JavaScript/Node.js

```javascript
// Using fetch API
async function getCurrentTime(timezone) {
  try {
    const response = await fetch(`http://localhost:3000/api/time/current/${encodeURIComponent(timezone)}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching current time:', error);
    throw error;
  }
}

async function convertTime(sourceTime, sourceTimezone, targetTimezone) {
  try {
    const response = await fetch('http://localhost:3000/api/time/convert', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sourceTime,
        sourceTimezone,
        targetTimezone
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error converting time:', error);
    throw error;
  }
}

// Usage examples
getCurrentTime('America/New_York')
  .then(data => console.log('Current time in NY:', data))
  .catch(error => console.error('Error:', error));

convertTime('2024-01-15T14:30:00', 'UTC', 'Asia/Tokyo')
  .then(data => console.log('Converted time:', data))
  .catch(error => console.error('Error:', error));
```

### Python

```python
import requests
import json
from urllib.parse import quote

BASE_URL = 'http://localhost:3000'

def get_current_time(timezone):
    """Get current time in specified timezone"""
    url = f"{BASE_URL}/api/time/current/{quote(timezone)}"
    
    try:
        response = requests.get(url)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error fetching current time: {e}")
        raise

def convert_time(source_time, source_timezone, target_timezone):
    """Convert time between timezones"""
    url = f"{BASE_URL}/api/time/convert"
    
    payload = {
        'sourceTime': source_time,
        'sourceTimezone': source_timezone,
        'targetTimezone': target_timezone
    }
    
    try:
        response = requests.post(url, json=payload)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error converting time: {e}")
        raise

# Usage examples
try:
    # Get current time in New York
    ny_time = get_current_time('America/New_York')
    print(f"Current time in NY: {ny_time['formatted']['full']}")
    
    # Convert time
    converted = convert_time('2024-01-15T14:30:00', 'UTC', 'Asia/Tokyo')
    print(f"Converted time: {converted['converted']['formatted']}")
    
except Exception as e:
    print(f"Error: {e}")
```

### cURL Scripts

```bash
#!/bin/bash

# Get current time in multiple timezones
timezones=("UTC" "America/New_York" "Europe/London" "Asia/Tokyo" "Australia/Sydney")

echo "Current times around the world:"
echo "==============================="

for tz in "${timezones[@]}"; do
    echo -n "$tz: "
    curl -s "http://localhost:3000/api/time/current/$(echo $tz | sed 's/\//%2F/g')" | jq -r '.formatted.full'
done

# Convert business hours
echo ""
echo "Business hours conversion (9 AM EST):"
echo "====================================="

curl -s -X POST http://localhost:3000/api/time/convert \
  -H "Content-Type: application/json" \
  -d '{
    "sourceTime": "2024-01-15T09:00:00",
    "sourceTimezone": "America/New_York",
    "targetTimezone": "Europe/London"
  }' | jq '.converted.formatted'
```

## 🧪 Testing Examples

### Health Check Test

```bash
#!/bin/bash

# Health check test
echo "Testing health endpoint..."
response=$(curl -s -w "%{http_code}" http://localhost:3000/health)
http_code="${response: -3}"
body="${response%???}"

if [ "$http_code" -eq 200 ]; then
    echo "✅ Health check passed"
    echo "$body" | jq .
else
    echo "❌ Health check failed with status: $http_code"
fi
```

### API Endpoint Tests

```bash
#!/bin/bash

# Test current time endpoint
echo "Testing current time endpoint..."
curl -s "http://localhost:3000/api/time/current/UTC" | jq .

# Test time conversion endpoint
echo "Testing time conversion endpoint..."
curl -s -X POST http://localhost:3000/api/time/convert \
  -H "Content-Type: application/json" \
  -d '{
    "sourceTime": "2024-01-15T12:00:00",
    "sourceTimezone": "UTC",
    "targetTimezone": "America/New_York"
  }' | jq .

# Test error handling
echo "Testing error handling..."
curl -s "http://localhost:3000/api/time/current/Invalid%2FTimezone" | jq .
```

### Load Testing

```bash
#!/bin/bash

# Simple load test
echo "Running load test..."
for i in {1..10}; do
    curl -s "http://localhost:3000/api/time/current/UTC" > /dev/null &
done

wait
echo "Load test completed"
```

## 📊 Monitoring Examples

### Response Time Monitoring

```bash
#!/bin/bash

# Monitor response times
while true; do
    start_time=$(date +%s%N)
    curl -s http://localhost:3000/health > /dev/null
    end_time=$(date +%s%N)
    
    duration=$(( (end_time - start_time) / 1000000 ))
    echo "$(date): Response time: ${duration}ms"
    
    sleep 5
done
```

### Availability Monitoring

```bash
#!/bin/bash

# Monitor service availability
while true; do
    if curl -s -f http://localhost:3000/health > /dev/null; then
        echo "$(date): Service is UP"
    else
        echo "$(date): Service is DOWN"
    fi
    
    sleep 30
done
```

---

**For more examples and interactive testing, visit the Swagger documentation at: `http://localhost:3000/api/docs`**