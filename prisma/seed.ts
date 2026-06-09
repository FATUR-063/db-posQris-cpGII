import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

const connectionString = process.env.DATABASE_URL!;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  console.log('🌱 Seeding database...\n');

  // ─── 1. USERS (1 per role) ──────────────────────────────

  const defaultPassword = await bcrypt.hash('password123', 12);

  const users = [
    { name: 'Super Admin',    email: 'admin@klinik.com',    role: 'SUPER_ADMIN' as const },
    { name: 'Manager Klinik', email: 'manager@klinik.com',  role: 'MANAGER' as const },
    { name: 'Kasir Satu',     email: 'kasir@klinik.com',    role: 'KASIR' as const },
    { name: 'Staff Finance',  email: 'finance@klinik.com',  role: 'FINANCE_STAFF' as const },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role },
      create: { name: u.name, email: u.email, password: defaultPassword, role: u.role },
    });
    console.log(`  ✅ User: ${u.email} (${u.role})`);
  }

  // ─── 2. ITEMS (3 obat + 2 layanan) ─────────────────────

  const items = [
    { name: 'Paracetamol 500mg',  type: 'OBAT' as const,    price: 5000,    unit: 'tablet' },
    { name: 'Amoxicillin 500mg',  type: 'OBAT' as const,    price: 8000,    unit: 'kapsul' },
    { name: 'Vitamin C 1000mg',   type: 'OBAT' as const,    price: 15000,   unit: 'tablet' },
    { name: 'Konsultasi Dokter',  type: 'LAYANAN' as const, price: 100000,  unit: 'kunjungan' },
    { name: 'Tindakan Nebulizer', type: 'LAYANAN' as const, price: 75000,   unit: 'tindakan' },
  ];

  for (const item of items) {
    const existing = await prisma.item.findFirst({ where: { name: item.name } });
    if (!existing) {
      await prisma.item.create({ data: item });
      console.log(`  ✅ Item: ${item.name} — Rp ${item.price.toLocaleString('id-ID')}`);
    } else {
      console.log(`  ⏭️  Item: ${item.name} (sudah ada)`);
    }
  }

  // ─── 3. PATIENTS (1 BPJS + 2 UMUM) ────────────────────

  const patients = [
    {
      name: 'Budi Santoso',
      medicalRecordNo: 'RM-202606-0001',
      phone: '08123456789',
      nik: '3404010101900001',
      jenisKelamin: 'LAKI_LAKI' as const,
      noBpjs: '0001234567890',
      insuranceType: 'BPJS' as const,
      address: 'Jl. Merdeka No. 10, Jakarta Pusat',
    },
    {
      name: 'Siti Rahmawati',
      medicalRecordNo: 'RM-202606-0002',
      phone: '08198765432',
      nik: '3404010201950002',
      jenisKelamin: 'PEREMPUAN' as const,
      insuranceType: 'UMUM' as const,
      address: 'Jl. Sudirman No. 25, Jakarta Selatan',
    },
    {
      name: 'Ahmad Kurniawan',
      medicalRecordNo: 'RM-202606-0003',
      phone: '08567891234',
      nik: '3404010301880003',
      jenisKelamin: 'LAKI_LAKI' as const,
      insuranceType: 'UMUM' as const,
      address: 'Jl. Gatot Subroto No. 5, Bandung',
    },
  ];

  for (const p of patients) {
    await prisma.patient.upsert({
      where: { medicalRecordNo: p.medicalRecordNo },
      update: { name: p.name, phone: p.phone, insuranceType: p.insuranceType },
      create: p,
    });
    console.log(`  ✅ Pasien: ${p.name} (${p.medicalRecordNo}) — ${p.insuranceType}`);
  }

  // ─── 4. CHART OF ACCOUNTS (COA) ────────────────────────

  const accounts = [
    // Aset
    { code: '1100', name: 'Kas',               type: 'ASSET' as const,    normalBalance: 'DEBIT' as const,  description: 'Kas tunai klinik' },
    { code: '1200', name: 'Bank',              type: 'ASSET' as const,    normalBalance: 'DEBIT' as const,  description: 'Rekening bank klinik' },
    { code: '1300', name: 'Piutang BPJS',      type: 'ASSET' as const,    normalBalance: 'DEBIT' as const,  description: 'Tagihan ke BPJS' },
    { code: '1400', name: 'Piutang Pasien',    type: 'ASSET' as const,    normalBalance: 'DEBIT' as const,  description: 'Outstanding invoice pasien' },

    // Kewajiban
    { code: '2100', name: 'Hutang Supplier',   type: 'LIABILITY' as const, normalBalance: 'CREDIT' as const, description: 'Hutang pembelian obat ke supplier' },

    // Modal
    { code: '3100', name: 'Modal Pemilik',     type: 'EQUITY' as const,   normalBalance: 'CREDIT' as const, description: 'Modal awal klinik' },

    // Pendapatan
    { code: '4100', name: 'Pendapatan Jasa',   type: 'REVENUE' as const,  normalBalance: 'CREDIT' as const, description: 'Pendapatan dari layanan medis' },
    { code: '4200', name: 'Pendapatan Obat',   type: 'REVENUE' as const,  normalBalance: 'CREDIT' as const, description: 'Pendapatan dari penjualan obat' },

    // Beban
    { code: '5100', name: 'Beban Gaji',        type: 'EXPENSE' as const,  normalBalance: 'DEBIT' as const,  description: 'Gaji karyawan & dokter' },
    { code: '5200', name: 'Beban Obat',        type: 'EXPENSE' as const,  normalBalance: 'DEBIT' as const,  description: 'HPP pembelian obat' },
    { code: '5300', name: 'Beban Operasional', type: 'EXPENSE' as const,  normalBalance: 'DEBIT' as const,  description: 'Listrik, air, internet, dll' },
    { code: '5400', name: 'Beban Perawatan',   type: 'EXPENSE' as const,  normalBalance: 'DEBIT' as const,  description: 'Maintenance peralatan' },
    { code: '5500', name: 'Beban Lain-lain',   type: 'EXPENSE' as const,  normalBalance: 'DEBIT' as const,  description: 'Pengeluaran lainnya' },
  ];

  for (const acc of accounts) {
    await prisma.chartOfAccount.upsert({
      where: { code: acc.code },
      update: { name: acc.name, description: acc.description },
      create: acc,
    });
    console.log(`  ✅ COA: ${acc.code} — ${acc.name}`);
  }

  console.log('\n✅ Seed selesai!\n');
  console.log('📋 Login credentials (semua password: password123):');
  console.log('   admin@klinik.com    → SUPER_ADMIN');
  console.log('   manager@klinik.com  → MANAGER');
  console.log('   kasir@klinik.com    → KASIR');
  console.log('   finance@klinik.com  → FINANCE_STAFF\n');
}

main()
  .catch((e) => {
    console.error('❌ Seed gagal:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
