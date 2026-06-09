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
