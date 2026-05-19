---
name: api-endpoint
description: Create a REST API endpoint with proper validation, error handling, and documentation
version: 1.0.0
triggers: [api endpoint, create endpoint, new route, REST API, add endpoint]
category: backend
---

# API Endpoint Skill

## When to use
When the user asks to create a new API endpoint or route.

## Steps

1. **Understand the requirements**: HTTP method, path, request/response format
2. **Check existing patterns**: Review existing routes/controllers for conventions
3. **Create the route handler**:
   - Use proper HTTP method
   - Validate input (Zod, Joi, or project's validation library)
   - Handle errors properly
   - Return appropriate status codes
4. **Add to router**: Register the route in the appropriate router file
5. **Add tests**: Create integration tests for the endpoint
6. **Document**: Add OpenAPI/Swagger documentation if applicable

## Template (Express.js)

```typescript
import { Router, Request, Response } from 'express';
import { z } from 'zod';

const router = Router();

const requestSchema = z.object({
  // Define request validation
});

router.post('/api/resource', async (req: Request, res: Response) => {
  try {
    const validated = requestSchema.parse(req.body);
    // Business logic here
    res.status(201).json({ data: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: error.errors });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

export default router;
```

## Notes
- Always validate input
- Use proper HTTP status codes
- Handle errors gracefully
- Log errors for debugging
- Follow project's error handling patterns
