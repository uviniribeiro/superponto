import { BadRequestException, Body, Controller, Get, HttpCode, Post, UnauthorizedException } from '@nestjs/common';
import {
  CurrentUser,
  PasswordResetService,
  Public,
  SignInService,
  TokenService,
} from '@nestjs/authentication';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import { ApiTags } from '@nestjs/swagger';
import type { AuthUser } from './auth-user.js';
import {
  forgotSchema, refreshSchema, resetSchema, signInSchema,
  type ForgotDto, type RefreshDto, type ResetDto, type SignInDto,
} from './auth.schemas.js';
import { CredentialsService } from './credentials.service.js';
import { RequestInfo, type RequestMeta } from '../common/tenant.js';

const changePasswordSchema = z.object({ currentPassword: z.string().min(1).max(256), newPassword: z.string().min(12, 'A nova senha precisa de 12 caracteres ou mais').max(128) });

const publicUser = (u: AuthUser) => ({
  id: u.id, email: u.email, displayName: u.displayName, tenantId: u.tenantId, personId: u.personId,
  isPlatformAdmin: u.isPlatformAdmin, isSupport: u.isSupport, mustChangePassword: u.mustChangePassword,
  permissions: [...new Set(u.grants.map((g) => g.permission))].sort(),
});

@ApiTags('auth')
@Controller('v1/auth')
export class AuthController {
  constructor(
    private readonly credentials: CredentialsService,
    private readonly signIn: SignInService,
    private readonly tokens: TokenService,
    private readonly passwordReset: PasswordResetService,
  ) {}

  /** Login do navegador: cria sessão em cookie httpOnly. */
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('sign-in')
  @HttpCode(200)
  async signInWithPassword(@Body({ schema: signInSchema }) body: SignInDto, @RequestInfo() meta: RequestMeta) {
    const user = await this.credentials.verify(body.email, body.password, meta);
    if (!user) throw new UnauthorizedException('E-mail ou senha incorretos');
    const { session } = await this.signIn.signIn(user.id, { method: 'password' });
    return { user: publicUser(user), mfaRequired: session.mfa === 'pending' };
  }

  /** Login dos apps: access token (15 min) + refresh token rotativo. */
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('token')
  @HttpCode(200)
  async issueToken(@Body({ schema: signInSchema }) body: SignInDto, @RequestInfo() meta: RequestMeta) {
    const user = await this.credentials.verify(body.email, body.password, meta);
    if (!user) throw new UnauthorizedException('E-mail ou senha incorretos');
    return this.tokens.issue(user.id, { method: 'password', claims: { amr: ['pwd'] } });
  }

  /** Refresh token desconhecido, expirado ou reutilizado responde 401 (e reuso revoga a família). */
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('token/refresh')
  @HttpCode(200)
  refresh(@Body({ schema: refreshSchema }) body: RefreshDto) {
    return this.tokens.refresh(body.refreshToken);
  }

  @Post('sign-out')
  @HttpCode(204)
  async signOut() {
    await this.signIn.signOut();
  }

  /** Troca de senha pelo usuário logado (também atende a troca obrigatória no primeiro acesso). */
  @Post('password/change')
  @HttpCode(204)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async changePassword(@CurrentUser() user: AuthUser, @Body({ schema: changePasswordSchema }) body: { currentPassword: string; newPassword: string }, @RequestInfo() meta: RequestMeta) {
    await this.credentials.change(user.id, body.currentPassword, body.newPassword, meta);
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return publicUser(user);
  }

  /** Mesma resposta, no mesmo tempo, exista ou não a conta. */
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('password/forgot')
  @HttpCode(202)
  forgot(@Body({ schema: forgotSchema }) body: ForgotDto) {
    this.passwordReset.request(body.email);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('password/reset')
  @HttpCode(200)
  async reset(@Body({ schema: resetSchema }) body: ResetDto) {
    const result = await this.passwordReset.reset(body.token, body.password, { signIn: false });
    if (!result) throw new BadRequestException('Link inválido ou expirado');
    return { ok: true };
  }
}
