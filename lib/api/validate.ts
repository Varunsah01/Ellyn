import { type ZodSchema } from 'zod'
import { validationError } from './response'

export async function parseBody<T>(
  request: Request,
  schema: ZodSchema<T>
): Promise<{ data: T } | { error: ReturnType<typeof validationError> }> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return { error: validationError('Invalid JSON') }
  }

  const result = schema.safeParse(body)
  if (!result.success) {
    return { error: validationError(result.error.flatten()) }
  }
  return { data: result.data }
}
