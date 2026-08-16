import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Inject,
  LoggerService,
} from '@nestjs/common'
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston'
import { Request, Response } from 'express'
import * as Sentry from '@sentry/nestjs'
import type { JwtPayload } from '@grandxl/types'

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(
    @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly logger: LoggerService,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()
    const request = ctx.getRequest<Request & { requestId?: string; user?: JwtPayload }>()

    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR

    const isClientError = statusCode >= 400 && statusCode < 500

    let message = 'Something went wrong. Please try again.'

    if (exception instanceof HttpException) {
      const res = exception.getResponse()
      if (typeof res === 'string') {
        message = res
      } else if (typeof res === 'object' && res !== null) {
        const resObj = res as Record<string, unknown>
        if (typeof resObj['message'] === 'string') {
          message = resObj['message']
        } else if (Array.isArray(resObj['message'])) {
          message = (resObj['message'] as string[])[0] ?? message
        }
      }
    }

    const requestId = request.requestId

    // Log all 5xx errors (server errors)
    if (!isClientError) {
      this.logger.error?.({
        message: 'Unhandled exception',
        requestId,
        statusCode,
        error: exception instanceof Error ? exception.message : String(exception),
        stack: exception instanceof Error ? exception.stack : undefined,
        url: request.url,
        method: request.method,
      })

      // Report to Sentry — 5xx only
      if (request.user) {
        Sentry.setUser({ id: request.user.sub, roles: request.user.roles })
      }
      Sentry.setTag('requestId', requestId ?? 'unknown')
      Sentry.captureException(exception)
    }

    response.status(statusCode).json({
      success: false,
      statusCode,
      message,
      requestId,
      timestamp: new Date().toISOString(),
    })
  }
}
