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
