import { Express } from 'express';
import swaggerUi from 'swagger-ui-express';
import { openApiSpec } from './openapi';

/**
 * Swagger UI configuration options
 */
const swaggerOptions: swaggerUi.SwaggerUiOptions = {
  explorer: true,
  swaggerOptions: {
    docExpansion: 'list',
    filter: true,
    showRequestDuration: true,
    tryItOutEnabled: true,
    requestInterceptor: (req: any) => {
      // Add any request interceptors here if needed
      return req;
    }
  },
  customCss: `
    .swagger-ui .topbar { display: none }
    .swagger-ui .info .title { color: #3b82f6 }
  `,
  customSiteTitle: 'Timezone API Documentation',
  customfavIcon: '/favicon.ico'
};

/**
 * Sets up Swagger UI documentation endpoint
 * @param app Express application instance
 */
export function setupSwagger(app: Express): void {
  // Serve the OpenAPI spec as JSON (dynamically generated)
  app.get('/api/docs/openapi.json', (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(openApiSpec);
  });

  // Serve Swagger UI at /api/docs
  app.use(
    '/api/docs',
    swaggerUi.serve,
    swaggerUi.setup(openApiSpec, swaggerOptions)
  );

  // Log available servers
  const servers = openApiSpec.servers || [];
  console.log('📚 Swagger documentation available at /api/docs');
  console.log('📄 OpenAPI spec available at /api/docs/openapi.json');
  console.log('🌐 Available servers:');
  servers.forEach((server, index) => {
    console.log(`  ${index + 1}. ${server.url} - ${server.description}`);
  });
}

/**
 * Validates that the OpenAPI specification is valid
 * This function can be extended to include more comprehensive validation
 */
export function validateOpenApiSpec(): boolean {
  try {
    // Basic validation checks
    if (!openApiSpec.openapi) {
      throw new Error('Missing OpenAPI version');
    }

    if (!openApiSpec.info || !openApiSpec.info.title || !openApiSpec.info.version) {
      throw new Error('Missing required info fields');
    }

    if (!openApiSpec.paths || Object.keys(openApiSpec.paths).length === 0) {
      throw new Error('No paths defined in specification');
    }

    // Validate that all referenced schemas exist
    const schemaRefs = new Set<string>();
    const definedSchemas = new Set(
      Object.keys(openApiSpec.components?.schemas || {})
    );

    // Extract schema references from the spec (simplified validation)
    const specString = JSON.stringify(openApiSpec);
    const refMatches = specString.match(/"\$ref":\s*"#\/components\/schemas\/([^"]+)"/g);
    
    if (refMatches) {
      refMatches.forEach(match => {
        const schemaName = match.match(/schemas\/([^"]+)/)?.[1];
        if (schemaName) {
          schemaRefs.add(schemaName);
        }
      });
    }

    // Check if all referenced schemas are defined
    for (const ref of schemaRefs) {
      if (!definedSchemas.has(ref)) {
        throw new Error(`Referenced schema '${ref}' is not defined`);
      }
    }

    console.log('✅ OpenAPI specification validation passed');
    return true;
  } catch (error) {
    console.error('❌ OpenAPI specification validation failed:', error);
    return false;
  }
}