import { Global, Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { SurgeRuleDocument, SurgeRuleSchema } from './schemas/surge-rule.schema'
import { SurgePricingService } from './surge-pricing.service'
import { SurgePricingController } from './surge-pricing.controller'

// Global so OrdersService can query the multiplier without re-importing.
@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SurgeRuleDocument.name, schema: SurgeRuleSchema },
    ]),
  ],
  controllers: [SurgePricingController],
  providers: [SurgePricingService],
  exports: [SurgePricingService],
})
export class SurgePricingModule {}
