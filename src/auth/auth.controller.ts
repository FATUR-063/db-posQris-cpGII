import { Controller, Post, Get, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ─── PUBLIC ─────────────────────────────────────────────

  @Post('register')
  @ApiOperation({
    summary: 'Register user baru (publik — role otomatis KASIR)',
    description:
      'Endpoint publik untuk self-registration kasir. ' +
      'Untuk membuat user dengan role lain, gunakan POST /auth/create-user (SUPER_ADMIN only).',
  })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @ApiOperation({
    summary: 'Login dan dapatkan JWT token',
    description:
      'Gunakan access_token di response sebagai Bearer token untuk endpoint lain. ' +
      'Token berisi: sub (userId), email, dan role.',
  })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  // ─── PROTECTED ──────────────────────────────────────────

  @Post('create-user')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Buat user dengan role tertentu (SUPER_ADMIN only)',
    description:
      'Hanya SUPER_ADMIN yang boleh membuat user dengan role ' +
      'MANAGER, FINANCE_STAFF, KASIR, atau SUPER_ADMIN. ' +
      'Jika field role tidak diisi, default KASIR.',
  })
  createUser(@Body() dto: CreateUserDto) {
    return this.authService.createUser(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Profil user yang sedang login',
    description: 'Mengembalikan data user berdasarkan JWT token yang dikirim.',
  })
  getMe(@Request() req: any) {
    return this.authService.getMe(req.user.userId);
  }
}
