# Dokumentasi Lengkap — Folder `src`

Dokumen ini berisi **salinan lengkap** seluruh kode TypeScript di folder `src/`, diambil langsung dari file sumber (bukan ringkasan atau cuplikan).

- **Total file:** 33
- **Dibuat:** 2026-05-20 23:38
- **Proyek:** Smart Clinic POS

---

## Struktur folder `src`

```
src/
├── auth/
│   ├── dto/
│   │   ├── login.dto.ts
│   │   └── register.dto.ts
│   ├── auth.controller.spec.ts
│   ├── auth.controller.ts
│   ├── auth.module.ts
│   ├── auth.service.spec.ts
│   └── auth.service.ts
├── billing/
│   ├── dto/
│   │   └── create-billing.dto.ts
│   ├── billing.controller.spec.ts
│   ├── billing.controller.ts
│   ├── billing.module.ts
│   ├── billing.service.spec.ts
│   └── billing.service.ts
├── items/
│   ├── dto/
│   │   └── create-item.dto.ts
│   ├── items.controller.spec.ts
│   ├── items.controller.ts
│   ├── items.module.ts
│   ├── items.service.spec.ts
│   └── items.service.ts
├── payment/
│   ├── dto/
│   │   └── create-payment.dto.ts
│   ├── payment.controller.spec.ts
│   ├── payment.controller.ts
│   ├── payment.module.ts
│   ├── payment.service.spec.ts
│   └── payment.service.ts
├── prisma/
│   ├── prisma.module.ts
│   ├── prisma.service.spec.ts
│   └── prisma.service.ts
├── app.controller.spec.ts
├── app.controller.ts
├── app.module.ts
├── app.service.ts
└── main.ts
```

---

## Daftar isi

- [src/app.controller.spec.ts](#src-app-controller-spec-ts)
- [src/app.controller.ts](#src-app-controller-ts)
- [src/app.module.ts](#src-app-module-ts)
- [src/app.service.ts](#src-app-service-ts)
- [src/auth/auth.controller.spec.ts](#src-auth-auth-controller-spec-ts)
- [src/auth/auth.controller.ts](#src-auth-auth-controller-ts)
- [src/auth/auth.module.ts](#src-auth-auth-module-ts)
- [src/auth/auth.service.spec.ts](#src-auth-auth-service-spec-ts)
- [src/auth/auth.service.ts](#src-auth-auth-service-ts)
- [src/auth/dto/login.dto.ts](#src-auth-dto-login-dto-ts)
- [src/auth/dto/register.dto.ts](#src-auth-dto-register-dto-ts)
- [src/billing/billing.controller.spec.ts](#src-billing-billing-controller-spec-ts)
- [src/billing/billing.controller.ts](#src-billing-billing-controller-ts)
- [src/billing/billing.module.ts](#src-billing-billing-module-ts)
- [src/billing/billing.service.spec.ts](#src-billing-billing-service-spec-ts)
- [src/billing/billing.service.ts](#src-billing-billing-service-ts)
- [src/billing/dto/create-billing.dto.ts](#src-billing-dto-create-billing-dto-ts)
- [src/items/dto/create-item.dto.ts](#src-items-dto-create-item-dto-ts)
- [src/items/items.controller.spec.ts](#src-items-items-controller-spec-ts)
- [src/items/items.controller.ts](#src-items-items-controller-ts)
- [src/items/items.module.ts](#src-items-items-module-ts)
- [src/items/items.service.spec.ts](#src-items-items-service-spec-ts)
- [src/items/items.service.ts](#src-items-items-service-ts)
- [src/main.ts](#src-main-ts)
- [src/payment/dto/create-payment.dto.ts](#src-payment-dto-create-payment-dto-ts)
- [src/payment/payment.controller.spec.ts](#src-payment-payment-controller-spec-ts)
- [src/payment/payment.controller.ts](#src-payment-payment-controller-ts)
- [src/payment/payment.module.ts](#src-payment-payment-module-ts)
- [src/payment/payment.service.spec.ts](#src-payment-payment-service-spec-ts)
- [src/payment/payment.service.ts](#src-payment-payment-service-ts)
- [src/prisma/prisma.module.ts](#src-prisma-prisma-module-ts)
- [src/prisma/prisma.service.spec.ts](#src-prisma-prisma-service-spec-ts)
- [src/prisma/prisma.service.ts](#src-prisma-prisma-service-ts)

---

## `src/app.controller.spec.ts` {#src-app-controller-spec-ts}

| Info | Nilai |
|------|-------|
| Path | `src/app.controller.spec.ts` |
| Jumlah baris | 22 |

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });
});
```

---

## `src/app.controller.ts` {#src-app-controller-ts}

| Info | Nilai |
|------|-------|
| Path | `src/app.controller.ts` |
| Jumlah baris | 12 |

```typescript
import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
```

---

## `src/app.module.ts` {#src-app-module-ts}

| Info | Nilai |
|------|-------|
| Path | `src/app.module.ts` |
| Jumlah baris | 15 |

```typescript
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { BillingModule } from './billing/billing.module';
import { PaymentModule } from './payment/payment.module';
import { ItemsModule } from './items/items.module';

@Module({
  imports: [PrismaModule, AuthModule, BillingModule, PaymentModule, ItemsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

---

## `src/app.service.ts` {#src-app-service-ts}

| Info | Nilai |
|------|-------|
| Path | `src/app.service.ts` |
| Jumlah baris | 8 |

```typescript
import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }
}
```

---

## `src/auth/auth.controller.spec.ts` {#src-auth-auth-controller-spec-ts}

| Info | Nilai |
|------|-------|
| Path | `src/auth/auth.controller.spec.ts` |
| Jumlah baris | 18 |

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

## `src/auth/auth.controller.ts` {#src-auth-auth-controller-ts}

| Info | Nilai |
|------|-------|
| Path | `src/auth/auth.controller.ts` |
| Jumlah baris | 23 |

```typescript
import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register kasir baru' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @ApiOperation({ summary: 'Login dan dapatkan JWT token' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }
}
```

---

## `src/auth/auth.module.ts` {#src-auth-auth-module-ts}

| Info | Nilai |
|------|-------|
| Path | `src/auth/auth.module.ts` |
| Jumlah baris | 18 |

```typescript
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: 
        { expiresIn: (process.env.JWT_EXPIRES_IN ?? '1d') as any },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [JwtModule],
})
export class AuthModule {}
```

---

## `src/auth/auth.service.spec.ts` {#src-auth-auth-service-spec-ts}

| Info | Nilai |
|------|-------|
| Path | `src/auth/auth.service.spec.ts` |
| Jumlah baris | 18 |

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

## `src/auth/auth.service.ts` {#src-auth-auth-service-ts}

| Info | Nilai |
|------|-------|
| Path | `src/auth/auth.service.ts` |
| Jumlah baris | 64 |

```typescript
import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    // Cek email sudah terdaftar belum
    const existing = await this.prisma.db.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) throw new ConflictException('Email sudah terdaftar');

    // Hash password
    const hashed = await bcrypt.hash(dto.password, 10);

    // Simpan user baru
    const user = await this.prisma.db.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        password: hashed,
      },
    });

    return {
      message: 'Register berhasil',
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    };
  }

  async login(dto: LoginDto) {
    // Cari user by email
    const user = await this.prisma.db.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) throw new UnauthorizedException('Email atau password salah');

    // Verifikasi password
    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) throw new UnauthorizedException('Email atau password salah');

    // Generate JWT token
    const token = await this.jwt.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    return {
      message: 'Login berhasil',
      access_token: token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    };
  }
}
```

---

## `src/auth/dto/login.dto.ts` {#src-auth-dto-login-dto-ts}

| Info | Nilai |
|------|-------|
| Path | `src/auth/dto/login.dto.ts` |
| Jumlah baris | 12 |

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

## `src/auth/dto/register.dto.ts` {#src-auth-dto-register-dto-ts}

| Info | Nilai |
|------|-------|
| Path | `src/auth/dto/register.dto.ts` |
| Jumlah baris | 17 |

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'Kasir Satu' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'kasir@klinik.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123', minLength: 6 })
  @IsString()
  @MinLength(6)
  password: string;
}
```

---

## `src/billing/billing.controller.spec.ts` {#src-billing-billing-controller-spec-ts}

| Info | Nilai |
|------|-------|
| Path | `src/billing/billing.controller.spec.ts` |
| Jumlah baris | 18 |

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { BillingController } from './billing.controller';

describe('BillingController', () => {
  let controller: BillingController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BillingController],
    }).compile();

    controller = module.get<BillingController>(BillingController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
```

---

## `src/billing/billing.controller.ts` {#src-billing-billing-controller-ts}

| Info | Nilai |
|------|-------|
| Path | `src/billing/billing.controller.ts` |
| Jumlah baris | 25 |

```typescript
import { Controller, Post, Get, Body, Param, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BillingService } from './billing.service';
import { CreateBillingDto } from './dto/create-billing.dto';

@ApiTags('Billing')
@ApiBearerAuth()
@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Post()
  @ApiOperation({ summary: 'Buat transaksi baru + hitung total otomatis' })
  create(@Body() dto: CreateBillingDto, @Request() req: any) {
    // Sementara pakai dummy userId karena belum ada JWT Guard
    const userId = req.user?.sub ?? '359898f3-72f5-42f2-94a3-191851acc95d';
    return this.billingService.createTransaction(dto, userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lihat detail transaksi' })
  findOne(@Param('id') id: string) {
    return this.billingService.getTransaction(id);
  }
}
```

---

## `src/billing/billing.module.ts` {#src-billing-billing-module-ts}

| Info | Nilai |
|------|-------|
| Path | `src/billing/billing.module.ts` |
| Jumlah baris | 9 |

```typescript
import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';

@Module({
  controllers: [BillingController],
  providers: [BillingService],
})
export class BillingModule {}
```

---

## `src/billing/billing.service.spec.ts` {#src-billing-billing-service-spec-ts}

| Info | Nilai |
|------|-------|
| Path | `src/billing/billing.service.spec.ts` |
| Jumlah baris | 18 |

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { BillingService } from './billing.service';

describe('BillingService', () => {
  let service: BillingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BillingService],
    }).compile();

    service = module.get<BillingService>(BillingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
```

---

## `src/billing/billing.service.ts` {#src-billing-billing-service-ts}

| Info | Nilai |
|------|-------|
| Path | `src/billing/billing.service.ts` |
| Jumlah baris | 96 |

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBillingDto } from './dto/create-billing.dto';

@Injectable()
export class BillingService {
  constructor(private prisma: PrismaService) {}

  async createTransaction(dto: CreateBillingDto, userId: string) {
    // 1. Validasi semua item ada di database
    const itemIds = dto.items.map((i) => i.itemId);
    const items = await this.prisma.db.item.findMany({
      where: { id: { in: itemIds } },
    });

    if (items.length !== itemIds.length) {
      throw new NotFoundException('Satu atau lebih item tidak ditemukan');
    }

    // 2. Hitung subtotal per item
    let subtotal = 0;
    const transactionItems = dto.items.map((cartItem) => {
      const item = items.find((i) => i.id === cartItem.itemId)!;
      const itemSubtotal = item.price * cartItem.quantity;
      subtotal += itemSubtotal;
      return {
        itemId: cartItem.itemId,
        quantity: cartItem.quantity,
        price: item.price,
        subtotal: itemSubtotal,
      };
    });

    // 3. Hitung pajak & admin fee
    // BPJS/Voucher = gratis (total 0)
    const isBpjs = dto.paymentMethod === 'BPJS' || dto.voucherCode;
    const tax = isBpjs ? 0 : 0;        // bisa diisi nanti sesuai kebutuhan
    const adminFee = isBpjs ? 0 : 0;   // bisa diisi nanti sesuai kebutuhan
    const total = isBpjs ? 0 : subtotal + tax + adminFee;

    // 4. Buat transaksi + detail sekaligus (atomic)
    const transaction = await this.prisma.db.transaction.create({
      data: {
        patientId: dto.patientId,
        userId: userId,
        paymentMethod: dto.paymentMethod,
        subtotal,
        tax,
        adminFee,
        total,
        status: 'PENDING_PAYMENT',
        items: {
          create: transactionItems,
        },
      },
      include: {
        items: {
          include: { item: true },
        },
      },
    });

    return {
      message: 'Transaksi berhasil dibuat',
      data: {
        id: transaction.id,
        status: transaction.status,
        paymentMethod: transaction.paymentMethod,
        subtotal: transaction.subtotal,
        tax: transaction.tax,
        adminFee: transaction.adminFee,
        total: transaction.total,
        items: transaction.items.map((ti) => ({
          name: ti.item.name,
          type: ti.item.type,
          quantity: ti.quantity,
          price: ti.price,
          subtotal: ti.subtotal,
        })),
      },
    };
  }

  async getTransaction(id: string) {
    const transaction = await this.prisma.db.transaction.findUnique({
      where: { id },
      include: {
        items: { include: { item: true } },
      },
    });

    if (!transaction) throw new NotFoundException('Transaksi tidak ditemukan');

    return { message: 'Data transaksi', data: transaction };
  }
}
```

---

## `src/billing/dto/create-billing.dto.ts` {#src-billing-dto-create-billing-dto-ts}

| Info | Nilai |
|------|-------|
| Path | `src/billing/dto/create-billing.dto.ts` |
| Jumlah baris | 42 |

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsArray, IsEnum, IsOptional, ValidateNested, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export enum PaymentMethod {
  CASH = 'CASH',
  QRIS = 'QRIS',
  DEBIT = 'DEBIT',
  BPJS = 'BPJS',
}

export class CartItemDto {
  @ApiProperty({ example: '3e1d7e69-f88a-4b89-a021-7c8f2010ee60' })
  @IsString()
  itemId: string;

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(1)
  quantity: number;
}

export class CreateBillingDto {
  @ApiProperty({ example: 'dummy-patient-id' })
  @IsString()
  patientId: string;

  @ApiProperty({ type: [CartItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CartItemDto)
  items: CartItemDto[];

  @ApiProperty({ enum: PaymentMethod, example: PaymentMethod.QRIS })
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @ApiProperty({ example: 'VOUCHER-BPJS-001', required: false })
  @IsString()
  @IsOptional()
  voucherCode?: string;
}
```

---

## `src/items/dto/create-item.dto.ts` {#src-items-dto-create-item-dto-ts}

| Info | Nilai |
|------|-------|
| Path | `src/items/dto/create-item.dto.ts` |
| Jumlah baris | 26 |

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsEnum, IsOptional } from 'class-validator';

export enum ItemType {
  OBAT = 'OBAT',
  LAYANAN = 'LAYANAN',
}

export class CreateItemDto {
  @ApiProperty({ example: 'Paracetamol 500mg' })
  @IsString()
  name: string;

  @ApiProperty({ enum: ItemType, example: ItemType.OBAT })
  @IsEnum(ItemType)
  type: ItemType;

  @ApiProperty({ example: 5000 })
  @IsNumber()
  price: number;

  @ApiProperty({ example: 'tablet', required: false })
  @IsString()
  @IsOptional()
  unit?: string;
}
```

---

## `src/items/items.controller.spec.ts` {#src-items-items-controller-spec-ts}

| Info | Nilai |
|------|-------|
| Path | `src/items/items.controller.spec.ts` |
| Jumlah baris | 18 |

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ItemsController } from './items.controller';

describe('ItemsController', () => {
  let controller: ItemsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ItemsController],
    }).compile();

    controller = module.get<ItemsController>(ItemsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
```

---

## `src/items/items.controller.ts` {#src-items-items-controller-ts}

| Info | Nilai |
|------|-------|
| Path | `src/items/items.controller.ts` |
| Jumlah baris | 23 |

```typescript
import { Controller, Get, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ItemsService } from './items.service';
import { CreateItemDto } from './dto/create-item.dto';

@ApiTags('Items')
@ApiBearerAuth()
@Controller('items')
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  @Get()
  @ApiOperation({ summary: 'Ambil semua daftar obat & layanan' })
  findAll() {
    return this.itemsService.findAll();
  }

  @Post()
  @ApiOperation({ summary: 'Tambah obat atau layanan baru' })
  create(@Body() dto: CreateItemDto) {
    return this.itemsService.create(dto);
  }
}
```

---

## `src/items/items.module.ts` {#src-items-items-module-ts}

| Info | Nilai |
|------|-------|
| Path | `src/items/items.module.ts` |
| Jumlah baris | 9 |

```typescript
import { Module } from '@nestjs/common';
import { ItemsController } from './items.controller';
import { ItemsService } from './items.service';

@Module({
  controllers: [ItemsController],
  providers: [ItemsService],
})
export class ItemsModule {}
```

---

## `src/items/items.service.spec.ts` {#src-items-items-service-spec-ts}

| Info | Nilai |
|------|-------|
| Path | `src/items/items.service.spec.ts` |
| Jumlah baris | 18 |

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ItemsService } from './items.service';

describe('ItemsService', () => {
  let service: ItemsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ItemsService],
    }).compile();

    service = module.get<ItemsService>(ItemsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
```

---

## `src/items/items.service.ts` {#src-items-items-service-ts}

| Info | Nilai |
|------|-------|
| Path | `src/items/items.service.ts` |
| Jumlah baris | 34 |

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateItemDto } from './dto/create-item.dto';

@Injectable()
export class ItemsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const items = await this.prisma.db.item.findMany({
      orderBy: { type: 'asc' },
    });
    return {
      message: 'Data items berhasil diambil',
      total: items.length,
      data: items,
    };
  }

  async create(dto: CreateItemDto) {
    const item = await this.prisma.db.item.create({
      data: {
        name: dto.name,
        type: dto.type,
        price: dto.price,
        unit: dto.unit,
      },
    });
    return {
      message: 'Item berhasil ditambahkan',
      data: item,
    };
  }
}
```

---

## `src/main.ts` {#src-main-ts}

| Info | Nilai |
|------|-------|
| Path | `src/main.ts` |
| Jumlah baris | 34 |

```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express'; // tambah ini
import { join } from 'path'; // tambah ini

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Tambah ini — serve static files dari folder public/
  app.useStaticAssets(join(process.cwd(), 'public'));

  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));

  // CORS — penting biar HTML bisa akses API
  app.enableCors();

  const config = new DocumentBuilder()
    .setTitle('Smart Clinic POS API')
    .setDescription('API Documentation - Smart Clinic POS & Payment QRIS')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(process.env.PORT ?? 3000);
  console.log(`🚀 Server running on http://localhost:3000`);
  console.log(`📚 Swagger docs: http://localhost:3000/api/docs`);
  console.log(`💳 Payment test: http://localhost:3000/payment-test.html`);
}
bootstrap();
```

---

## `src/payment/dto/create-payment.dto.ts` {#src-payment-dto-create-payment-dto-ts}

| Info | Nilai |
|------|-------|
| Path | `src/payment/dto/create-payment.dto.ts` |
| Jumlah baris | 11 |

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class CreatePaymentDto {
  @ApiProperty({ 
    example: 'eae78049-cb06-40f7-b93b-8cdca6f484e2',
    description: 'ID transaksi yang mau dibayar'
  })
  @IsString()
  transactionId: string;
}
```

---

## `src/payment/payment.controller.spec.ts` {#src-payment-payment-controller-spec-ts}

| Info | Nilai |
|------|-------|
| Path | `src/payment/payment.controller.spec.ts` |
| Jumlah baris | 18 |

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { PaymentController } from './payment.controller';

describe('PaymentController', () => {
  let controller: PaymentController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentController],
    }).compile();

    controller = module.get<PaymentController>(PaymentController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
```

---

## `src/payment/payment.controller.ts` {#src-payment-payment-controller-ts}

| Info | Nilai |
|------|-------|
| Path | `src/payment/payment.controller.ts` |
| Jumlah baris | 30 |

```typescript
import { Controller, Post, Get, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentService } from './payment.service';
import { CreatePaymentDto } from './dto/create-payment.dto';

@ApiTags('Payment')
@Controller('payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('tokenizer')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate Snap Token Midtrans untuk transaksi' })
  createSnapToken(@Body() dto: CreatePaymentDto) {
    return this.paymentService.createSnapToken(dto.transactionId);
  }

  @Post('webhook')
  @ApiOperation({ summary: 'Webhook dari Midtrans — jangan diproteksi JWT!' })
  handleWebhook(@Body() notification: any) {
    return this.paymentService.handleWebhook(notification);
  }

  @Get('status/:transactionId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cek status transaksi' })
  getStatus(@Param('transactionId') transactionId: string) {
    return this.paymentService.getTransactionStatus(transactionId);
  }
}
```

---

## `src/payment/payment.module.ts` {#src-payment-payment-module-ts}

| Info | Nilai |
|------|-------|
| Path | `src/payment/payment.module.ts` |
| Jumlah baris | 9 |

```typescript
import { Module } from '@nestjs/common';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';

@Module({
  controllers: [PaymentController],
  providers: [PaymentService],
})
export class PaymentModule {}
```

---

## `src/payment/payment.service.spec.ts` {#src-payment-payment-service-spec-ts}

| Info | Nilai |
|------|-------|
| Path | `src/payment/payment.service.spec.ts` |
| Jumlah baris | 18 |

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { PaymentService } from './payment.service';

describe('PaymentService', () => {
  let service: PaymentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PaymentService],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
```

---

## `src/payment/payment.service.ts` {#src-payment-payment-service-ts}

| Info | Nilai |
|------|-------|
| Path | `src/payment/payment.service.ts` |
| Jumlah baris | 144 |

```typescript
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as midtransClient from 'midtrans-client';

@Injectable()
export class PaymentService {
  private snap: midtransClient.Snap;

  constructor(private prisma: PrismaService) {
    // Inisialisasi Midtrans Snap
    this.snap = new midtransClient.Snap({
      isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
      serverKey: process.env.MIDTRANS_SERVER_KEY!,
      clientKey: process.env.MIDTRANS_CLIENT_KEY!,
    });
  }

  async createSnapToken(transactionId: string) {
    // 1. Ambil data transaksi dari DB
    const transaction = await this.prisma.db.transaction.findUnique({
      where: { id: transactionId },
      include: {
        items: { include: { item: true } },
        patient: true,
      },
    });

    if (!transaction) {
      throw new NotFoundException('Transaksi tidak ditemukan');
    }

    if (transaction.status !== 'PENDING_PAYMENT') {
      throw new BadRequestException(
        `Transaksi tidak bisa dibayar — status saat ini: ${transaction.status}`
      );
    }

    // 2. Siapkan order_id unik untuk Midtrans
    const orderId = `POS-${transaction.id.substring(0, 8)}-${Date.now()}`;

    // 3. Siapkan item_details untuk Midtrans
    const itemDetails = transaction.items.map((ti) => ({
      id: ti.itemId,
      name: ti.item.name,
      price: Math.round(ti.price),
      quantity: ti.quantity,
    }));

    // 4. Siapkan customer_details
    const customerDetails = {
      first_name: transaction.patient?.name ?? 'Pasien',
      phone: transaction.patient?.phone ?? '08000000000',
    };

    // 5. Request snap token ke Midtrans
    const parameter = {
      transaction_details: {
        order_id: orderId,
        gross_amount: Math.round(transaction.total),
      },
      item_details: itemDetails,
      customer_details: customerDetails,
      payment_type_filter: ['qris', 'bank_transfer', 'credit_card'],
    };

    const snapResponse = await this.snap.createTransaction(parameter);

    // 6. Simpan midtransOrderId ke DB buat referensi webhook nanti
    await this.prisma.db.transaction.update({
      where: { id: transactionId },
      data: { midtransOrderId: orderId },
    });

    return {
      message: 'Snap token berhasil dibuat',
      data: {
        transactionId: transaction.id,
        orderId,
        snapToken: snapResponse.token,
        snapRedirectUrl: snapResponse.redirect_url,
        total: transaction.total,
      },
    };
  }

  async handleWebhook(notification: any) {
    const orderId = notification.order_id;
    const transactionStatus = notification.transaction_status;
    const fraudStatus = notification.fraud_status;

    // Cari transaksi berdasarkan midtransOrderId
    const transaction = await this.prisma.db.transaction.findFirst({
      where: { midtransOrderId: orderId },
    });

    if (!transaction) {
      throw new NotFoundException(`Transaksi dengan order_id ${orderId} tidak ditemukan`);
    }

    // Tentukan status berdasarkan notif Midtrans
    let newStatus = transaction.status;

    if (transactionStatus === 'settlement') {
      newStatus = 'LUNAS';
    } else if (transactionStatus === 'capture') {
      newStatus = fraudStatus === 'accept' ? 'LUNAS' : 'CANCELLED';
    } else if (['cancel', 'deny', 'expire'].includes(transactionStatus)) {
      newStatus = 'CANCELLED';
    }

    // Update status di DB
    await this.prisma.db.transaction.update({
      where: { id: transaction.id },
      data: { status: newStatus as any },
    });

    console.log(`✅ Webhook: Order ${orderId} → status ${newStatus}`);

    return { message: 'Webhook berhasil diproses', status: newStatus };
  }

  async getTransactionStatus(transactionId: string) {
    const transaction = await this.prisma.db.transaction.findUnique({
      where: { id: transactionId },
      include: {
        items: { include: { item: true } },
        patient: true,
      },
    });

    if (!transaction) throw new NotFoundException('Transaksi tidak ditemukan');

    return {
      message: 'Status transaksi',
      data: {
        id: transaction.id,
        status: transaction.status,
        total: transaction.total,
        paymentMethod: transaction.paymentMethod,
        midtransOrderId: transaction.midtransOrderId,
      },
    };
  }
}
```

---

## `src/prisma/prisma.module.ts` {#src-prisma-prisma-module-ts}

| Info | Nilai |
|------|-------|
| Path | `src/prisma/prisma.module.ts` |
| Jumlah baris | 9 |

```typescript
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

---

## `src/prisma/prisma.service.spec.ts` {#src-prisma-prisma-service-spec-ts}

| Info | Nilai |
|------|-------|
| Path | `src/prisma/prisma.service.spec.ts` |
| Jumlah baris | 18 |

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  let service: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PrismaService],
    }).compile();

    service = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
```

---

## `src/prisma/prisma.service.ts` {#src-prisma-prisma-service-ts}

| Info | Nilai |
|------|-------|
| Path | `src/prisma/prisma.service.ts` |
| Jumlah baris | 31 |

```typescript
import 'dotenv/config';
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private client: PrismaClient;

  constructor() {
    const connectionString = process.env.DATABASE_URL!;
    // Debug — hapus setelah fix
    console.log('Connecting to:', connectionString);

    const adapter = new PrismaPg({ connectionString });

    this.client = new PrismaClient({ adapter } as any);
  }

  get db(): PrismaClient {
    return this.client;
  }

  async onModuleInit() {
    await this.client.$connect();
  }

  async onModuleDestroy() {
    await this.client.$disconnect();
  }
}
```

---

