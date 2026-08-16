import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
  LoggerService,
} from '@nestjs/common'
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston'
import { Observable } from 'rxjs'
import { tap } from 'rxjs/operators'
import { Request, Response } from 'express'
import type { JwtPayload } from '@grandxl/types'

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(
    @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly logger: LoggerService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp()
    const req = ctx.getRequest<Request & { requestId?: string; user?: JwtPayload }>()
    const res = ctx.getResponse<Response>()
    const startTime = Date.now()

    const { method, url, requestId } = req
    const userId = req.user?.sub

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime
        const statusCode = res.statusCode

        // Never log sensitive fields — only metadata
        this.logger.log?.({
          message: `${method} ${url} ${statusCode} +${duration}ms`,
          requestId,
          userId,
          method,
          url,
          statusCode,
          duration,
        })
      }),
    )
  }
}
