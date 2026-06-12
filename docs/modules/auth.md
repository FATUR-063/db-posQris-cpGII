# Dokumentasi Modul — Auth

> **Di-generate otomatis.** Jangan edit manual — perbarui dengan:
>
> ```bash
> npm run docs:modules
> ```

| | |
|---|---|
| **Modul** | `auth` |
| **Folder sumber** | `src/auth` |
| **Diperbarui** | 2026-06-12 06:54:15 |
| **Total file** | 12 |
| **Total baris kode** | 486 |

---

## Struktur file

```
src/auth/
├── auth.controller.spec.ts
├── auth.controller.ts
├── auth.module.ts
├── auth.service.spec.ts
├── auth.service.ts
├── decorators/roles.decorator.ts
├── dto/create-user.dto.ts
├── dto/login.dto.ts
├── dto/register.dto.ts
├── guards/jwt-auth.guard.ts
├── guards/roles.guard.ts
├── jwt.strategy.ts
```

---

## Daftar isi

- [src/auth/auth.controller.spec.ts](#src-auth-auth-controller-spec-ts) (19 baris)
- [src/auth/auth.controller.ts](#src-auth-auth-controller-ts) (68 baris)
- [src/auth/auth.module.ts](#src-auth-auth-module-ts) (42 baris)
- [src/auth/auth.service.spec.ts](#src-auth-auth-service-spec-ts) (19 baris)
- [src/auth/auth.service.ts](#src-auth-auth-service-ts) (135 baris)
- [src/auth/decorators/roles.decorator.ts](#src-auth-decorators-roles-decorator-ts) (18 baris)
- [src/auth/dto/create-user.dto.ts](#src-auth-dto-create-user-dto-ts) (38 baris)
- [src/auth/dto/login.dto.ts](#src-auth-dto-login-dto-ts) (12 baris)
- [src/auth/dto/register.dto.ts](#src-auth-dto-register-dto-ts) (21 baris)
- [src/auth/guards/jwt-auth.guard.ts](#src-auth-guards-jwt-auth-guard-ts) (14 baris)
- [src/auth/guards/roles.guard.ts](#src-auth-guards-roles-guard-ts) (46 baris)
- [src/auth/jwt.strategy.ts](#src-auth-jwt-strategy-ts) (54 baris)

---

## src/auth/auth.controller.spec.ts

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

```

---

## src/auth/auth.controller.ts

```typescript
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

```

---

## src/auth/auth.module.ts

```typescript
// src/auth/auth.module.ts
//
// PERUBAHAN dari versi sebelumnya:
// + Import PassportModule (wajib untuk strategy)
// + Import ConfigModule untuk env yang aman
// + Daftarkan JwtStrategy sebagai provider
// + Export JwtAuthGuard dan RolesGuard agar bisa dipakai modul lain

import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'fallback-secret-ganti-di-env',
      signOptions: {
        expiresIn: (process.env.JWT_EXPIRES_IN ?? '1d') as any,
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,   // strategy untuk verify token
    JwtAuthGuard,  // guard untuk protect endpoint
    RolesGuard,    // guard untuk cek role
  ],
  exports: [
    JwtModule,
    JwtAuthGuard,  // export agar bisa dipakai di modul lain
    RolesGuard,    // export agar bisa dipakai di modul lain
  ],
})
export class AuthModule {}

```

---

## src/auth/auth.service.spec.ts

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AuthService],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

```

---

## src/auth/auth.service.ts

```typescript
import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { CreateUserDto } from './dto/create-user.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  // ─── PUBLIC REGISTER (selalu KASIR) ─────────────────────

  async register(dto: RegisterDto) {
    const existing = await this.prisma.db.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) throw new ConflictException('Email sudah terdaftar');

    const hashed = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.db.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        password: hashed,
        // role tidak diisi → default KASIR dari Prisma schema
      },
    });

    return {
      message: 'Register berhasil',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }

  // ─── LOGIN ──────────────────────────────────────────────

  async login(dto: LoginDto) {
    const user = await this.prisma.db.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) throw new UnauthorizedException('Email atau password salah');

    // Cek apakah user masih aktif
    if (!user.isActive) {
      throw new UnauthorizedException('Akun tidak aktif. Hubungi admin.');
    }

    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) throw new UnauthorizedException('Email atau password salah');

    const token = await this.jwt.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    return {
      message: 'Login berhasil',
      access_token: token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }

  // ─── CREATE USER (SUPER_ADMIN only) ─────────────────────

  async createUser(dto: CreateUserDto) {
    const existing = await this.prisma.db.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) throw new ConflictException('Email sudah terdaftar');

    const hashed = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.db.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        password: hashed,
        role: dto.role ?? 'KASIR',
      },
    });

    return {
      message: `User berhasil dibuat dengan role ${user.role}`,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }

  // ─── GET CURRENT USER ───────────────────────────────────

  async getMe(userId: string) {
    const user = await this.prisma.db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    if (!user) throw new NotFoundException('User tidak ditemukan');

    return { user };
  }
}

```

---

## src/auth/decorators/roles.decorator.ts

```typescript
// src/auth/decorators/roles.decorator.ts
//
// FUNGSI: Custom decorator untuk menandai role apa yang boleh akses endpoint.
// Cara pakai: @Roles('SUPER_ADMIN', 'MANAGER') di atas method controller.
//
// Decorator ini hanya MENYIMPAN metadata — yang membaca adalah RolesGuard.
// Tanpa RolesGuard, decorator ini tidak punya efek apapun.

import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

// Contoh pakai:
//   @Roles('SUPER_ADMIN')            → hanya SUPER_ADMIN
//   @Roles('SUPER_ADMIN', 'MANAGER') → SUPER_ADMIN atau MANAGER
//   @Roles('KASIR', 'MANAGER', 'SUPER_ADMIN') → semua role boleh (tapi tetap harus login)
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

```

---

## src/auth/dto/create-user.dto.ts

```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength, IsEnum, IsOptional } from 'class-validator';

/**
 * Enum harus MATCH dengan enum Role di schema.prisma.
 * Dipakai untuk validasi + Swagger dropdown.
 */
export enum RoleEnum {
  KASIR = 'KASIR',
  MANAGER = 'MANAGER',
  FINANCE_STAFF = 'FINANCE_STAFF',
  SUPER_ADMIN = 'SUPER_ADMIN',
}

export class CreateUserDto {
  @ApiProperty({ example: 'Manager Klinik', description: 'Nama lengkap user' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'manager@klinik.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123', minLength: 6 })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiPropertyOptional({
    enum: RoleEnum,
    example: RoleEnum.MANAGER,
    description: 'Role user. Default: KASIR jika tidak diisi.',
  })
  @IsOptional()
  @IsEnum(RoleEnum)
  role?: RoleEnum;
}

```

---

## src/auth/dto/login.dto.ts

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'kasir@klinik.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  password: string;
}
```

---

## src/auth/dto/register.dto.ts

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'Kasir Satu', description: 'Nama lengkap user' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'kasir@klinik.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123', minLength: 6 })
  @IsString()
  @MinLength(6)
  password: string;

  // Role TIDAK ada di sini — register publik selalu KASIR.
  // Untuk buat user dengan role lain → POST /auth/create-user (SUPER_ADMIN only)
}

```

---

## src/auth/guards/jwt-auth.guard.ts

```typescript
// src/auth/guards/jwt-auth.guard.ts
//
// FUNGSI: Guard yang dipakai di controller untuk melindungi endpoint.
// Cara pakai: @UseGuards(JwtAuthGuard) di atas controller atau method.
//
// Guard ini otomatis memanggil JwtStrategy.validate() di balik layar.
// Kalau token tidak ada / expired / tidak valid → 401 Unauthorized otomatis.

import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}

```

---

## src/auth/guards/roles.guard.ts

```typescript
// src/auth/guards/roles.guard.ts
//
// FUNGSI: Guard kedua yang cek apakah role user sesuai dengan @Roles() di endpoint.
// Selalu dipakai BERSAMA JwtAuthGuard — tidak bisa standalone.
//
// Urutan eksekusi:
//   JwtAuthGuard (cek token valid) → RolesGuard (cek role sesuai)
//
// Jika endpoint tidak punya @Roles() → semua role yang sudah login boleh akses.

import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Ambil role yang dibutuhkan dari metadata @Roles()
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(), // cek di level method dulu
      context.getClass(),   // fallback ke level class
    ]);

    // Kalau tidak ada @Roles() → semua yang sudah login boleh akses
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // Ambil req.user yang sudah diisi oleh JwtAuthGuard
    const { user } = context.switchToHttp().getRequest();

    // Cek apakah role user ada di list requiredRoles
    const hasRole = requiredRoles.includes(user?.role);

    if (!hasRole) {
      throw new ForbiddenException(
        `Akses ditolak. Endpoint ini membutuhkan role: ${requiredRoles.join(' / ')}`
      );
    }

    return true;
  }
}

```

---

## src/auth/jwt.strategy.ts

```typescript
// src/auth/jwt.strategy.ts
//
// FUNGSI: Memberi tahu NestJS cara memvalidasi JWT yang masuk.
// Dipanggil otomatis oleh JwtAuthGuard setiap kali ada request dengan
// header "Authorization: Bearer <token>".
//
// Alurnya:
//   Request masuk → JwtAuthGuard → JwtStrategy.validate()
//   → return payload → disimpan di req.user

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

// Tipe payload yang ada di dalam JWT kita
// Sesuai dengan yang di-sign di auth.service.ts:
//   { sub: user.id, email: user.email, role: user.role }
export interface JwtPayload {
  sub: string;   // user ID
  email: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      // Ambil token dari header "Authorization: Bearer <token>"
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),

      // Tolak token yang sudah expired
      ignoreExpiration: false,

      // Secret harus sama dengan yang dipakai saat sign di auth.service.ts
      secretOrKey: process.env.JWT_SECRET ?? 'fallback-secret-ganti-di-env',
    });
  }

  // Dipanggil setelah token berhasil diverifikasi
  // Return value-nya akan tersimpan di req.user
  async validate(payload: JwtPayload) {
    if (!payload.sub || !payload.email) {
      throw new UnauthorizedException('Token tidak valid');
    }

    // Ini yang bisa diakses via @Request() req → req.user
    return {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
    };
  }
}

```
