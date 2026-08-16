import { SetMetadata } from '@nestjs/common'
import { UserRole } from '@grandxl/types'
import { ROLES_KEY } from '../constants/app.constants'

export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles)
