import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { ReferralDocument, ReferralSchema } from './schemas/referral.schema'
import { ReferralsService } from './referrals.service'
import { ReferralsController, AdminReferralsController } from './referrals.controller'
import { UsersModule } from '../users/users.module'

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ReferralDocument.name, schema: ReferralSchema },
    ]),
    UsersModule,
    // WalletModule is @Global() — no explicit import needed
  ],
  controllers: [ReferralsController, AdminReferralsController],
  providers: [ReferralsService],
  exports: [ReferralsService],
})
export class ReferralsModule {}
