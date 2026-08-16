import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { UserRole, type JwtPayload } from '@grandxl/types'
import { ROLES_KEY } from '../constants/app.constants'
import { Request } from 'express'

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    // No @Roles() decorator → no role restriction
    if (!requiredRoles || requiredRoles.length === 0) return true

    const request = context.switchToHttp().getRequest<Request & { user: JwtPayload }>()
    const user = request.user

    if (!user) throw new ForbiddenException()

    const hasRole = user.roles.some((r) => requiredRoles.includes(r as UserRole))
    if (!hasRole) throw new ForbiddenException()

    return true
  }
}
