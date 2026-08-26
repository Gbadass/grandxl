import { Module, forwardRef } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { UserDocument, UserSchema } from './schemas/user.schema'
import { UsersService } from './users.service'
import { UsersController } from './users.controller'
import { AdminUsersController } from './admin-users.controller'
import { AuthModule } from '../auth/auth.module'

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: UserDocument.name, schema: UserSchema },
    ]),
    // forwardRef because AuthModule also imports UsersModule (circular).
    // UsersController needs AuthService to revoke sessions on account deletion.
    forwardRef(() => AuthModule),
  ],
  controllers: [UsersController, AdminUsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
