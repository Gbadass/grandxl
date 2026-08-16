import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq'
import { Logger, OnModuleInit } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import type { Queue, Job } from 'bullmq'
import { SETTLEMENT_QUEUE } from '../constants/queue.constants'
import { SettlementService } from '../../orders/settlement.service'

// Nightly rider earnings settlement — repeatable BullMQ job.
// Registers itself at module init using BullMQ's built-in cron support so we
// don't need a separate scheduler.
@Processor(SETTLEMENT_QUEUE)
export class SettlementProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(SettlementProcessor.name)

  constructor(
    private readonly settlement: SettlementService,
    @InjectQueue(SETTLEMENT_QUEUE)
    private readonly queue: Queue,
  ) {
    super()
  }

  async onModuleInit() {
    // Cron: every day at 03:00 UTC (~04:00 WAT). Off-peak so it doesn't
    // compete with dinner rush. Repeatable jobs are de-duped by their key
    // by BullMQ so this doesn't stack across restarts.
    await this.queue.add(
      'nightly-settlement',
      {},
      {
        repeat: { pattern: '0 3 * * *' },
        removeOnComplete: 30,
        removeOnFail:     50,
      },
    )
    this.logger.log('Nightly settlement job registered (03:00 UTC daily)')
  }

  async process(job: Job): Promise<void> {
    this.logger.log(`Settlement job starting: ${job.name} (${job.id})`)
    const result = await this.settlement.runSettlement()
    this.logger.log(`Settlement job completed: ${JSON.stringify(result)}`)
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error) {
    this.logger.error(`Settlement failed (${job.id}): ${err.message}`, err.stack)
  }
}
