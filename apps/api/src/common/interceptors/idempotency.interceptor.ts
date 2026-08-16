import {
  CallHandler,
  ConflictException,
  ExecutionContext,
  Inject,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { Request } from 'express'
import type Redis from 'ioredis'
import { Observable, from, of } from 'rxjs'
import { switchMap, tap, catchError } from 'rxjs/operators'
import { REDIS_CLIENT } from '../../database/redis.module'
import { IDEMPOTENT_KEY } from '../decorators/idempotent.decorator'

interface CachedResponse {
  status:   'pending' | 'completed'
  body?:    unknown
  // Hash of normalized request body — used to detect "same key, different payload"
  bodyHash?: string
}

// Stripe-style idempotency:
// - First request with key X executes; result cached for 24h
// - Replay with same key + same body returns the cached body
// - Replay with same key + different body → 409 Conflict
// - Replay while first is still running → 409 Conflict (caller retries)
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger     = new Logger(IdempotencyInterceptor.name)
  private readonly ttlSec     = 24 * 60 * 60
  private readonly pendingTtl = 60

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly reflector: Reflector,
  ) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const required = this.reflector.getAllAndOverride<boolean>(IDEMPOTENT_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ])
    if (!required) return next.handle()

    const req = ctx.switchToHttp().getRequest<Request & { user?: { sub?: string } }>()
    const headerKey = (req.headers['idempotency-key'] ?? req.headers['Idempotency-Key']) as string | undefined
    if (!headerKey) {
      // Header optional — no key means no idempotency. Allows incremental client adoption.
      return next.handle()
    }

    const userScope = req.user?.sub ?? 'anon'
    const redisKey  = `idem:${userScope}:${headerKey}`
    const bodyHash  = this.hashBody(req.body)

    return from(this.preflight(redisKey, bodyHash)).pipe(
      switchMap((cached) => {
        if (cached?.status === 'completed') {
          return of(cached.body)
        }
        // Mark as pending; covers concurrent replays in flight.
        return from(this.markPending(redisKey, bodyHash)).pipe(
          switchMap(() => next.handle().pipe(
            tap((body) => {
              void this.markCompleted(redisKey, bodyHash, body)
            }),
            catchError((err: unknown) => {
              // Don't cache failures — caller should be able to retry the same key.
              void this.redis.del(redisKey)
              throw err
            }),
          )),
        )
      }),
    )
  }

  private async preflight(redisKey: string, bodyHash: string): Promise<CachedResponse | null> {
    const cached = await this.redis.get(redisKey)
    if (!cached) return null
    const parsed = JSON.parse(cached) as CachedResponse
    if (parsed.bodyHash && parsed.bodyHash !== bodyHash) {
      throw new ConflictException('Idempotency-Key reused with a different request body')
    }
    if (parsed.status === 'pending') {
      throw new ConflictException('A request with this Idempotency-Key is already being processed')
    }
    return parsed
  }

  private async markPending(redisKey: string, bodyHash: string): Promise<void> {
    await this.redis.set(
      redisKey,
      JSON.stringify({ status: 'pending', bodyHash }),
      'EX',
      this.pendingTtl,
    )
  }

  private async markCompleted(redisKey: string, bodyHash: string, body: unknown): Promise<void> {
    try {
      await this.redis.set(
        redisKey,
        JSON.stringify({ status: 'completed', body, bodyHash }),
        'EX',
        this.ttlSec,
      )
    } catch (err) {
      this.logger.warn(`failed to cache idempotent response: ${(err as Error).message}`)
    }
  }

  // Stable deterministic hash. Not cryptographic; just detects body mismatches.
  private hashBody(body: unknown): string {
    try {
      return JSON.stringify(this.sortKeys(body))
    } catch {
      return ''
    }
  }

  private sortKeys(value: unknown): unknown {
    if (Array.isArray(value)) return value.map((v) => this.sortKeys(v))
    if (value && typeof value === 'object') {
      return Object.keys(value as Record<string, unknown>)
        .sort()
        .reduce<Record<string, unknown>>((acc, k) => {
          acc[k] = this.sortKeys((value as Record<string, unknown>)[k])
          return acc
        }, {})
    }
    return value
  }
}
