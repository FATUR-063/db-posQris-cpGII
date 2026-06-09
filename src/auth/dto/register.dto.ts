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
