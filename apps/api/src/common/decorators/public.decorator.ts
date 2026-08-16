import { SetMetadata } from '@nestjs/common'
import { IS_PUBLIC_KEY } from '../constants/app.constants'

// Mark a route as public — bypasses the global JwtAuthGuard
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true)
