import { Global, Module, forwardRef } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { BullModule } from '@nestjs/bullmq'
import {
  PendingSideEffectDocument,
  PendingSideEffectSchema,
} from './schemas/pending-side-effect.schema'
import { SideEffectsService } from './side-effects.service'
import { RIDER_DISPATCH_QUEUE } from '../jobs/constants/queue.constants'
import { WalletModule } from '../wallet/wallet.module'
import { RidersModule } from '../riders/riders.module'

// Global — any module that has a critical side-effect can inject SideEffectsService
// without threading imports through every module boundary.
@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PendingSideEffectDocument.name, schema: PendingSideEffectSchema },
    ]),
    BullModule.registerQueue({ name: RIDER_DISPATCH_QUEUE }),
    WalletModule,
    forwardRef(() => RidersModule),
  ],
  providers: [SideEffectsService],
  exports: [SideEffectsService],
})
export class SideEffectsModule {}
