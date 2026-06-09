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
