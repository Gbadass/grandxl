import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common'
import { Observable } from 'rxjs'
import { map } from 'rxjs/operators'

export interface StandardResponse<T> {
  success: boolean
  data: T
}

// Wraps every successful response in: { success: true, data: <original response> }
// This gives every API response a consistent shape that frontend apps can rely on.
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, StandardResponse<T>> {
  intercept(_context: ExecutionContext, next: CallHandler<T>): Observable<StandardResponse<T>> {
    return next.handle().pipe(
      map((data) => {
        // Void handlers (HTTP 204) emit undefined — skip the round-trip so we
        // don't blow up on JSON.parse(undefined). Same for null.
        if (data === undefined || data === null) {
          return { success: true, data: null as unknown as T }
        }
        // JSON round-trip converts BSON ObjectIds (and other toJSON-aware types)
        // to plain primitives before ClassSerializerInterceptor processes them.
        // Without this, class-transformer's instanceToPlain() enumerates the
        // ObjectId's internal `buffer` property instead of calling toHexString().
        const safe = JSON.parse(JSON.stringify(data)) as T
        return { success: true, data: safe }
      }),
    )
  }
}
