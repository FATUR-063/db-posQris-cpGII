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
