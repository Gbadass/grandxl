import { Controller, Get } from '@nestjs/common'
import { HealthCheck, HealthCheckService, MongooseHealthIndicator, MemoryHealthIndicator } from '@nestjs/terminus'
import { Public } from '../../common/decorators/public.decorator'
import { ApiTags, ApiOperation } from '@nestjs/swagger'

// Two-tier health checks for k8s/ECS/etc. orchestration:
//
// - /health/live — ALWAYS 200 if the process can serve HTTP. Tells the orchestrator
//   "the container isn't stuck, don't kill it." No downstream checks — a DB blip
//   must not cause the pod to restart (that just makes recovery slower).
//
// - /health/ready — 503 if the app can't currently serve real traffic (DB down,
//   memory pressure). Tells the load balancer "stop routing to me for now."
//
// - /health — legacy alias, matches /health/ready for backwards compat with any
//   existing monitoring config.

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: MongooseHealthIndicator,
    private memory: MemoryHealthIndicator,
  ) {}

  @Get('live')
  @Public()
  @ApiOperation({ summary: 'Liveness probe — always 200 if the process is up' })
  live(): { status: 'ok' } {
    return { status: 'ok' }
  }

  @Get('ready')
  @Public()
  @HealthCheck()
  @ApiOperation({ summary: 'Readiness probe — 503 if downstreams are unhealthy' })
  ready() {
    return this.health.check([
      () => this.db.pingCheck('database'),
      () => this.memory.checkHeap('memory', 512 * 1024 * 1024), // 512MB heap limit
    ])
  }

  @Get()
  @Public()
  @HealthCheck()
  @ApiOperation({ summary: 'Legacy health check — same as /health/ready' })
  check() {
    return this.health.check([
      () => this.db.pingCheck('database'),
      () => this.memory.checkHeap('memory', 512 * 1024 * 1024),
    ])
  }
}
