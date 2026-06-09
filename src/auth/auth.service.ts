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
