import {
  Controller,
  Post,
  Body,
  Res,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common'
import { ApiTags, ApiOperation, ApiCookieAuth } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import type { Request, Response } from 'express'
import { AuthService } from './auth.service'
import { RegisterDto } from './dto/register.dto'
import { LoginDto } from './dto/login.dto'
import { SendOtpDto } from './dto/send-otp.dto'
import { VerifyOtpDto } from './dto/verify-otp.dto'
import { RefreshMobileDto } from './dto/refresh-mobile.dto'
import { ForgotPasswordDto } from './dto/forgot-password.dto'
import { ResetPasswordDto } from './dto/reset-password.dto'
import { AdminLoginDto } from './dto/admin-login.dto'
import { PortalLoginDto } from './dto/portal-login.dto'
import { AddRoleDto } from './dto/add-role.dto'
import { VerifyAndAddRoleDto } from './dto/verify-and-add-role.dto'
import { Public } from '../../common/decorators/public.decorator'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import type { JwtPayload } from '@grandxl/types'

const COOKIE_NAME = 'refresh_token'
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env['NODE_ENV'] === 'production',
  sameSite: 'strict' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
  path: '/',
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ medium: { limit: 5, ttl: 60_000 } })
  @Post('register')
  @ApiOperation({ summary: 'Register a new customer account' })
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.register(dto)
    res.cookie(COOKIE_NAME, result.refreshToken, COOKIE_OPTIONS)
    // refreshToken also in body so mobile clients can store in SecureStore (web ignores it)
    return { accessToken: result.accessToken, refreshToken: result.refreshToken, user: result.user }
  }

  @Public()
  @Throttle({ medium: { limit: 3, ttl: 60_000 } })
  @Post('send-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send OTP to phone number via SMS' })
  async sendOtp(@Body() dto: SendOtpDto) {
    await this.authService.sendOtp(dto.phone)
    return { message: 'OTP sent successfully' }
  }

  @Public()
  @Throttle({ medium: { limit: 3, ttl: 60_000 } })
  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify OTP and mark phone as verified' })
  async verifyOtp(
    @Body() dto: VerifyOtpDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.verifyOtp(dto)
    if (result.isNewUser) {
      return { isNewUser: true }
    }
    res.cookie(COOKIE_NAME, result.refreshToken, COOKIE_OPTIONS)
    return { accessToken: result.accessToken, refreshToken: result.refreshToken, user: result.user }
  }

  @Public()
  @Throttle({ medium: { limit: 3, ttl: 60_000 } })
  @Post('register-driver')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Complete driver registration after OTP verification' })
  async registerDriver(
    @Body() dto: { phone: string; firstName: string; lastName: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.registerDriver(dto)
    res.cookie(COOKIE_NAME, result.refreshToken, COOKIE_OPTIONS)
    return { accessToken: result.accessToken, refreshToken: result.refreshToken, user: result.user }
  }

  @Public()
  @Throttle({ medium: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with phone/email + password' })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(dto)
    res.cookie(COOKIE_NAME, result.refreshToken, COOKIE_OPTIONS)
    return { accessToken: result.accessToken, refreshToken: result.refreshToken, user: result.user }
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout and revoke refresh token' })
  async logout(
    @CurrentUser() user: JwtPayload,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.logout(user.sub)
    res.clearCookie(COOKIE_NAME, { path: '/' })
    return { message: 'Logged out successfully' }
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth('refresh_token')
  @ApiOperation({ summary: 'Refresh access token using httpOnly cookie (web)' })
  async refreshWeb(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = req.cookies?.[COOKIE_NAME] as string | undefined
    if (!token) {
      return { accessToken: null, user: null }
    }
    const result = await this.authService.refreshWeb(token)
    res.cookie(COOKIE_NAME, result.refreshToken, COOKIE_OPTIONS)
    return { accessToken: result.accessToken, user: result.user }
  }

  @Public()
  @Post('refresh/mobile')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token using body token (mobile — no cookies)' })
  async refreshMobile(@Body() dto: RefreshMobileDto) {
    const result = await this.authService.refreshMobile(dto.refreshToken)
    // Return new refresh token in body — mobile must update SecureStore on every rotation
    return { accessToken: result.accessToken, refreshToken: result.refreshToken, user: result.user }
  }

  @Public()
  @Throttle({ medium: { limit: 3, ttl: 60_000 } })
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send password reset email' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.forgotPassword(dto.email)
    return { message: 'If this email is registered, a reset link has been sent.' }
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password using token from email' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto)
    return { message: 'Password reset successfully. Please log in.' }
  }

  @Public()
  @Throttle({ medium: { limit: 5, ttl: 60_000 } })
  @Post('admin/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin login — email + password with brute force protection' })
  async adminLogin(
    @Body() dto: AdminLoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.adminLogin(dto)
    res.cookie(COOKIE_NAME, result.refreshToken, COOKIE_OPTIONS)
    return { accessToken: result.accessToken, user: result.user }
  }

  @Public()
  @Throttle({ medium: { limit: 5, ttl: 60_000 } })
  @Post('portal/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Portal login — accepts super_admin and restaurant_owner roles' })
  async portalLogin(
    @Body() dto: PortalLoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.portalLogin(dto)
    res.cookie(COOKIE_NAME, result.refreshToken, COOKIE_OPTIONS)
    return { accessToken: result.accessToken, user: result.user }
  }

  @Post('add-role')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Add a role to the current authenticated user (re-issues tokens)' })
  async addRole(
    @CurrentUser() user: JwtPayload,
    @Body() dto: AddRoleDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.addRoleToCurrentUser(user.sub, dto.role)
    res.cookie(COOKIE_NAME, result.refreshToken, COOKIE_OPTIONS)
    return { accessToken: result.accessToken, refreshToken: result.refreshToken, user: result.user }
  }

  @Public()
  @Post('verify-and-add-role')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify password and add a role in one step (welcome-back flow)' })
  async verifyAndAddRole(
    @Body() dto: VerifyAndAddRoleDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.verifyAndAddRole(dto)
    res.cookie(COOKIE_NAME, result.refreshToken, COOKIE_OPTIONS)
    return { accessToken: result.accessToken, refreshToken: result.refreshToken, user: result.user }
  }
}
