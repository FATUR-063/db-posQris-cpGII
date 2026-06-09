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
