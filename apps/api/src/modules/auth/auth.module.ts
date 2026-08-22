import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { ConfigModule } from '@nestjs/config'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { JwtStrategy } from './strategies/jwt.strategy'
import { TermiiProvider } from './providers/termii.provider'
import { UsersModule } from '../users/users.module'
import { EmailModule } from '../email/email.module'
import { ReferralsModule } from '../referrals/referrals.module'

@Module({
  imports: [
    ConfigModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({}),
    UsersModule,
    EmailModule,
    ReferralsModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, TermiiProvider],
  exports: [AuthService, TermiiProvider],
})
export class AuthModule {}
