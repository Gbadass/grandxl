// Sentry MUST be imported before everything else
import './instrument'

import { NestFactory, Reflector } from '@nestjs/core'
import { ValidationPipe, ClassSerializerInterceptor, HttpException, HttpStatus } from '@nestjs/common'
import type { Request, Response, NextFunction } from 'express'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import { ConfigService } from '@nestjs/config'
import helmet from 'helmet'
import compression from 'compression'
import cookieParser from 'cookie-parser'
import mongoSanitize from 'express-mongo-sanitize'
import hpp from 'hpp'
import { WinstonModule } from 'nest-winston'
import { AppModule } from './app.module'
import { TransformInterceptor } from './common/interceptors/transform.interceptor'
import { createWinstonConfig } from './config/logger.config'

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    logger: WinstonModule.createLogger(createWinstonConfig()),
    bufferLogs: true,
    rawBody: true, // required for Paystack webhook HMAC-SHA512 signature verification
  })

  const configService = app.get(ConfigService)

  // ── Security middleware ──────────────────────────────────────────
  app.use(helmet())
  app.use(compression())
  app.use(cookieParser())
  app.use(mongoSanitize()) // strip $ and . from inputs → prevents NoSQL injection
  app.use(hpp())           // prevent HTTP Parameter Pollution

  // CORS — whitelist CLIENT_URL, ADMIN_URL, and RIDER_URL
  app.enableCors({
    origin: [
      configService.getOrThrow<string>('CLIENT_URL'),
      configService.getOrThrow<string>('ADMIN_URL'),
      configService.get<string>('RIDER_URL') ?? 'http://localhost:5174',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id', 'Idempotency-Key'],
  })

  // Reject JSON requests whose Content-Length exceeds 10kb — skip multipart uploads
  app.use((req: Request, _res: Response, next: NextFunction) => {
    const isUpload = req.path.startsWith('/api/v1/uploads')
    if (isUpload) { next(); return }
    const contentLength = parseInt((req.headers['content-length'] as string) ?? '0', 10)
    if (contentLength > 10_240) {
      next(new HttpException('Payload Too Large', HttpStatus.PAYLOAD_TOO_LARGE))
      return
    }
    next()
  })

  // API versioning — all routes prefixed /api/v1/
  app.setGlobalPrefix('api/v1')

  // ── Global pipes, interceptors, filters ─────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,              // strip unknown fields
      forbidNonWhitelisted: true,   // throw if unknown fields present
      transform: true,              // auto-transform to DTO types
      transformOptions: { enableImplicitConversion: true },
    }),
  )

  const reflector = app.get(Reflector)
  app.useGlobalInterceptors(
    new ClassSerializerInterceptor(reflector),
    new TransformInterceptor(),
  )

  // AllExceptionsFilter registered as APP_FILTER in AppModule (requires Winston DI)

  // ── Graceful shutdown ────────────────────────────────────────────
  app.enableShutdownHooks()

  // ── Swagger docs (dev only) ──────────────────────────────────────
  if (configService.get('NODE_ENV') !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('GrandXL API')
      .setDescription('GrandXL Food Delivery Platform — API Documentation')
      .setVersion('1.0')
      .addBearerAuth()
      .addCookieAuth('refresh_token')
      .addServer(`http://localhost:${configService.get('PORT') ?? 3001}`, 'Local')
      .build()

    const document = SwaggerModule.createDocument(app, config)
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    })
  }

  const port = configService.get<number>('PORT') ?? 3001
  await app.listen(port)

  const logger = app.get('winston')
  if (logger && typeof logger.log === 'function') {
    logger.log('info', `GrandXL API running on port ${port}`)
  }
}

bootstrap().catch((err: unknown) => {
  console.error('Fatal error during bootstrap:', err)
  process.exit(1)
})
