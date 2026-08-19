import {
  Injectable,
  Logger,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import { Inject } from '@nestjs/common'
import type Redis from 'ioredis'
import { REDIS_CLIENT } from '../../database/redis.module'
import * as bcrypt from 'bcryptjs'
import * as crypto from 'crypto'
import { UsersService } from '../users/users.service'
import { TermiiProvider } from './providers/termii.provider'
import { EmailProvider } from '../email/email.provider'
import type { UserDocument } from '../users/schemas/user.schema'
import type { JwtPayload } from '@grandxl/types'
import type { UserRole } from '@grandxl/types'
import {
  OTP_TTL_SECONDS,
  OTP_MAX_ATTEMPTS,
  REFRESH_TOKEN_TTL_SECONDS,
  PWD_RESET_TOKEN_TTL_SECONDS,
  REDIS_REFRESH_TOKEN_PREFIX,
  REDIS_OTP_PREFIX,
  REDIS_OTP_ATTEMPTS_PREFIX,
  REDIS_PWD_RESET_PREFIX,
  REDIS_ADMIN_LOGIN_ATTEMPTS_PREFIX,
  REDIS_ADMIN_LOGIN_LOCKED_PREFIX,
  REDIS_LOGIN_ATTEMPTS_PREFIX,
  REDIS_LOGIN_LOCKED_PREFIX,
  LOGIN_MAX_ATTEMPTS,
  LOGIN_LOCKOUT_SECONDS,
  REDIS_OTP_SEND_RATE_PREFIX,
  OTP_SEND_COOLDOWN_SECONDS,
} from '../../common/constants/app.constants'
import type { RegisterDto } from './dto/register.dto'
import type { LoginDto } from './dto/login.dto'
import type { VerifyOtpDto } from './dto/verify-otp.dto'
import type { ResetPasswordDto } from './dto/reset-password.dto'
import type { AdminLoginDto } from './dto/admin-login.dto'
import type { PortalLoginDto } from './dto/portal-login.dto'
import type { VerifyAndAddRoleDto } from './dto/verify-and-add-role.dto'
import { UserRole as UserRoleEnum } from '@grandxl/types'

const BCRYPT_ROUNDS = 12
const ADMIN_MAX_ATTEMPTS = 5
const ADMIN_LOCKOUT_SECONDS = 15 * 60 // 15 minutes

export interface AuthTokens {
  accessToken: string
  refreshToken: string
}

export interface AuthResponse {
  accessToken: string
  refreshToken: string
  user: Omit<UserDocument, 'passwordHash'>
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name)

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly termii: TermiiProvider,
    private readonly email: EmailProvider,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  // ── Register ────────────────────────────────────────────────────

  async register(dto: RegisterDto): Promise<AuthResponse> {
    if (!dto.consentGiven) {
      throw new BadRequestException('You must accept the Privacy Policy and Terms of Service')
    }

    // Pre-check so we can surface a typed "account exists" error to the frontend.
    const existingByEmail = dto.email ? await this.usersService.findByEmail(dto.email) : null
    const existingByPhone = !existingByEmail && dto.phone ? await this.usersService.findByPhone(dto.phone) : null
    const existing = existingByEmail ?? existingByPhone
    if (existing) {
      throw new ConflictException({
        code: 'ACCOUNT_EXISTS',
        matchedOn: existingByEmail ? 'email' : 'phone',
        message: 'An account with this email or phone already exists. Please sign in to continue.',
      })
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS)

    const user = await this.usersService.create({
      firstName: dto.firstName.trim(),
      lastName: dto.lastName.trim(),
      phone: dto.phone,
      email: dto.email,
      passwordHash,
      country: dto.country ?? 'NG',
      consentGiven: true,
      consentDate: new Date(),
      // All accounts get CUSTOMER so they can also place orders.
      // RESTAURANT_OWNER and RIDER registrations are additive on top.
      roles: dto.role && dto.role !== UserRoleEnum.CUSTOMER
        ? [UserRoleEnum.CUSTOMER, dto.role]
        : [UserRoleEnum.CUSTOMER],
    })

    const tokens = await this.issueTokens(user)
    await this.storeRefreshToken(user._id.toString(), tokens.refreshToken)

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: await this.usersService.toSafeUser(user),
    }
  }

  // ── Add role to current user (e.g. customer becoming restaurant owner) ──

  async addRoleToCurrentUser(userId: string, role: UserRoleEnum): Promise<AuthResponse> {
    await this.usersService.addRole(userId, role)
    const user = await this.usersService.findByIdOrThrow(userId)

    const tokens = await this.issueTokens(user)
    await this.storeRefreshToken(user._id.toString(), tokens.refreshToken)

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: await this.usersService.toSafeUser(user),
    }
  }

  // ── Welcome-back flow: verify password, add role, return tokens ─────

  async verifyAndAddRole(dto: VerifyAndAddRoleDto): Promise<AuthResponse> {
    if (!dto.email && !dto.phone) {
      throw new BadRequestException('Provide either email or phone')
    }

    const user = dto.email
      ? await this.usersService.findByEmail(dto.email)
      : await this.usersService.findByPhone(dto.phone!)

    if (!user || !user.isActive || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials')
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash)
    if (!valid) throw new UnauthorizedException('Invalid credentials')

    if (!user.roles.includes(dto.role)) {
      await this.usersService.addRole(user._id.toString(), dto.role)
    }

    const refreshed = await this.usersService.findByIdOrThrow(user._id.toString())
    const tokens = await this.issueTokens(refreshed)
    await this.storeRefreshToken(refreshed._id.toString(), tokens.refreshToken)

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: await this.usersService.toSafeUser(refreshed),
    }
  }

  // ── Send OTP ────────────────────────────────────────────────────

  async sendOtp(phone: string): Promise<void> {
    const skipOtp = this.config.get<string>('SKIP_OTP_IN_DEV') === 'true'

    // Rate-limit: one OTP per phone per minute to prevent SMS cost abuse
    const rateLimitKey = `${REDIS_OTP_SEND_RATE_PREFIX}${phone}`
    const alreadySent  = await this.redis.get(rateLimitKey)
    if (alreadySent) {
      const ttl = await this.redis.ttl(rateLimitKey)
      throw new HttpException(
        `Please wait ${ttl} seconds before requesting another OTP.`,
        HttpStatus.TOO_MANY_REQUESTS,
      )
    }

    const otp = skipOtp ? '123456' : this.generateOtp()
    const otpHash = await bcrypt.hash(otp, BCRYPT_ROUNDS)

    await this.redis.setex(`${REDIS_OTP_PREFIX}${phone}`, OTP_TTL_SECONDS, otpHash)
    await this.redis.del(`${REDIS_OTP_ATTEMPTS_PREFIX}${phone}`)
    await this.redis.setex(rateLimitKey, OTP_SEND_COOLDOWN_SECONDS, '1')

    if (skipOtp) {
      this.logger.log(`[DEV] OTP for ${phone}: ${otp}`)
    } else {
      await this.termii.sendOtp(phone, otp)
    }
  }

  // ── Verify OTP ──────────────────────────────────────────────────

  async verifyOtp(dto: VerifyOtpDto): Promise<AuthResponse> {
    const { phone, otp } = dto

    const attemptsKey = `${REDIS_OTP_ATTEMPTS_PREFIX}${phone}`
    const attempts = parseInt((await this.redis.get(attemptsKey)) ?? '0', 10)

    if (attempts >= OTP_MAX_ATTEMPTS) {
      throw new HttpException(
        'Too many incorrect attempts. Please request a new OTP.',
        HttpStatus.TOO_MANY_REQUESTS,
      )
    }

    const stored = await this.redis.get(`${REDIS_OTP_PREFIX}${phone}`)
    if (!stored) {
      throw new BadRequestException('OTP expired or not found. Please request a new one.')
    }

    const skipOtp = this.config.get<string>('SKIP_OTP_IN_DEV') === 'true'
    const valid = skipOtp ? otp === '123456' : await bcrypt.compare(otp, stored)

    if (!valid) {
      await this.redis.incr(attemptsKey)
      await this.redis.expire(attemptsKey, OTP_TTL_SECONDS)
      throw new UnauthorizedException('Invalid OTP')
    }

    // OTP valid — clean up Redis
    await this.redis.del(`${REDIS_OTP_PREFIX}${phone}`)
    await this.redis.del(attemptsKey)

    // Mark user as verified (create stub user if they don't exist yet)
    let user = await this.usersService.findByPhone(phone)
    if (!user) {
      throw new BadRequestException('Please register before verifying your phone number')
    }
    await this.usersService.markVerified(user._id.toString())
    user = await this.usersService.findByIdOrThrow(user._id.toString())

    const tokens = await this.issueTokens(user)
    await this.storeRefreshToken(user._id.toString(), tokens.refreshToken)

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: await this.usersService.toSafeUser(user),
    }
  }

  // ── Login ───────────────────────────────────────────────────────

  async login(dto: LoginDto): Promise<AuthResponse> {
    if (!dto.phone && !dto.email) {
      throw new BadRequestException('Provide either phone or email')
    }

    // Key by phone or email — both are unique identifiers
    const lockKey = `${REDIS_LOGIN_LOCKED_PREFIX}${dto.phone ?? dto.email}`
    const attemptsKey = `${REDIS_LOGIN_ATTEMPTS_PREFIX}${dto.phone ?? dto.email}`

    const locked = await this.redis.get(lockKey)
    if (locked) {
      const ttl = await this.redis.ttl(lockKey)
      throw new ForbiddenException(
        `Too many failed attempts. Try again in ${Math.ceil(ttl / 60)} minutes.`,
      )
    }

    const user = dto.phone
      ? await this.usersService.findByPhone(dto.phone)
      : await this.usersService.findByEmail(dto.email!)

    const isValidUser = user && user.isActive && user.passwordHash
    const passwordValid = isValidUser && await bcrypt.compare(dto.password, user.passwordHash!)

    if (!isValidUser || !passwordValid) {
      const attempts = await this.redis.incr(attemptsKey)
      await this.redis.expire(attemptsKey, LOGIN_LOCKOUT_SECONDS)
      if (attempts >= LOGIN_MAX_ATTEMPTS) {
        await this.redis.setex(lockKey, LOGIN_LOCKOUT_SECONDS, '1')
        await this.redis.del(attemptsKey)
        throw new ForbiddenException(
          `Too many failed attempts. Account locked for 15 minutes.`,
        )
      }
      // Generic message — don't reveal whether account exists or password is wrong
      throw new UnauthorizedException('Invalid credentials')
    }

    // Success — clear failed attempts counter
    await this.redis.del(attemptsKey)
    await this.usersService.updateLastLogin(user._id.toString())

    const tokens = await this.issueTokens(user)
    await this.storeRefreshToken(user._id.toString(), tokens.refreshToken)

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: await this.usersService.toSafeUser(user),
    }
  }

  // ── Logout ──────────────────────────────────────────────────────

  async logout(userId: string): Promise<void> {
    await this.redis.del(`${REDIS_REFRESH_TOKEN_PREFIX}${userId}`)
  }

  // ── Refresh (web — cookie) ───────────────────────────────────────

  async refreshWeb(refreshToken: string): Promise<AuthResponse> {
    return this.rotateRefreshToken(refreshToken)
  }

  // ── Refresh (mobile — body token) ────────────────────────────────

  async refreshMobile(refreshToken: string): Promise<AuthResponse> {
    return this.rotateRefreshToken(refreshToken)
  }

  // ── Forgot Password ─────────────────────────────────────────────

  async forgotPassword(email: string): Promise<void> {
    const user = await this.usersService.findByEmail(email)
    // Always return success — never reveal if email exists
    if (!user) return

    const token = crypto.randomBytes(32).toString('hex')
    const userId = user._id.toString()

    await this.redis.setex(
      `${REDIS_PWD_RESET_PREFIX}${token}`,
      PWD_RESET_TOKEN_TTL_SECONDS,
      userId,
    )

    await this.email.sendPasswordReset(email, user.firstName, token)
  }

  // ── Reset Password ───────────────────────────────────────────────

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const userId = await this.redis.get(`${REDIS_PWD_RESET_PREFIX}${dto.token}`)
    if (!userId) {
      throw new BadRequestException('Reset token expired or already used')
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS)
    await this.usersService.updatePasswordHash(userId, passwordHash)

    // Invalidate reset token + any active refresh tokens
    await this.redis.del(`${REDIS_PWD_RESET_PREFIX}${dto.token}`)
    await this.redis.del(`${REDIS_REFRESH_TOKEN_PREFIX}${userId}`)
  }

  // ── Admin Login (email + password + brute force protection) ─────

  async adminLogin(dto: AdminLoginDto): Promise<AuthResponse> {
    const lockedKey = `${REDIS_ADMIN_LOGIN_LOCKED_PREFIX}${dto.email}`
    const attemptsKey = `${REDIS_ADMIN_LOGIN_ATTEMPTS_PREFIX}${dto.email}`

    // Check lockout
    const locked = await this.redis.get(lockedKey)
    if (locked) {
      const ttl = await this.redis.ttl(lockedKey)
      throw new ForbiddenException(
        `Account locked due to too many failed attempts. Try again in ${Math.ceil(ttl / 60)} minutes.`,
      )
    }

    const user = await this.usersService.findByEmail(dto.email)
    const isValidUser =
      user &&
      user.isActive &&
      user.roles.includes(UserRoleEnum.SUPER_ADMIN) &&
      user.passwordHash

    const passwordValid =
      isValidUser && (await bcrypt.compare(dto.password, user!.passwordHash!))

    if (!isValidUser || !passwordValid) {
      // Increment failed attempts
      const attempts = await this.redis.incr(attemptsKey)
      await this.redis.expire(attemptsKey, ADMIN_LOCKOUT_SECONDS)

      if (attempts >= ADMIN_MAX_ATTEMPTS) {
        const lockedUntil = new Date(Date.now() + ADMIN_LOCKOUT_SECONDS * 1000)
        await this.redis.setex(lockedKey, ADMIN_LOCKOUT_SECONDS, '1')
        await this.redis.del(attemptsKey)

        // Send security alert email (non-blocking)
        if (user?.email) {
          void this.email.sendAdminSecurityAlert(user.email, lockedUntil)
        }

        throw new ForbiddenException(
          `Account locked for 15 minutes after ${ADMIN_MAX_ATTEMPTS} failed attempts.`,
        )
      }

      const remaining = ADMIN_MAX_ATTEMPTS - attempts
      throw new UnauthorizedException(
        `Invalid credentials. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining before lockout.`,
      )
    }

    // Success — clear failed attempts
    await this.redis.del(attemptsKey)
    await this.usersService.updateLastLogin(user!._id.toString())

    const tokens = await this.issueTokens(user!)
    await this.storeRefreshToken(user!._id.toString(), tokens.refreshToken)

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: await this.usersService.toSafeUser(user!),
    }
  }

  async portalLogin(dto: PortalLoginDto): Promise<AuthResponse> {
    const lockedKey = `${REDIS_ADMIN_LOGIN_LOCKED_PREFIX}${dto.email}`
    const attemptsKey = `${REDIS_ADMIN_LOGIN_ATTEMPTS_PREFIX}${dto.email}`

    const locked = await this.redis.get(lockedKey)
    if (locked) {
      const ttl = await this.redis.ttl(lockedKey)
      throw new ForbiddenException(
        `Account locked due to too many failed attempts. Try again in ${Math.ceil(ttl / 60)} minutes.`,
      )
    }

    const user = await this.usersService.findByEmail(dto.email)
    const isValidUser =
      user &&
      user.isActive &&
      (user.roles.includes(UserRoleEnum.SUPER_ADMIN) || user.roles.includes(UserRoleEnum.RESTAURANT_OWNER)) &&
      user.passwordHash

    const passwordValid =
      isValidUser && (await bcrypt.compare(dto.password, user!.passwordHash!))

    if (!isValidUser || !passwordValid) {
      const attempts = await this.redis.incr(attemptsKey)
      await this.redis.expire(attemptsKey, ADMIN_LOCKOUT_SECONDS)

      if (attempts >= ADMIN_MAX_ATTEMPTS) {
        const lockedUntil = new Date(Date.now() + ADMIN_LOCKOUT_SECONDS * 1000)
        await this.redis.setex(lockedKey, ADMIN_LOCKOUT_SECONDS, '1')
        await this.redis.del(attemptsKey)
        if (user?.email) {
          void this.email.sendAdminSecurityAlert(user.email, lockedUntil)
        }
        throw new ForbiddenException(
          `Account locked for 15 minutes after ${ADMIN_MAX_ATTEMPTS} failed attempts.`,
        )
      }

      const remaining = ADMIN_MAX_ATTEMPTS - attempts
      throw new UnauthorizedException(
        `Invalid credentials. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining before lockout.`,
      )
    }

    await this.redis.del(attemptsKey)
    await this.usersService.updateLastLogin(user!._id.toString())

    const tokens = await this.issueTokens(user!)
    await this.storeRefreshToken(user!._id.toString(), tokens.refreshToken)

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: await this.usersService.toSafeUser(user!),
    }
  }

  // ── Private helpers ─────────────────────────────────────────────

  private async issueTokens(user: UserDocument): Promise<AuthTokens> {
    // Legacy fallback: some docs may still carry single `role` instead of `roles[]`.
    const legacy = user as UserDocument & { role?: UserRole }
    const roles: UserRole[] = (user.roles && user.roles.length > 0)
      ? (user.roles as UserRole[])
      : legacy.role ? [legacy.role] : []

    const payload: JwtPayload = {
      sub: user._id.toString(),
      roles,
      country: user.country,
    }

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
        expiresIn: '15m',
      }),
      this.jwtService.signAsync(payload, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: '7d',
      }),
    ])

    return { accessToken, refreshToken }
  }

  private async storeRefreshToken(userId: string, refreshToken: string): Promise<void> {
    const hash = await bcrypt.hash(refreshToken, BCRYPT_ROUNDS)
    await this.redis.setex(
      `${REDIS_REFRESH_TOKEN_PREFIX}${userId}`,
      REFRESH_TOKEN_TTL_SECONDS,
      hash,
    )
  }

  private async rotateRefreshToken(refreshToken: string): Promise<AuthResponse> {
    let payload: JwtPayload
    try {
      payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      })
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token')
    }

    const stored = await this.redis.get(`${REDIS_REFRESH_TOKEN_PREFIX}${payload.sub}`)
    if (!stored) {
      throw new UnauthorizedException('Refresh token revoked. Please log in again.')
    }

    const valid = await bcrypt.compare(refreshToken, stored)
    if (!valid) {
      // Possible token reuse — revoke all sessions for this user
      await this.redis.del(`${REDIS_REFRESH_TOKEN_PREFIX}${payload.sub}`)
      throw new UnauthorizedException('Token reuse detected. Please log in again.')
    }

    const user = await this.usersService.findByIdOrThrow(payload.sub)

    const tokens = await this.issueTokens(user)
    await this.storeRefreshToken(user._id.toString(), tokens.refreshToken)

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: await this.usersService.toSafeUser(user),
    }
  }

  private generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString()
  }
}
