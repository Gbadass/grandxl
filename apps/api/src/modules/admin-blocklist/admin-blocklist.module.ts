import { Module } from '@nestjs/common'
import { UsersModule } from '../users/users.module'
import { RidersModule } from '../riders/riders.module'
import { AdminBlocklistController } from './admin-blocklist.controller'

// S13-13: unified blocklist read surface (banned customers + suspended/
// terminated riders). Kept in its own module so we don't have to make
// UsersModule and RidersModule import each other — that ES-module cycle
// deadlocks other cross-imports (see ReferralsModule/undefined bug from
// the initial S13-13 attempt).
@Module({
  imports: [UsersModule, RidersModule],
  controllers: [AdminBlocklistController],
})
export class AdminBlocklistModule {}
