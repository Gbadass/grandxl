import { SetMetadata } from '@nestjs/common'

export const IDEMPOTENT_KEY = 'idempotent'

// Mark a route handler as idempotent — IdempotencyInterceptor will dedupe
// retries when the client sends an Idempotency-Key header.
export const Idempotent = (): MethodDecorator & ClassDecorator =>
  SetMetadata(IDEMPOTENT_KEY, true)
