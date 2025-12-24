import { Request, Response, NextFunction } from 'express';
import swaggerUi from 'swagger-ui-express';
import specs from '../config/swagger.js';

export const swaggerDocs = (app: any) => {
  // Serve Swagger UI at /api/docs
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(specs));
  
  // Also provide raw OpenAPI JSON at /api/docs.json
  app.get('/api/docs.json', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(specs);
  });

  console.log('✅ Swagger docs available at http://localhost:3001/api/docs');
};