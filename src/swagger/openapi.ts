import { OpenAPIV3 } from 'openapi-types';
import { config } from '../config';

/**
 * Generate server URLs based on current environment and configuration
 */
function generateServerUrls(): OpenAPIV3.ServerObject[] {
  const servers: OpenAPIV3.ServerObject[] = [];
  
  // If configured to show only production URL, return just that
  if (config.SWAGGER_SHOW_ONLY_PRODUCTION && config.PRODUCTION_URL) {
    return [{
      url: config.PRODUCTION_URL,
      description: 'Production server'
    }];
  }
  
  // Current server URL (dynamic based on environment)
  const currentPort = config.PORT;
  const currentHost = config.HOST;
  const protocol = config.HTTPS ? 'https' : 'http';
  
  // Add current server as primary
  const currentUrl = `${protocol}://${currentHost}:${currentPort}`;
  servers.push({
    url: currentUrl,
    description: `Current server (${config.NODE_ENV})`
  });
  
  // Add environment-specific servers
  if (config.NODE_ENV === 'development') {
    // Add localhost alternatives for development
    if (currentHost !== 'localhost') {
      servers.push({
        url: `http://localhost:${currentPort}`,
        description: 'Local development server'
      });
    }
    if (currentHost !== '0.0.0.0') {
      servers.push({
        url: `http://0.0.0.0:${currentPort}`,
        description: 'Docker development server'
      });
    }
  } else if (config.NODE_ENV === 'production') {
    // Add production server URL if different from current
    if (config.PRODUCTION_URL && config.PRODUCTION_URL !== currentUrl) {
      servers.push({
        url: config.PRODUCTION_URL,
        description: 'Production server'
      });
    }
  }
  
  // Remove duplicates
  const uniqueServers = servers.filter((server, index, self) => 
    index === self.findIndex(s => s.url === server.url)
  );
  
  return uniqueServers;
}

/**
 * OpenAPI 3.0 specification for the Timezone API Server
 */
export const openApiSpec: OpenAPIV3.Document = {
  openapi: '3.0.3',
  info: {
    title: 'Timezone API Server',
    description: 'A RESTful API server for timezone operations including current time retrieval and time conversion between timezones.',
    version: '1.0.0',
    contact: {
      name: 'API Support',
      email: 'support@example.com'
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT'
    }
  },
  servers: generateServerUrls(),
  paths: {
    '/api/time/current/{timezone}': {
      get: {
        summary: 'Get current time in specified timezone (GET)',
        description: 'Retrieves the current date and time in the specified timezone with formatting and UTC offset information. Note: Some timezone identifiers may cause URL encoding issues; consider using the POST endpoint instead.',
        operationId: 'getCurrentTimeGet',
        tags: ['Time Operations'],
        parameters: [
          {
            name: 'timezone',
            in: 'path',
            required: true,
            description: 'IANA timezone identifier (e.g., America/New_York, Europe/London)',
            schema: {
              type: 'string',
              pattern: '^[A-Za-z_]+/[A-Za-z_]+$',
              example: 'America/New_York'
            },
            examples: {
              'new-york': {
                value: 'America/New_York',
                summary: 'New York timezone'
              },
              'london': {
                value: 'Europe/London',
                summary: 'London timezone'
              },
              'tokyo': {
                value: 'Asia/Tokyo',
                summary: 'Tokyo timezone'
              }
            }
          }
        ],
        responses: {
          '200': {
            description: 'Current time retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/TimeResponse'
                },
                examples: {
                  'new-york-time': {
                    summary: 'Current time in New York',
                    value: {
                      timestamp: '2024-01-15T14:30:00.000Z',
                      timezone: 'America/New_York',
                      utcOffset: '-05:00',
                      formatted: {
                        date: '2024-01-15',
                        time: '09:30:00',
                        full: 'January 15, 2024 at 9:30:00 AM EST'
                      }
                    }
                  }
                }
              }
            }
          },
          '400': {
            description: 'Invalid timezone parameter',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse'
                },
                examples: {
                  'invalid-timezone': {
                    summary: 'Invalid timezone format',
                    value: {
                      error: {
                        code: 'INVALID_TIMEZONE',
                        message: 'Invalid timezone identifier. Use IANA timezone format (e.g., America/New_York)',
                        timestamp: '2024-01-15T14:30:00.000Z'
                      }
                    }
                  }
                }
              }
            }
          },
          '500': {
            description: 'Internal server error',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse'
                }
              }
            }
          }
        }
      }
    },
    '/api/time/current': {
      post: {
        summary: 'Get current time in specified timezone (POST)',
        description: 'Retrieves the current date and time in the specified timezone with formatting and UTC offset information. This endpoint is recommended for timezone identifiers that may cause URL encoding issues.',
        operationId: 'getCurrentTimePost',
        tags: ['Time Operations'],
        requestBody: {
          required: true,
          description: 'Timezone request parameters',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['timezone'],
                properties: {
                  timezone: {
                    type: 'string',
                    description: 'IANA timezone identifier',
                    example: 'Europe/Paris'
                  }
                }
              },
              examples: {
                'paris': {
                  summary: 'Paris timezone',
                  value: {
                    timezone: 'Europe/Paris'
                  }
                },
                'tokyo': {
                  summary: 'Tokyo timezone',
                  value: {
                    timezone: 'Asia/Tokyo'
                  }
                },
                'new-york': {
                  summary: 'New York timezone',
                  value: {
                    timezone: 'America/New_York'
                  }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Current time retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/TimeResponse'
                },
                examples: {
                  'paris-time': {
                    summary: 'Current time in Paris',
                    value: {
                      timestamp: '2024-01-15T14:30:00.000Z',
                      timezone: 'Europe/Paris',
                      utcOffset: '+01:00',
                      formatted: {
                        date: '2024-01-15',
                        time: '15:30:00',
                        full: 'January 15, 2024 at 3:30:00 PM CET'
                      }
                    }
                  }
                }
              }
            }
          },
          '400': {
            description: 'Invalid timezone parameter',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse'
                },
                examples: {
                  'invalid-timezone': {
                    summary: 'Invalid timezone format',
                    value: {
                      error: {
                        code: 'INVALID_TIMEZONE',
                        message: 'Invalid timezone identifier. Use IANA timezone format (e.g., America/New_York)',
                        timestamp: '2024-01-15T14:30:00.000Z'
                      }
                    }
                  }
                }
              }
            }
          },
          '500': {
            description: 'Internal server error',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse'
                }
              }
            }
          }
        }
      }
    },
    '/api/time/convert': {
      post: {
        summary: 'Convert time between timezones',
        description: 'Converts a specific time from one timezone to another, providing both original and converted time information.',
        operationId: 'convertTime',
        tags: ['Time Operations'],
        requestBody: {
          required: true,
          description: 'Time conversion request parameters',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ConversionRequest'
              },
              examples: {
                'ny-to-london': {
                  summary: 'Convert New York time to London',
                  value: {
                    sourceTime: '2024-01-15T14:30:00',
                    sourceTimezone: 'America/New_York',
                    targetTimezone: 'Europe/London'
                  }
                },
                'utc-to-tokyo': {
                  summary: 'Convert UTC time to Tokyo',
                  value: {
                    sourceTime: '2024-01-15T12:00:00Z',
                    sourceTimezone: 'UTC',
                    targetTimezone: 'Asia/Tokyo'
                  }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Time converted successfully',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ConversionResponse'
                },
                examples: {
                  'ny-to-london-result': {
                    summary: 'New York to London conversion result',
                    value: {
                      original: {
                        timestamp: '2024-01-15T14:30:00-05:00',
                        timezone: 'America/New_York',
                        formatted: 'January 15, 2024 at 2:30:00 PM EST'
                      },
                      converted: {
                        timestamp: '2024-01-15T19:30:00+00:00',
                        timezone: 'Europe/London',
                        formatted: 'January 15, 2024 at 7:30:00 PM GMT'
                      },
                      utcOffsetDifference: '+05:00'
                    }
                  }
                }
              }
            }
          },
          '400': {
            description: 'Invalid request parameters',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse'
                },
                examples: {
                  'validation-error': {
                    summary: 'Validation error example',
                    value: {
                      error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Request validation failed',
                        details: [
                          {
                            field: 'sourceTime',
                            message: 'Invalid datetime format. Use ISO 8601 format or valid date string',
                            code: 'INVALID_FORMAT'
                          }
                        ],
                        timestamp: '2024-01-15T14:30:00.000Z'
                      }
                    }
                  }
                }
              }
            }
          },
          '500': {
            description: 'Internal server error',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse'
                }
              }
            }
          }
        }
      }
    },
    '/health': {
      get: {
        summary: 'Health check endpoint',
        description: 'Returns the current health status of the API server including uptime, memory usage, and service version.',
        operationId: 'getHealth',
        tags: ['Health'],
        responses: {
          '200': {
            description: 'Service is healthy',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HealthResponse'
                },
                examples: {
                  'healthy-service': {
                    summary: 'Healthy service response',
                    value: {
                      status: 'healthy',
                      uptime: 3600,
                      memory: {
                        used: 52428800,
                        total: 134217728,
                        percentage: 39
                      },
                      version: '1.0.0',
                      timestamp: '2024-01-15T14:30:00.000Z'
                    }
                  }
                }
              }
            }
          },
          '503': {
            description: 'Service is degraded or unhealthy',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HealthResponse'
                },
                examples: {
                  'degraded-service': {
                    summary: 'Degraded service response',
                    value: {
                      status: 'degraded',
                      uptime: 3600,
                      memory: {
                        used: 0,
                        total: 0,
                        percentage: 0
                      },
                      version: '1.0.0',
                      timestamp: '2024-01-15T14:30:00.000Z'
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  },
  components: {
    schemas: {
      TimeResponse: {
        type: 'object',
        required: ['timestamp', 'timezone', 'utcOffset', 'formatted'],
        properties: {
          timestamp: {
            type: 'string',
            format: 'date-time',
            description: 'ISO 8601 formatted timestamp',
            example: '2024-01-15T14:30:00.000Z'
          },
          timezone: {
            type: 'string',
            description: 'IANA timezone identifier',
            example: 'America/New_York'
          },
          utcOffset: {
            type: 'string',
            pattern: '^[+-]\\d{2}:\\d{2}$',
            description: 'UTC offset in ±HH:MM format',
            example: '-05:00'
          },
          formatted: {
            type: 'object',
            required: ['date', 'time', 'full'],
            properties: {
              date: {
                type: 'string',
                description: 'Human-readable date',
                example: '2024-01-15'
              },
              time: {
                type: 'string',
                description: 'Human-readable time',
                example: '09:30:00'
              },
              full: {
                type: 'string',
                description: 'Full formatted datetime',
                example: 'January 15, 2024 at 9:30:00 AM EST'
              }
            }
          }
        }
      },
      ConversionRequest: {
        type: 'object',
        required: ['sourceTime', 'sourceTimezone', 'targetTimezone'],
        properties: {
          sourceTime: {
            type: 'string',
            description: 'Source time in ISO 8601 format or valid date string',
            example: '2024-01-15T14:30:00'
          },
          sourceTimezone: {
            type: 'string',
            description: 'IANA timezone identifier for source time',
            example: 'America/New_York'
          },
          targetTimezone: {
            type: 'string',
            description: 'IANA timezone identifier for target conversion',
            example: 'Europe/London'
          }
        }
      },
      ConversionResponse: {
        type: 'object',
        required: ['original', 'converted', 'utcOffsetDifference'],
        properties: {
          original: {
            type: 'object',
            required: ['timestamp', 'timezone', 'formatted'],
            properties: {
              timestamp: {
                type: 'string',
                format: 'date-time',
                description: 'Original timestamp with timezone',
                example: '2024-01-15T14:30:00-05:00'
              },
              timezone: {
                type: 'string',
                description: 'Original timezone',
                example: 'America/New_York'
              },
              formatted: {
                type: 'string',
                description: 'Formatted original time',
                example: 'January 15, 2024 at 2:30:00 PM EST'
              }
            }
          },
          converted: {
            type: 'object',
            required: ['timestamp', 'timezone', 'formatted'],
            properties: {
              timestamp: {
                type: 'string',
                format: 'date-time',
                description: 'Converted timestamp with timezone',
                example: '2024-01-15T19:30:00+00:00'
              },
              timezone: {
                type: 'string',
                description: 'Target timezone',
                example: 'Europe/London'
              },
              formatted: {
                type: 'string',
                description: 'Formatted converted time',
                example: 'January 15, 2024 at 7:30:00 PM GMT'
              }
            }
          },
          utcOffsetDifference: {
            type: 'string',
            description: 'Time difference between source and target timezones',
            example: '+05:00'
          }
        }
      },
      HealthResponse: {
        type: 'object',
        required: ['status', 'uptime', 'memory', 'version', 'timestamp'],
        properties: {
          status: {
            type: 'string',
            enum: ['healthy', 'degraded', 'unhealthy'],
            description: 'Current health status of the service'
          },
          uptime: {
            type: 'integer',
            minimum: 0,
            description: 'Service uptime in seconds',
            example: 3600
          },
          memory: {
            type: 'object',
            required: ['used', 'total', 'percentage'],
            properties: {
              used: {
                type: 'integer',
                minimum: 0,
                description: 'Used memory in bytes',
                example: 52428800
              },
              total: {
                type: 'integer',
                minimum: 0,
                description: 'Total memory in bytes',
                example: 134217728
              },
              percentage: {
                type: 'integer',
                minimum: 0,
                maximum: 100,
                description: 'Memory usage percentage',
                example: 39
              }
            }
          },
          version: {
            type: 'string',
            description: 'Service version',
            example: '1.0.0'
          },
          timestamp: {
            type: 'string',
            format: 'date-time',
            description: 'Timestamp of the health check',
            example: '2024-01-15T14:30:00.000Z'
          }
        }
      },
      ErrorResponse: {
        type: 'object',
        required: ['error'],
        properties: {
          error: {
            type: 'object',
            required: ['code', 'message', 'timestamp'],
            properties: {
              code: {
                type: 'string',
                description: 'Error code identifier',
                example: 'INVALID_TIMEZONE'
              },
              message: {
                type: 'string',
                description: 'Human-readable error message',
                example: 'Invalid timezone identifier'
              },
              details: {
                type: 'array',
                description: 'Additional error details (optional)',
                items: {
                  $ref: '#/components/schemas/ValidationError'
                }
              },
              timestamp: {
                type: 'string',
                format: 'date-time',
                description: 'Timestamp when the error occurred',
                example: '2024-01-15T14:30:00.000Z'
              }
            }
          }
        }
      },
      ValidationError: {
        type: 'object',
        required: ['field', 'message', 'code'],
        properties: {
          field: {
            type: 'string',
            description: 'Field that failed validation',
            example: 'sourceTime'
          },
          message: {
            type: 'string',
            description: 'Validation error message',
            example: 'Invalid datetime format'
          },
          code: {
            type: 'string',
            description: 'Validation error code',
            example: 'INVALID_FORMAT'
          }
        }
      }
    }
  },
  tags: [
    {
      name: 'Time Operations',
      description: 'Operations for timezone and time conversion functionality'
    },
    {
      name: 'Health',
      description: 'Health check and monitoring endpoints'
    }
  ]
};