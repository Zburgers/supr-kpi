import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'KPI ETL Pipeline API',
      version: '2.0.0',
      description: 'API documentation for the KPI ETL Pipeline that handles data synchronization from Meta Ads, GA4, Shopify to Google Sheets',
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
      {
        url: 'https://your-production-url.com',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        // Common response schemas
        ApiResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true,
            },
            data: {
              type: 'object',
              description: 'Response data',
            },
            error: {
              type: 'string',
              description: 'Error message if success is false',
            },
          },
        },
        Credential: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              example: 'cred_1234567890',
            },
            service: {
              type: 'string',
              enum: ['google_sheets', 'meta', 'ga4', 'shopify'],
              example: 'meta',
            },
            name: {
              type: 'string',
              example: 'Meta Ad Account Credentials',
            },
            type: {
              type: 'string',
              example: 'oauth_token',
            },
            verified: {
              type: 'boolean',
              example: true,
            },
            verifiedAt: {
              type: 'string',
              format: 'date-time',
              example: '2023-01-01T00:00:00.000Z',
            },
          },
        },
        ServiceConfig: {
          type: 'object',
          properties: {
            service: {
              type: 'string',
              enum: ['google_sheets', 'meta', 'ga4', 'shopify'],
              example: 'meta',
            },
            enabled: {
              type: 'boolean',
              example: true,
            },
            credentialId: {
              type: 'string',
              example: 'cred_1234567890',
            },
          },
        },
        SheetMapping: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              example: 'map_1234567890',
            },
            service: {
              type: 'string',
              enum: ['google_sheets', 'meta', 'ga4', 'shopify'],
              example: 'meta',
            },
            spreadsheetId: {
              type: 'string',
              example: '1HlVbOXTfNJjHCt2fzHz8uCkZjUBHxFPRXB-2mcVNvu8',
            },
            sheetName: {
              type: 'string',
              example: 'MetaData',
            },
            credentialId: {
              type: 'string',
              example: 'cred_1234567890',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              example: '2023-01-01T00:00:00.000Z',
            },
          },
        },
        Schedule: {
          type: 'object',
          properties: {
            service: {
              type: 'string',
              enum: ['meta', 'ga4', 'shopify'],
              example: 'meta',
            },
            cron: {
              type: 'string',
              example: '0 6 * * *',
            },
            enabled: {
              type: 'boolean',
              example: true,
            },
            lastRunAt: {
              type: 'string',
              format: 'date-time',
              example: '2023-01-01T06:00:00.000Z',
            },
            nextRunAt: {
              type: 'string',
              format: 'date-time',
              example: '2023-01-02T06:00:00.000Z',
            },
          },
        },
        ActivityLogEntry: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              example: 'log_1234567890',
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              example: '2023-01-01T00:00:00.000Z',
            },
            service: {
              type: 'string',
              enum: ['meta', 'ga4', 'shopify'],
              example: 'meta',
            },
            action: {
              type: 'string',
              example: 'sync',
            },
            status: {
              type: 'string',
              enum: ['success', 'failure', 'partial'],
              example: 'success',
            },
            recordCount: {
              type: 'integer',
              example: 100,
            },
            durationMs: {
              type: 'integer',
              example: 5000,
            },
            errorMessage: {
              type: 'string',
              example: 'Some error occurred',
            },
          },
        },
      },
    },
  },
  apis: [
    './src/routes/*.ts',
    './src/server/app.ts',
    './src/server/index.ts',
    './src/adapters/*.ts',
    './src/services/*.ts'
  ],
};

const specs = swaggerJsdoc(options);
export default specs;