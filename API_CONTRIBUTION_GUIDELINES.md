# API Contribution Guidelines

This document provides guidelines and best practices for contributing to the KPI ETL Pipeline API. These standards ensure consistency, maintainability, and scalability of the API.

## Table of Contents

1. [General Principles](#general-principles)
2. [API Design Standards](#api-design-standards)
3. [Code Structure](#code-structure)
4. [Documentation Standards](#documentation-standards)
5. [Security Practices](#security-practices)
6. [Testing Requirements](#testing-requirements)
7. [Versioning](#versioning)
8. [Performance Considerations](#performance-considerations)

## General Principles

### 1. Consistency First
- Follow existing patterns in the codebase
- Maintain consistency with established naming conventions
- Use the same architectural patterns as existing endpoints

### 2. Backward Compatibility
- Always maintain backward compatibility when possible
- Use versioning for breaking changes
- Deprecate endpoints gradually with sufficient notice

### 3. Security by Default
- All endpoints require authentication unless explicitly public
- Input validation is mandatory
- Follow security best practices for data handling

## API Design Standards

### RESTful Design
- Use standard HTTP methods (GET, POST, PUT, DELETE)
- Use plural nouns for resource names (e.g., `/users`, not `/user`)
- Use nested resources when appropriate (e.g., `/users/{id}/credentials`)
- Use query parameters for filtering, sorting, and pagination

### Endpoint Structure
```
/api/v1/<resource>[/subresource][/:id][/action]
```

Examples:
- `GET /api/v1/users` - List all users
- `GET /api/v1/users/123` - Get specific user
- `POST /api/v1/users` - Create a user
- `PUT /api/v1/users/123` - Update a user
- `DELETE /api/v1/users/123` - Delete a user
- `POST /api/v1/users/123/activate` - Custom action

### HTTP Status Codes
- `200`: Success for GET, PUT, PATCH
- `201`: Created for POST
- `204`: No Content for successful DELETE
- `400`: Bad Request - client error
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found
- `422`: Unprocessable Entity - validation error
- `429`: Too Many Requests - rate limiting
- `500`: Internal Server Error

### Request/Response Format
- Use JSON for all request/response bodies
- Follow the common response structure:
```json
{
  "success": true,
  "data": {},
  "error": "string"
}
```

### Error Responses
- Include error codes for better client handling
- Provide meaningful error messages
- Don't expose internal implementation details

## Code Structure

### Route Organization
- Create route files in `/src/routes/`
- Group related endpoints together
- Use consistent import patterns

### Example Route Structure
```typescript
/**
 * @swagger
 * tags:
 *   name: ServiceName
 *   description: Service description
 */

import { Router, Request, Response } from 'express';
import { authenticate, requireAuth } from '../middleware/auth.js';
import { executeQuery } from '../lib/database.js';
import { logger } from '../lib/logger.js';

const router = Router();

/**
 * @swagger
 * /resource:
 *   get:
 *     summary: Get all resources
 *     tags: [ServiceName]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Resources retrieved successfully
 */
router.get('/', authenticate, async (req: Request, res: Response) => {
  if (!requireAuth(req, res)) return;

  try {
    // Implementation here
    const result = await executeQuery(/* query */);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    logger.error('Error in GET /resource', { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export default router;
```

### Import Order
1. Built-in Node modules
2. External libraries
3. Internal modules (config, lib, middleware, routes, services, types)
4. Relative imports

## Documentation Standards

### Swagger Documentation
All API endpoints must be documented with Swagger annotations:

```typescript
/**
 * @swagger
 * /resource:
 *   get:
 *     summary: Brief description
 *     tags: [ResourceName]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: param
 *         schema:
 *           type: string
 *         description: Parameter description
 *     responses:
 *       200:
 *         description: Success description
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   example: "12345"
 */
```

### Code Comments
- Use JSDoc-style comments for all public functions
- Document complex logic and business rules
- Include security considerations where relevant

## Security Practices

### Authentication
- All endpoints (except health checks) require authentication
- Use the `authenticate` middleware for all routes
- Validate user permissions in the database layer

### Input Validation
- Validate all input parameters (path, query, body)
- Use type checking and validation libraries
- Sanitize inputs to prevent injection attacks

### Data Protection
- Never return sensitive data in responses
- Encrypt sensitive data in the database
- Use proper access controls

### Rate Limiting
- All endpoints should be subject to rate limiting
- Use the provided rate limiting middleware

## Testing Requirements

### Unit Tests
- Write unit tests for all business logic functions
- Test error cases and edge conditions
- Maintain high test coverage (>80%)

### Integration Tests
- Test all API endpoints
- Test authentication and authorization
- Test database interactions

### Test Structure
```typescript
describe('Resource API', () => {
  test('should return resources for valid request', async () => {
    // Test implementation
  });
  
  test('should return 401 for unauthenticated request', async () => {
    // Test implementation
  });
});
```

## Versioning

### API Versioning
- Use URL versioning: `/api/v1/resource`, `/api/v2/resource`
- Maintain backward compatibility in the same version
- Document breaking changes clearly

### Deprecation Policy
- Mark deprecated endpoints clearly in documentation
- Provide migration paths
- Give 30 days notice before removing deprecated endpoints

## Performance Considerations

### Database Queries
- Use parameterized queries to prevent injection
- Implement proper indexing
- Use connection pooling
- Optimize queries for performance

### Response Optimization
- Implement pagination for large datasets
- Use appropriate HTTP caching headers
- Minimize response payload size

### Asynchronous Operations
- Use async/await for asynchronous operations
- Handle errors appropriately
- Implement proper timeout handling

## Code Review Checklist

Before submitting a pull request, ensure:

- [ ] Code follows existing patterns and conventions
- [ ] All new endpoints are documented with Swagger
- [ ] Authentication is properly implemented
- [ ] Input validation is in place
- [ ] Error handling is comprehensive
- [ ] Tests are written and passing
- [ ] Performance considerations are addressed
- [ ] Security best practices are followed
- [ ] Documentation is updated

## Getting Started

1. Create a new branch from `main`
2. Add your route to the appropriate file in `/src/routes/`
3. Register the route in the main server file
4. Add Swagger documentation
5. Write tests
6. Update documentation if needed
7. Submit a pull request with a clear description

## Example: Adding a New Endpoint

### 1. Create the route file (`src/routes/new-resource.ts`)

```typescript
/**
 * @swagger
 * tags:
 *   name: NewResource
 *   description: New resource operations
 */

import { Router, Request, Response } from 'express';
import { authenticate, requireAuth } from '../middleware/auth.js';

const router = Router();

/**
 * @swagger
 * /new-resource:
 *   get:
 *     summary: Get new resource
 *     tags: [NewResource]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: New resource retrieved successfully
 */
router.get('/', authenticate, async (req: Request, res: Response) => {
  if (!requireAuth(req, res)) return;
  
  try {
    res.json({ success: true, data: { message: 'New resource' }});
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

export default router;
```

### 2. Register the route in the main server file

```typescript
import newResourceRoutes from './routes/new-resource.js';

app.use('/api/v1/new-resource', newResourceRoutes);
```

### 3. Run tests to ensure everything works

```bash
npm test
npm run build
```

Following these guidelines ensures that all contributions maintain the quality and consistency of the KPI ETL Pipeline API.