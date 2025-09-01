import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'child_process';
import http from 'http';

describe('Docker Container Tests', () => {
  let containerId: string;
  const containerName = 'timezone-api-test';
  const testPort = 3001;

  beforeAll(async () => {
    // Build the Docker image
    console.log('Building Docker image...');
    execSync('docker build -t timezone-api-server:test .', {
      stdio: 'inherit',
      timeout: 120000 // 2 minutes timeout for build
    });

    // Start the container
    console.log('Starting Docker container...');
    const result = execSync(
      `docker run -d --name ${containerName} -p ${testPort}:3000 timezone-api-server:test`,
      { encoding: 'utf8' }
    );
    containerId = result.trim();

    // Wait for container to be ready
    console.log('Waiting for container to be ready...');
    await waitForContainer(testPort, 30000); // 30 seconds timeout
  }, 150000); // 2.5 minutes timeout for beforeAll

  afterAll(async () => {
    if (containerId) {
      try {
        // Stop and remove the container
        execSync(`docker stop ${containerName}`, { stdio: 'ignore' });
        execSync(`docker rm ${containerName}`, { stdio: 'ignore' });
        console.log('Container cleaned up');
      } catch (error) {
        console.warn('Error cleaning up container:', error);
      }
    }
  });

  it('should start the container successfully', () => {
    expect(containerId).toBeTruthy();
    expect(containerId.length).toBeGreaterThan(10); // Docker container ID should be long
  });

  it('should respond to health check endpoint', async () => {
    const response = await makeHttpRequest(`http://localhost:${testPort}/health`);

    expect(response.statusCode).toBe(200);
    expect(response.data).toContain('status');

    const healthData = JSON.parse(response.data);
    expect(healthData.status).toBe('healthy');
    expect(healthData.uptime).toBeGreaterThan(0);
    expect(healthData.memory).toBeDefined();
    expect(healthData.version).toBe('1.0.0');
  });

  it('should respond to current time endpoint', async () => {
    const response = await makeHttpRequest(`http://localhost:${testPort}/api/time/current/America/New_York`);

    expect(response.statusCode).toBe(200);

    const timeData = JSON.parse(response.data);
    expect(timeData.timestamp).toBeDefined();
    expect(timeData.timezone).toBe('America/New_York');
    expect(timeData.utcOffset).toBeDefined();
    expect(timeData.formatted).toBeDefined();
  });

  it('should respond to time conversion endpoint', async () => {
    const requestBody = JSON.stringify({
      sourceTime: '2024-01-15T10:00:00Z',
      sourceTimezone: 'UTC',
      targetTimezone: 'America/New_York'
    });

    const response = await makeHttpRequest(
      `http://localhost:${testPort}/api/time/convert`,
      'POST',
      requestBody
    );

    expect(response.statusCode).toBe(200);

    const conversionData = JSON.parse(response.data);
    expect(conversionData.original).toBeDefined();
    expect(conversionData.converted).toBeDefined();
    expect(conversionData.original.timezone).toBe('UTC');
    expect(conversionData.converted.timezone).toBe('America/New_York');
  });

  it('should serve Swagger documentation', async () => {
    const response = await makeHttpRequest(`http://localhost:${testPort}/api/docs`);

    expect(response.statusCode).toBe(200);
    expect(response.data).toContain('swagger-ui');
  });

  it('should handle invalid requests properly', async () => {
    const response = await makeHttpRequest(`http://localhost:${testPort}/api/time/current/Invalid_Timezone`);

    expect(response.statusCode).toBe(400);

    const errorData = JSON.parse(response.data);
    expect(errorData.error).toBeDefined();
    expect(errorData.error.code).toBeDefined();
    expect(errorData.error.message).toBeDefined();
  });

  it('should have proper Docker health check', async () => {
    // Check Docker health status
    const healthStatus = execSync(
      `docker inspect --format='{{.State.Health.Status}}' ${containerName}`,
      { encoding: 'utf8' }
    ).trim();

    expect(['healthy', 'starting']).toContain(healthStatus);
  });

  it('should run as non-root user', () => {
    const userId = execSync(
      `docker exec ${containerName} id -u`,
      { encoding: 'utf8' }
    ).trim();

    expect(userId).toBe('1001'); // Should not be root (0)
  });

  it('should have minimal attack surface', () => {
    // Check that unnecessary packages are not installed
    const result = execSync(
      `docker exec ${containerName} sh -c "which curl || echo 'not found'"`,
      { encoding: 'utf8' }
    ).trim();

    expect(result).toBe('not found'); // curl should not be available in production image
  });
});

// Helper function to wait for container to be ready
async function waitForContainer(port: number, timeout: number): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      await makeHttpRequest(`http://localhost:${port}/health`);
      return; // Container is ready
    } catch (error) {
      // Container not ready yet, wait and retry
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  throw new Error(`Container did not become ready within ${timeout}ms`);
}

// Helper function to make HTTP requests
function makeHttpRequest(
  url: string,
  method: 'GET' | 'POST' = 'GET',
  body?: string
): Promise<{ statusCode: number; data: string }> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(body && { 'Content-Length': Buffer.byteLength(body) })
      },
      timeout: 5000
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        resolve({
          statusCode: res.statusCode || 0,
          data
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (body) {
      req.write(body);
    }

    req.end();
  });
}
