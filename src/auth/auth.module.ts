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
