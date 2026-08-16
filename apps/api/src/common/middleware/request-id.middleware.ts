import { Injectable, NestMiddleware } from '@nestjs/common'
import { Request, Response, NextFunction } from 'express'
import { v4 as uuidv4 } from 'uuid'

// Assigns a unique request ID to every incoming request.
// This ID appears in every log line — enables tracing a single request
// across all log entries when debugging production issues.
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const requestId = (req.headers['x-request-id'] as string | undefined) ?? uuidv4()
    ;(req as Request & { requestId: string }).requestId = requestId
    res.setHeader('x-request-id', requestId)
    next()
  }
}
