import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';

@Injectable()
export class PatientsService {
  constructor(private prisma: PrismaService) {}

  // ─── CREATE ─────────────────────────────────────────────

  async create(dto: CreatePatientDto) {
    // Cek NIK duplikat jika diisi
    if (dto.nik) {
      const existingNik = await this.prisma.db.patient.findUnique({
        where: { nik: dto.nik },
      });
      if (existingNik) throw new ConflictException('NIK sudah terdaftar');
    }

    // Auto-generate nomor rekam medis: RM-YYYYMM-XXXX
    const medicalRecordNo = await this.generateMedicalRecordNo();

    const patient = await this.prisma.db.patient.create({
      data: {
        name: dto.name,
        medicalRecordNo,
        phone: dto.phone,
        nik: dto.nik,
        address: dto.address,
        jenisKelamin: dto.jenisKelamin,
        noBpjs: dto.noBpjs,
        insuranceType: dto.insuranceType ?? 'UMUM',
      },
    });

    return {
      message: 'Pasien berhasil didaftarkan',
      patient,
    };
  }

  // ─── FIND ALL + SEARCH ──────────────────────────────────

  async findAll(query: {
    search?: string;
    insuranceType?: string;
    page?: number;
    limit?: number;
  }) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = { isActive: true };

    // Search by nama, noRM, atau NIK
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { medicalRecordNo: { contains: query.search, mode: 'insensitive' } },
        { nik: { contains: query.search } },
        { phone: { contains: query.search } },
      ];
    }

    if (query.insuranceType) {
      where.insuranceType = query.insuranceType;
    }

    const [patients, total] = await Promise.all([
      this.prisma.db.patient.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.db.patient.count({ where }),
    ]);

    return {
      data: patients,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ─── FIND ONE ───────────────────────────────────────────

  async findOne(id: string) {
    const patient = await this.prisma.db.patient.findUnique({
      where: { id },
    });

    if (!patient || !patient.isActive) {
      throw new NotFoundException('Pasien tidak ditemukan');
    }

    return { patient };
  }

  // ─── UPDATE ─────────────────────────────────────────────

  async update(id: string, dto: UpdatePatientDto) {
    // Pastikan pasien ada
    await this.findOne(id);

    // Cek NIK duplikat jika diupdate
    if (dto.nik) {
      const existingNik = await this.prisma.db.patient.findUnique({
        where: { nik: dto.nik },
      });
      if (existingNik && existingNik.id !== id) {
        throw new ConflictException('NIK sudah terdaftar oleh pasien lain');
      }
    }

    const patient = await this.prisma.db.patient.update({
      where: { id },
      data: dto,
    });

    return {
      message: 'Data pasien berhasil diperbarui',
      patient,
    };
  }

  // ─── SOFT DELETE ────────────────────────────────────────

  async remove(id: string) {
    await this.findOne(id);

    await this.prisma.db.patient.update({
      where: { id },
      data: { isActive: false },
    });

    return { message: 'Pasien berhasil diarsipkan' };
  }

  // ─── HELPER: Auto-generate No. RM ──────────────────────

  private async generateMedicalRecordNo(): Promise<string> {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prefix = `RM-${yearMonth}-`;

    // Cari nomor terakhir bulan ini
    const last = await this.prisma.db.patient.findFirst({
      where: { medicalRecordNo: { startsWith: prefix } },
      orderBy: { medicalRecordNo: 'desc' },
    });

    let sequence = 1;
    if (last) {
      const lastNum = parseInt(last.medicalRecordNo.replace(prefix, ''), 10);
      sequence = lastNum + 1;
    }

    return `${prefix}${String(sequence).padStart(4, '0')}`;
  }
}
