import { Injectable, UnauthorizedException } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { ConfigService } from '@nestjs/config'
import { UsersService } from '../../users/users.service'
import type { JwtPayload } from '@grandxl/types'

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly config: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    })
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    const user = await this.usersService.findById(payload.sub)
    if (!user) throw new UnauthorizedException('Account not found or suspended')
    if (user.deletedAt) throw new UnauthorizedException('ACCOUNT_DELETED')
    if (!user.isActive) throw new UnauthorizedException('Account suspended')
    // Use roles from DB so role changes (e.g. adding RIDER after registration) take effect
    // immediately without requiring a token refresh — no extra DB cost since we fetch anyway
    return { sub: payload.sub, roles: user.roles as unknown as import('@grandxl/types').UserRole[], country: user.country }
  }
}
