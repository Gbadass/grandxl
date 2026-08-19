import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler'
import { TerminusModule } from '@nestjs/terminus'
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core'
import { WinstonModule } from 'nest-winston'
import { BullModule } from '@nestjs/bullmq'

import { envValidationSchema } from './config/env.validation'
import { jwtConfig } from './config/jwt.config'
import { redisConfig } from './config/redis.config'
import { createWinstonConfig } from './config/logger.config'

import { DatabaseModule } from './database/database.module'
import { RedisModule } from './database/redis.module'
import { RequestIdMiddleware } from './common/middleware/request-id.middleware'
import { JwtAuthGuard } from './common/guards/jwt-auth.guard'
import { RolesGuard } from './common/guards/roles.guard'
import { LoggingInterceptor } from './common/interceptors/logging.interceptor'
import { IdempotencyInterceptor } from './common/interceptors/idempotency.interceptor'
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter'

// Feature modules (empty shells wired up — implementations built in Phase 2)
import { AuthModule } from './modules/auth/auth.module'
import { UsersModule } from './modules/users/users.module'
import { RestaurantsModule } from './modules/restaurants/restaurants.module'
import { MenuItemsModule } from './modules/menu-items/menu-items.module'
import { OrdersModule } from './modules/orders/orders.module'
import { PaymentsModule } from './modules/payments/payments.module'
import { RidersModule } from './modules/riders/riders.module'
import { TrackingModule } from './modules/tracking/tracking.module'
import { NotificationsModule } from './modules/notifications/notifications.module'
import { UploadsModule } from './modules/uploads/uploads.module'
import { ReviewsModule } from './modules/reviews/reviews.module'
import { SearchModule } from './modules/search/search.module'
import { PlatformConfigModule } from './modules/platform-config/platform-config.module'
import { FoodCategoriesModule } from './modules/food-categories/food-categories.module'
import { JobsModule } from './modules/jobs/jobs.module'
import { HealthModule } from './modules/health/health.module'
import { AuditModule } from './modules/audit/audit.module'
import { WalletModule } from './modules/wallet/wallet.module'
import { RefundsModule } from './modules/refunds/refunds.module'
import { PayoutsModule } from './modules/payouts/payouts.module'
import { BannersModule } from './modules/banners/banners.module'
import { FraudModule } from './modules/fraud/fraud.module'
import { CampaignsModule } from './modules/campaigns/campaigns.module'
import { DeliveryZonesModule } from './modules/delivery-zones/delivery-zones.module'
import { SurgePricingModule } from './modules/surge-pricing/surge-pricing.module'
import { DataExportModule } from './modules/data-export/data-export.module'
import { ContentPagesModule } from './modules/content-pages/content-pages.module'
import { AnalyticsModule } from './modules/analytics/analytics.module'
import { ChatModule } from './modules/chat/chat.module'

@Module({
  imports: [
    // Config — validates all env vars at startup, app refuses to start if any missing
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
      load: [jwtConfig, redisConfig],
    }),

    // Winston logger
    WinstonModule.forRoot(createWinstonConfig()),

    // Database + Redis
    DatabaseModule,
    RedisModule,

    // Rate limiting — three tiers to absorb spikes without letting abuse through.
    // short:  burst protection (per-second).
    // medium: prevents sustained hammering (per-minute).
    // long:   catches slow scrapers (per-15-minutes).
    // Auth/OTP/payment-webhook routes override these via @Throttle/@SkipThrottle.
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: () => ({
        throttlers: [
          { name: 'short',  ttl: 1_000,       limit: 10  },
          { name: 'medium', ttl: 60_000,      limit: 120 },
          { name: 'long',   ttl: 15 * 60_000, limit: 1000 },
        ],
      }),
    }),

    // BullMQ — queue registration (workers defined in JobsModule)
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
          password: config.get<string>('REDIS_PASSWORD') || undefined,
          // Reconnect on Redis failure — exponential backoff up to 3s
          retryStrategy: (times: number) => Math.min(times * 100, 3000),
        },
      }),
    }),

    // Health checks
    TerminusModule,

    // Feature modules
    AuthModule,
    UsersModule,
    RestaurantsModule,
    MenuItemsModule,
    OrdersModule,
    PaymentsModule,
    RidersModule,
    TrackingModule,
    NotificationsModule,
    UploadsModule,
    ReviewsModule,
    SearchModule,
    PlatformConfigModule,
    FoodCategoriesModule,
    JobsModule,
    HealthModule,
    AuditModule,
    WalletModule,
    RefundsModule,
    PayoutsModule,
    BannersModule,
    FraudModule,
    CampaignsModule,
    DeliveryZonesModule,
    SurgePricingModule,
    DataExportModule,
    ContentPagesModule,
    AnalyticsModule,
    ChatModule,
  ],
  providers: [
    // AllExceptionsFilter uses Winston DI — must be APP_FILTER, not new in main.ts
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    // Throttler guard runs first — cheaper to reject than to auth then reject
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // JWT guard applied globally — every route protected by default
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // Roles guard applied globally — enforces @Roles() decorator
    { provide: APP_GUARD, useClass: RolesGuard },
    // Logging interceptor applied globally
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    // Idempotency runs after auth but before handler — keyed routes opt in via @Idempotent()
    { provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Request ID middleware applied to all routes
    consumer.apply(RequestIdMiddleware).forRoutes('*')
  }
}
