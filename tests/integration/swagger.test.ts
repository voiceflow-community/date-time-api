import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../src/index';
import { openApiSpec } from '../../src/swagger/openapi';
import { Server } from 'http';

describe('Swagger/OpenAPI Documentation Integration Tests', () => {
  let server: Server;

  beforeAll(async () => {
    // Start the server for testing
    server = app.listen(0); // Use port 0 to get a random available port
  });

  afterAll(async () => {
    // Close the server after tests
    if (server) {
      server.close();
    }
  });

  describe('OpenAPI Specification Validation', () => {
    it('should have valid OpenAPI specification structure', () => {
      expect(openApiSpec.openapi).toBe('3.0.3');
      expect(openApiSpec.info).toBeDefined();
      expect(openApiSpec.info.title).toBe('Timezone API Server');
      expect(openApiSpec.info.version).toBe('1.0.0');
      expect(openApiSpec.paths).toBeDefined();
      expect(openApiSpec.components).toBeDefined();
      expect(openApiSpec.components?.schemas).toBeDefined();
    });

    it('should define all required endpoints', () => {
      const paths = openApiSpec.paths;
      expect(paths).toHaveProperty('/api/time/current/{timezone}');
      expect(paths).toHaveProperty('/api/time/convert');
      expect(paths).toHaveProperty('/health');
    });

    it('should define all required schemas', () => {
      const schemas = openApiSpec.components?.schemas;
      expect(schemas).toHaveProperty('TimeResponse');
      expect(schemas).toHaveProperty('ConversionRequest');
      expect(schemas).toHaveProperty('ConversionResponse');
      expect(schemas).toHaveProperty('HealthResponse');
      expect(schemas).toHaveProperty('ErrorResponse');
      expect(schemas).toHaveProperty('ValidationError');
    });

    it('should have proper HTTP methods for each endpoint', () => {
      const paths = openApiSpec.paths;
      
      // Current time endpoint should have GET method
      expect(paths['/api/time/current/{timezone}']).toHaveProperty('get');
      
      // Convert time endpoint should have POST method
      expect(paths['/api/time/convert']).toHaveProperty('post');
      
      // Health endpoint should have GET method
      expect(paths['/health']).toHaveProperty('get');
    });

    it('should have proper response codes defined', () => {
      const currentTimeEndpoint = openApiSpec.paths['/api/time/current/{timezone}']?.get;
      const convertTimeEndpoint = openApiSpec.paths['/api/time/convert']?.post;
      const healthEndpoint = openApiSpec.paths['/health']?.get;

      // Current time endpoint responses
      expect(currentTimeEndpoint?.responses).toHaveProperty('200');
      expect(currentTimeEndpoint?.responses).toHaveProperty('400');
      expect(currentTimeEndpoint?.responses).toHaveProperty('500');

      // Convert time endpoint responses
      expect(convertTimeEndpoint?.responses).toHaveProperty('200');
      expect(convertTimeEndpoint?.responses).toHaveProperty('400');
      expect(convertTimeEndpoint?.responses).toHaveProperty('500');

      // Health endpoint responses
      expect(healthEndpoint?.responses).toHaveProperty('200');
      expect(healthEndpoint?.responses).toHaveProperty('503');
    });
  });

  describe('Swagger UI Endpoint', () => {
    it('should serve Swagger UI at /api/docs', async () => {
      const response = await request(app)
        .get('/api/docs/')
        .expect(200);

      expect(response.headers['content-type']).toMatch(/text\/html/);
      expect(response.text).toContain('swagger-ui');
    });

    it('should serve OpenAPI JSON specification at /api/docs/openapi.json', async () => {
      const response = await request(app)
        .get('/api/docs/openapi.json')
        .expect(200);

      expect(response.headers['content-type']).toMatch(/application\/json/);
      expect(response.body).toEqual(openApiSpec);
    });

    it('should have proper CORS headers for documentation endpoints', async () => {
      const response = await request(app)
        .get('/api/docs/openapi.json')
        .expect(200);

      expect(response.headers).toHaveProperty('access-control-allow-origin');
    });
  });

  describe('API Contract Validation', () => {
    describe('Current Time Endpoint Contract', () => {
      it('should match OpenAPI specification for successful response', async () => {
        const response = await request(app)
          .get('/api/time/current/America/New_York');

        // The endpoint should either return 200 with proper data or 400/404 with error
        if (response.status === 200) {
          // Validate response structure matches TimeResponse schema
          expect(response.body).toHaveProperty('timestamp');
          expect(response.body).toHaveProperty('timezone');
          expect(response.body).toHaveProperty('utcOffset');
          expect(response.body).toHaveProperty('formatted');
          
          expect(response.body.formatted).toHaveProperty('date');
          expect(response.body.formatted).toHaveProperty('time');
          expect(response.body.formatted).toHaveProperty('full');

          // Validate data types
          expect(typeof response.body.timestamp).toBe('string');
          expect(typeof response.body.timezone).toBe('string');
          expect(typeof response.body.utcOffset).toBe('string');
          expect(typeof response.body.formatted.date).toBe('string');
          expect(typeof response.body.formatted.time).toBe('string');
          expect(typeof response.body.formatted.full).toBe('string');

          // Validate timezone format
          expect(response.body.timezone).toBe('America/New_York');
          
          // Validate UTC offset format (±HH:MM)
          expect(response.body.utcOffset).toMatch(/^[+-]\d{2}:\d{2}$/);
        } else {
          // If not 200, should be an error response with proper structure
          expect([400, 404]).toContain(response.status);
          expect(response.body).toHaveProperty('error');
          expect(response.body.error).toHaveProperty('code');
          expect(response.body.error).toHaveProperty('message');
          expect(response.body.error).toHaveProperty('timestamp');
        }
      });

      it('should match OpenAPI specification for error response', async () => {
        const response = await request(app)
          .get('/api/time/current/Invalid/Timezone');

        // Should return an error response (400 or 404)
        expect([400, 404]).toContain(response.status);

        // Validate error response structure matches ErrorResponse schema
        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toHaveProperty('code');
        expect(response.body.error).toHaveProperty('message');
        expect(response.body.error).toHaveProperty('timestamp');

        // Validate data types
        expect(typeof response.body.error.code).toBe('string');
        expect(typeof response.body.error.message).toBe('string');
        expect(typeof response.body.error.timestamp).toBe('string');
      });

      it('should validate all possible HTTP status codes defined in OpenAPI', async () => {
        const currentTimeEndpoint = openApiSpec.paths['/api/time/current/{timezone}']?.get;
        const definedStatusCodes = Object.keys(currentTimeEndpoint?.responses || {});
        
        // Test 200 response
        if (definedStatusCodes.includes('200')) {
          const response = await request(app)
            .get('/api/time/current/UTC')
            .expect(200);
          
          expect(response.body).toHaveProperty('timestamp');
          expect(response.body).toHaveProperty('timezone');
        }
        
        // Test 400 response
        if (definedStatusCodes.includes('400')) {
          const response = await request(app)
            .get('/api/time/current/InvalidTimezone')
            .expect(400);
          
          expect(response.body.error.code).toBeDefined();
        }
      });

      it('should validate parameter constraints from OpenAPI spec', async () => {
        const currentTimeEndpoint = openApiSpec.paths['/api/time/current/{timezone}']?.get;
        const timezoneParam = currentTimeEndpoint?.parameters?.[0];
        
        if (timezoneParam?.schema) {
          // Test parameter validation based on schema constraints
          const response = await request(app)
            .get('/api/time/current/')
            .expect(404); // Missing required parameter
          
          expect(response.body.error.code).toBe('NOT_FOUND');
        }
      });
    });

    describe('Time Conversion Endpoint Contract', () => {
      it('should match OpenAPI specification for successful response', async () => {
        const requestBody = {
          sourceTime: '2024-01-15T14:30:00',
          sourceTimezone: 'America/New_York',
          targetTimezone: 'Europe/London'
        };

        const response = await request(app)
          .post('/api/time/convert')
          .send(requestBody)
          .expect(200);

        // Validate response structure matches ConversionResponse schema
        expect(response.body).toHaveProperty('original');
        expect(response.body).toHaveProperty('converted');
        expect(response.body).toHaveProperty('utcOffsetDifference');

        // Validate original time structure
        expect(response.body.original).toHaveProperty('timestamp');
        expect(response.body.original).toHaveProperty('timezone');
        expect(response.body.original).toHaveProperty('formatted');

        // Validate converted time structure
        expect(response.body.converted).toHaveProperty('timestamp');
        expect(response.body.converted).toHaveProperty('timezone');
        expect(response.body.converted).toHaveProperty('formatted');

        // Validate data types
        expect(typeof response.body.original.timestamp).toBe('string');
        expect(typeof response.body.original.timezone).toBe('string');
        expect(typeof response.body.original.formatted).toBe('string');
        expect(typeof response.body.converted.timestamp).toBe('string');
        expect(typeof response.body.converted.timezone).toBe('string');
        expect(typeof response.body.converted.formatted).toBe('string');
        expect(typeof response.body.utcOffsetDifference).toBe('string');

        // Validate timezone values
        expect(response.body.original.timezone).toBe('America/New_York');
        expect(response.body.converted.timezone).toBe('Europe/London');
      });

      it('should match OpenAPI specification for validation error response', async () => {
        const invalidRequestBody = {
          sourceTime: 'invalid-date',
          sourceTimezone: 'America/New_York',
          targetTimezone: 'Europe/London'
        };

        const response = await request(app)
          .post('/api/time/convert')
          .send(invalidRequestBody)
          .expect(400);

        // Validate error response structure
        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toHaveProperty('code');
        expect(response.body.error).toHaveProperty('message');
        expect(response.body.error).toHaveProperty('timestamp');

        // Check if validation details are present (optional field)
        if (response.body.error.details) {
          expect(Array.isArray(response.body.error.details)).toBe(true);
          if (response.body.error.details.length > 0) {
            const detail = response.body.error.details[0];
            expect(detail).toHaveProperty('field');
            expect(detail).toHaveProperty('message');
            expect(detail).toHaveProperty('code');
          }
        }
      });

      it('should reject requests with missing required fields', async () => {
        const incompleteRequestBody = {
          sourceTime: '2024-01-15T14:30:00',
          sourceTimezone: 'America/New_York'
          // Missing targetTimezone
        };

        const response = await request(app)
          .post('/api/time/convert')
          .send(incompleteRequestBody)
          .expect(400);

        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toHaveProperty('code');
        expect(response.body.error).toHaveProperty('message');
      });
    });

    describe('Health Endpoint Contract', () => {
      it('should match OpenAPI specification for health response', async () => {
        const response = await request(app)
          .get('/health')
          .expect(200);

        // Validate response structure matches HealthResponse schema
        expect(response.body).toHaveProperty('status');
        expect(response.body).toHaveProperty('uptime');
        expect(response.body).toHaveProperty('memory');
        expect(response.body).toHaveProperty('version');
        expect(response.body).toHaveProperty('timestamp');

        // Validate memory object structure
        expect(response.body.memory).toHaveProperty('used');
        expect(response.body.memory).toHaveProperty('total');
        expect(response.body.memory).toHaveProperty('percentage');

        // Validate data types
        expect(typeof response.body.status).toBe('string');
        expect(typeof response.body.uptime).toBe('number');
        expect(typeof response.body.memory.used).toBe('number');
        expect(typeof response.body.memory.total).toBe('number');
        expect(typeof response.body.memory.percentage).toBe('number');
        expect(typeof response.body.version).toBe('string');
        expect(typeof response.body.timestamp).toBe('string');

        // Validate status enum values
        expect(['healthy', 'degraded', 'unhealthy']).toContain(response.body.status);

        // Validate numeric constraints
        expect(response.body.uptime).toBeGreaterThanOrEqual(0);
        expect(response.body.memory.used).toBeGreaterThanOrEqual(0);
        expect(response.body.memory.total).toBeGreaterThanOrEqual(0);
        expect(response.body.memory.percentage).toBeGreaterThanOrEqual(0);
        expect(response.body.memory.percentage).toBeLessThanOrEqual(100);
      });
    });
  });

  describe('Documentation Examples Validation', () => {
    it('should have working examples in OpenAPI specification', () => {
      const currentTimeEndpoint = openApiSpec.paths['/api/time/current/{timezone}']?.get;
      const convertTimeEndpoint = openApiSpec.paths['/api/time/convert']?.post;

      // Check parameter examples
      const timezoneParam = currentTimeEndpoint?.parameters?.[0];
      expect(timezoneParam?.examples).toBeDefined();
      expect(timezoneParam?.examples?.['new-york']?.value).toBe('America/New_York');
      expect(timezoneParam?.examples?.['london']?.value).toBe('Europe/London');
      expect(timezoneParam?.examples?.['tokyo']?.value).toBe('Asia/Tokyo');

      // Check request body examples
      const requestBodyExamples = convertTimeEndpoint?.requestBody?.content?.['application/json']?.examples;
      expect(requestBodyExamples).toBeDefined();
      expect(requestBodyExamples?.['ny-to-london']?.value).toEqual({
        sourceTime: '2024-01-15T14:30:00',
        sourceTimezone: 'America/New_York',
        targetTimezone: 'Europe/London'
      });
    });

    it('should have comprehensive response examples', () => {
      const currentTimeEndpoint = openApiSpec.paths['/api/time/current/{timezone}']?.get;
      const convertTimeEndpoint = openApiSpec.paths['/api/time/convert']?.post;
      const healthEndpoint = openApiSpec.paths['/health']?.get;

      // Check response examples exist
      expect(currentTimeEndpoint?.responses?.['200']?.content?.['application/json']?.examples).toBeDefined();
      expect(convertTimeEndpoint?.responses?.['200']?.content?.['application/json']?.examples).toBeDefined();
      expect(healthEndpoint?.responses?.['200']?.content?.['application/json']?.examples).toBeDefined();

      // Check error response examples
      expect(currentTimeEndpoint?.responses?.['400']?.content?.['application/json']?.examples).toBeDefined();
      expect(convertTimeEndpoint?.responses?.['400']?.content?.['application/json']?.examples).toBeDefined();
    });
  });

  describe('Schema Reference Validation', () => {
    it('should have all schema references properly defined', () => {
      const schemas = openApiSpec.components?.schemas;
      
      // Extract all $ref values from the specification
      const specString = JSON.stringify(openApiSpec);
      const refMatches = specString.match(/"\$ref":\s*"#\/components\/schemas\/([^"]+)"/g);
      
      if (refMatches) {
        const referencedSchemas = refMatches.map(match => {
          const schemaName = match.match(/schemas\/([^"]+)/)?.[1];
          return schemaName;
        }).filter(Boolean);

        // Check that all referenced schemas are defined
        referencedSchemas.forEach(schemaName => {
          expect(schemas).toHaveProperty(schemaName!);
        });
      }
    });

    it('should have proper schema structure for all defined schemas', () => {
      const schemas = openApiSpec.components?.schemas;
      
      Object.keys(schemas || {}).forEach(schemaName => {
        const schema = schemas![schemaName];
        expect(schema).toHaveProperty('type');
        expect(schema).toHaveProperty('properties');
        
        // Check if required fields are properly defined
        if ('required' in schema && schema.required) {
          expect(Array.isArray(schema.required)).toBe(true);
        }
      });
    });
  });

  describe('Complete API Contract Testing', () => {
    describe('Response Schema Validation', () => {
      it('should validate TimeResponse schema against actual API response', async () => {
        const response = await request(app)
          .get('/api/time/current/UTC')
          .expect(200);

        const timeResponseSchema = openApiSpec.components?.schemas?.TimeResponse;
        expect(timeResponseSchema).toBeDefined();

        // Validate all required properties are present
        const requiredProps = timeResponseSchema?.required || [];
        requiredProps.forEach(prop => {
          expect(response.body).toHaveProperty(prop);
        });

        // Validate property types match schema
        const properties = timeResponseSchema?.properties;
        if (properties) {
          Object.keys(properties).forEach(propName => {
            if (response.body[propName] !== undefined) {
              const propSchema = properties[propName];
              if (propSchema.type === 'string') {
                expect(typeof response.body[propName]).toBe('string');
              } else if (propSchema.type === 'object') {
                expect(typeof response.body[propName]).toBe('object');
              }
            }
          });
        }
      });

      it('should validate ConversionResponse schema against actual API response', async () => {
        const requestBody = {
          sourceTime: '2024-01-15T14:30:00',
          sourceTimezone: 'UTC',
          targetTimezone: 'UTC'
        };

        const response = await request(app)
          .post('/api/time/convert')
          .send(requestBody)
          .expect(200);

        const conversionResponseSchema = openApiSpec.components?.schemas?.ConversionResponse;
        expect(conversionResponseSchema).toBeDefined();

        // Validate all required properties are present
        const requiredProps = conversionResponseSchema?.required || [];
        requiredProps.forEach(prop => {
          expect(response.body).toHaveProperty(prop);
        });
      });

      it('should validate ErrorResponse schema against actual error responses', async () => {
        const response = await request(app)
          .get('/api/time/current/InvalidTimezone')
          .expect(400);

        const errorResponseSchema = openApiSpec.components?.schemas?.ErrorResponse;
        expect(errorResponseSchema).toBeDefined();

        // Validate error response structure
        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toHaveProperty('code');
        expect(response.body.error).toHaveProperty('message');
        expect(response.body.error).toHaveProperty('timestamp');

        // Validate types
        expect(typeof response.body.error.code).toBe('string');
        expect(typeof response.body.error.message).toBe('string');
        expect(typeof response.body.error.timestamp).toBe('string');
      });

      it('should validate HealthResponse schema against actual health response', async () => {
        const response = await request(app)
          .get('/health')
          .expect(200);

        const healthResponseSchema = openApiSpec.components?.schemas?.HealthResponse;
        expect(healthResponseSchema).toBeDefined();

        // Validate all required properties are present
        const requiredProps = healthResponseSchema?.required || [];
        requiredProps.forEach(prop => {
          expect(response.body).toHaveProperty(prop);
        });

        // Validate status enum
        expect(['healthy', 'degraded', 'unhealthy']).toContain(response.body.status);
      });
    });

    describe('Request Schema Validation', () => {
      it('should validate ConversionRequest schema enforcement', async () => {
        const conversionRequestSchema = openApiSpec.components?.schemas?.ConversionRequest;
        expect(conversionRequestSchema).toBeDefined();

        // Test with valid request matching schema
        const validRequest = {
          sourceTime: '2024-01-15T14:30:00',
          sourceTimezone: 'America/New_York',
          targetTimezone: 'Europe/London'
        };

        const validResponse = await request(app)
          .post('/api/time/convert')
          .send(validRequest)
          .expect(200);

        expect(validResponse.body).toHaveProperty('original');
        expect(validResponse.body).toHaveProperty('converted');

        // Test with invalid request (missing required field)
        const invalidRequest = {
          sourceTime: '2024-01-15T14:30:00',
          sourceTimezone: 'America/New_York'
          // Missing targetTimezone
        };

        const invalidResponse = await request(app)
          .post('/api/time/convert')
          .send(invalidRequest)
          .expect(400);

        expect(invalidResponse.body.error.code).toBe('VALIDATION_ERROR');
      });

      it('should validate parameter schemas for path parameters', async () => {
        const currentTimeEndpoint = openApiSpec.paths['/api/time/current/{timezone}']?.get;
        const timezoneParam = currentTimeEndpoint?.parameters?.[0];
        
        expect(timezoneParam).toBeDefined();
        expect(timezoneParam?.name).toBe('timezone');
        expect(timezoneParam?.in).toBe('path');
        expect(timezoneParam?.required).toBe(true);

        // Test valid timezone parameter
        const validResponse = await request(app)
          .get('/api/time/current/UTC')
          .expect(200);

        expect(validResponse.body.timezone).toBe('UTC');

        // Test invalid timezone parameter
        const invalidResponse = await request(app)
          .get('/api/time/current/InvalidTimezone')
          .expect(400);

        expect(invalidResponse.body.error.code).toBe('VALIDATION_ERROR');
      });
    });

    describe('HTTP Status Code Compliance', () => {
      it('should return only status codes defined in OpenAPI spec', async () => {
        const paths = openApiSpec.paths;
        
        // Test current time endpoint
        const currentTimeEndpoint = paths['/api/time/current/{timezone}']?.get;
        const currentTimeStatusCodes = Object.keys(currentTimeEndpoint?.responses || {}).map(Number);
        
        // Valid timezone should return 200
        const validResponse = await request(app)
          .get('/api/time/current/UTC')
          .expect(200);
        expect(currentTimeStatusCodes).toContain(200);

        // Invalid timezone should return 400
        const invalidResponse = await request(app)
          .get('/api/time/current/InvalidTimezone')
          .expect(400);
        expect(currentTimeStatusCodes).toContain(400);

        // Test conversion endpoint
        const convertEndpoint = paths['/api/time/convert']?.post;
        const convertStatusCodes = Object.keys(convertEndpoint?.responses || {}).map(Number);

        // Valid conversion should return 200
        const validConversionResponse = await request(app)
          .post('/api/time/convert')
          .send({
            sourceTime: '2024-01-15T14:30:00',
            sourceTimezone: 'UTC',
            targetTimezone: 'UTC'
          })
          .expect(200);
        expect(convertStatusCodes).toContain(200);

        // Invalid conversion should return 400
        const invalidConversionResponse = await request(app)
          .post('/api/time/convert')
          .send({ invalid: 'data' })
          .expect(400);
        expect(convertStatusCodes).toContain(400);
      });

      it('should include proper response headers as defined in OpenAPI spec', async () => {
        // Test that responses include expected headers
        const response = await request(app)
          .get('/api/time/current/UTC')
          .expect(200);

        // Should have content-type header
        expect(response.headers['content-type']).toMatch(/application\/json/);

        // Should have CORS headers
        expect(response.headers).toHaveProperty('access-control-allow-origin');
      });
    });

    describe('Content Type Validation', () => {
      it('should accept and return content types as specified in OpenAPI', async () => {
        const convertEndpoint = openApiSpec.paths['/api/time/convert']?.post;
        const requestContentTypes = Object.keys(convertEndpoint?.requestBody?.content || {});
        const responseContentTypes = Object.keys(convertEndpoint?.responses?.['200']?.content || {});

        // Should accept application/json for requests
        expect(requestContentTypes).toContain('application/json');

        const response = await request(app)
          .post('/api/time/convert')
          .set('Content-Type', 'application/json')
          .send({
            sourceTime: '2024-01-15T14:30:00',
            sourceTimezone: 'UTC',
            targetTimezone: 'UTC'
          })
          .expect(200);

        // Should return application/json for responses
        expect(responseContentTypes).toContain('application/json');
        expect(response.headers['content-type']).toMatch(/application\/json/);
      });

      it('should reject unsupported content types', async () => {
        const response = await request(app)
          .post('/api/time/convert')
          .set('Content-Type', 'text/plain')
          .send('plain text data')
          .expect(400);

        expect(response.body.error).toBeDefined();
      });
    });

    describe('API Documentation Completeness', () => {
      it('should have descriptions for all endpoints', () => {
        const paths = openApiSpec.paths;
        
        Object.keys(paths).forEach(pathKey => {
          const pathItem = paths[pathKey];
          Object.keys(pathItem).forEach(method => {
            const operation = pathItem[method];
            expect(operation.summary || operation.description).toBeDefined();
          });
        });
      });

      it('should have examples for all request/response schemas', () => {
        const paths = openApiSpec.paths;
        
        // Check that POST endpoints have request body examples
        const postEndpoints = Object.keys(paths).filter(path => paths[path].post);
        postEndpoints.forEach(path => {
          const postOp = paths[path].post;
          const requestBody = postOp?.requestBody?.content?.['application/json'];
          if (requestBody) {
            expect(requestBody.examples || requestBody.example).toBeDefined();
          }
        });

        // Check that successful responses have examples
        Object.keys(paths).forEach(pathKey => {
          const pathItem = paths[pathKey];
          Object.keys(pathItem).forEach(method => {
            const operation = pathItem[method];
            const successResponse = operation.responses?.['200'];
            if (successResponse?.content?.['application/json']) {
              const content = successResponse.content['application/json'];
              expect(content.examples || content.example).toBeDefined();
            }
          });
        });
      });

      it('should have proper tags for endpoint organization', () => {
        const paths = openApiSpec.paths;
        
        Object.keys(paths).forEach(pathKey => {
          const pathItem = paths[pathKey];
          Object.keys(pathItem).forEach(method => {
            const operation = pathItem[method];
            expect(operation.tags).toBeDefined();
            expect(Array.isArray(operation.tags)).toBe(true);
            expect(operation.tags.length).toBeGreaterThan(0);
          });
        });
      });
    });
  });
});