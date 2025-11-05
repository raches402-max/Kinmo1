import { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';

/**
 * Validation middleware factory
 * Creates Express middleware that validates request body against a Zod schema
 *
 * @param schema - Zod schema to validate against
 * @param source - Where to validate: 'body' | 'query' | 'params'
 * @returns Express middleware function
 *
 * @example
 * app.post('/api/groups', validate(createGroupSchema), async (req, res) => {
 *   // req.body is now validated and type-safe
 *   const group = await createGroup(req.body);
 *   res.json(group);
 * });
 */
export function validate(
  schema: z.ZodSchema<any>,
  source: 'body' | 'query' | 'params' = 'body'
) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate the request data
      const dataToValidate = req[source];
      const validated = schema.parse(dataToValidate);

      // Replace the original data with validated data
      // This ensures type safety and strips unknown fields
      (req as any)[source] = validated;

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        // Format Zod errors into a user-friendly format
        const errors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
        }));

        return res.status(400).json({
          error: 'Validation failed',
          details: errors,
        });
      }

      // Pass non-validation errors to error handler
      next(error);
    }
  };
}

/**
 * Async validation wrapper for complex validations that need async operations
 * Use this for validations that require database lookups or external API calls
 *
 * @example
 * app.post('/api/groups/:id', validateAsync(async (req) => {
 *   const schema = updateGroupSchema.parse(req.body);
 *   // Check if user has permission
 *   const hasPermission = await checkGroupPermission(req.user.id, req.params.id);
 *   if (!hasPermission) throw new Error('Unauthorized');
 *   return schema;
 * }), async (req, res) => {
 *   // ...
 * });
 */
export function validateAsync(
  validationFn: (req: Request) => Promise<any>
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await validationFn(req);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
        }));

        return res.status(400).json({
          error: 'Validation failed',
          details: errors,
        });
      }

      if (error instanceof Error && error.message === 'Unauthorized') {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      next(error);
    }
  };
}

/**
 * Safe parse wrapper for in-handler validation
 * Use this when you need to validate inline within a route handler
 *
 * @param schema - Zod schema to validate against
 * @param data - Data to validate
 * @param res - Express response object (for error responses)
 * @returns Validated data if successful, undefined if validation fails (response already sent)
 *
 * @example
 * app.post('/api/groups', async (req, res) => {
 *   const validatedData = safeParse(createGroupSchema, req.body, res);
 *   if (!validatedData) return; // Response already sent with 400 error
 *
 *   const group = await createGroup(validatedData);
 *   res.json(group);
 * });
 */
export function safeParse<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  res: Response
): T | undefined {
  const result = schema.safeParse(data);

  if (!result.success) {
    const errors = result.error.errors.map(err => ({
      field: err.path.join('.'),
      message: err.message,
    }));

    res.status(400).json({
      error: 'Validation failed',
      details: errors,
    });

    return undefined;
  }

  return result.data;
}

/**
 * Validation error formatter
 * Extracts useful error information from Zod validation errors
 */
export function formatValidationErrors(error: ZodError) {
  return {
    error: 'Validation failed',
    details: error.errors.map(err => ({
      field: err.path.join('.'),
      message: err.message,
      code: err.code,
    })),
  };
}
