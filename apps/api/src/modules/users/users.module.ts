import { Module, forwardRef } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { UserDocument, UserSchema } from './schemas/user.schema'
import { UsersService } from './users.service'
import { UsersController } from './users.controller'
import { AdminUsersController } from './admin-users.controller'
import { AdminBlocklistController } from './admin-blocklist.controller'
import { AuthModule } from '../auth/auth.module'
import { RidersModule } from '../riders/riders.module'

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: UserDocument.name, schema: UserSchema },
    ]),
    // forwardRef because AuthModule also imports UsersModule (circular).
    // UsersController needs AuthService to revoke sessions on account deletion.
    forwardRef(() => AuthModule),
    // forwardRef guards against a future RidersModule → UsersModule import;
    // AdminBlocklistController depends on RidersService for the rider tab.
    forwardRef(() => RidersModule),
  ],
  controllers: [UsersController, AdminUsersController, AdminBlocklistController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
