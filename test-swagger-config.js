#!/usr/bin/env node

// Simple test script to verify dynamic Swagger server URL generation
const { spawn } = require('child_process');

console.log('🧪 Testing Swagger dynamic server URL configuration...\n');

// Test different environment configurations
const testConfigs = [
  {
    name: 'Development (localhost)',
    env: {
      NODE_ENV: 'development',
      PORT: '3000',
      HOST: 'localhost',
      HTTPS: 'false'
    }
  },
  {
    name: 'Development (Docker)',
    env: {
      NODE_ENV: 'development',
      PORT: '3000',
      HOST: '0.0.0.0',
      HTTPS: 'false'
    }
  },
  {
    name: 'Production with custom URL',
    env: {
      NODE_ENV: 'production',
      PORT: '3000',
      HOST: '0.0.0.0',
      HTTPS: 'true',
      PRODUCTION_URL: 'https://api.example.com'
    }
  }
];

async function testConfig(config) {
  return new Promise((resolve) => {
    console.log(`📋 Testing: ${config.name}`);
    
    // Create a simple test script that imports and logs the OpenAPI spec
    const testScript = `
      process.env.NODE_ENV = '${config.env.NODE_ENV}';
      process.env.PORT = '${config.env.PORT}';
      process.env.HOST = '${config.env.HOST}';
      process.env.HTTPS = '${config.env.HTTPS}';
      ${config.env.PRODUCTION_URL ? `process.env.PRODUCTION_URL = '${config.env.PRODUCTION_URL}';` : ''}
      
      const { config } = require('./dist/config');
      console.log('Config values:', {
        NODE_ENV: config.NODE_ENV,
        PORT: config.PORT,
        HOST: config.HOST,
        HTTPS: config.HTTPS,
        PRODUCTION_URL: config.PRODUCTION_URL
      });
      
      const { openApiSpec } = require('./dist/swagger/openapi');
      console.log('Servers:', JSON.stringify(openApiSpec.servers, null, 2));
    `;
    
    const child = spawn('node', ['-e', testScript], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let output = '';
    child.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    child.stderr.on('data', (data) => {
      console.error('Error:', data.toString());
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        console.log(output);
        console.log('✅ Test passed\n');
      } else {
        console.log('❌ Test failed\n');
      }
      resolve();
    });
  });
}

async function runTests() {
  for (const config of testConfigs) {
    await testConfig(config);
  }
  console.log('🎉 All tests completed!');
}

runTests().catch(console.error);