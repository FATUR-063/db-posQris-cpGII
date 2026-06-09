import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { PatientsService } from './patients.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Patients')
@Controller('patients')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Post()
  @Roles('SUPER_ADMIN', 'MANAGER', 'KASIR')
  @ApiOperation({
    summary: 'Daftarkan pasien baru',
    description:
      'Nomor rekam medis di-generate otomatis (format: RM-YYYYMM-XXXX). ' +
      'NIK dan noBpjs opsional — bisa dilengkapi nanti.',
  })
  create(@Body() dto: CreatePatientDto) {
    return this.patientsService.create(dto);
  }

  @Get()
  @Roles('SUPER_ADMIN', 'MANAGER', 'KASIR', 'FINANCE_STAFF')
  @ApiOperation({
    summary: 'Cari & list semua pasien aktif',
    description:
      'Mendukung pencarian by nama, no. RM, NIK, atau telepon. ' +
      'Hasil bisa difilter berdasarkan tipe penjaminan.',
  })
  @ApiQuery({ name: 'search', required: false, example: 'Budi', description: 'Cari nama/noRM/NIK/telp' })
  @ApiQuery({ name: 'insuranceType', required: false, enum: ['UMUM', 'BPJS', 'VOUCHER'] })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  findAll(
    @Query('search') search?: string,
    @Query('insuranceType') insuranceType?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.patientsService.findAll({
      search,
      insuranceType,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'MANAGER', 'KASIR', 'FINANCE_STAFF')
  @ApiOperation({ summary: 'Detail pasien by ID' })
  findOne(@Param('id') id: string) {
    return this.patientsService.findOne(id);
  }

  @Put(':id')
  @Roles('SUPER_ADMIN', 'MANAGER', 'KASIR')
  @ApiOperation({
    summary: 'Update data pasien',
    description: 'Hanya field yang dikirim yang akan diupdate (partial update).',
  })
  update(@Param('id') id: string, @Body() dto: UpdatePatientDto) {
    return this.patientsService.update(id, dto);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'MANAGER')
  @ApiOperation({
    summary: 'Arsipkan pasien (soft delete)',
    description: 'Pasien tidak dihapus permanen, hanya dinonaktifkan.',
  })
  remove(@Param('id') id: string) {
    return this.patientsService.remove(id);
  }
}
