import { describe, it, expect } from 'vitest';
import {
  buildRow,
  columnLetter,
  SHEET_HEADERS,
  type SheetRowInput,
} from '../../../../supabase/functions/upload-transfusi/sheets';

function makeInput(overrides: Partial<SheetRowInput> = {}): SheetRowInput {
  return {
    createdAt: '2026-10-01T10:00:00.000Z',
    patientName: 'Budi Santoso',
    medicalRecordNumber: 'RM-12345',
    requestDate: '2026-10-01',
    bloodProductLabel: 'PRC (Packed Red Cells)',
    bagCount: 2,
    bloodTypeRh: 'O+',
    bagNumber: 'BAG-001, BAG-002',
    originLabel: 'Gresik',
    informConcern: true,
    suratPermintaan: true,
    formReaksi: false,
    notes: 'Pasien stabil',
    petugas: 'Rina',
    statusPdf: 'Tersimpan di Drive',
    driveUrl: 'https://drive.google.com/file/d/abc/view',
    ...overrides,
  };
}

describe('SHEET_HEADERS', () => {
  it('memuat 16 kolom sesuai rencana', () => {
    expect(SHEET_HEADERS).toHaveLength(16);
  });

  it('nilai unik (tidak ada kolom ganda)', () => {
    expect(new Set(SHEET_HEADERS).size).toBe(SHEET_HEADERS.length);
  });
});

describe('buildRow', () => {
  it('menghasilkan jumlah kolom yang sama dengan header', () => {
    expect(buildRow(makeInput())).toHaveLength(SHEET_HEADERS.length);
  });

  it('menaruh nilai pada urutan yang benar', () => {
    const row = buildRow(makeInput());
    expect(row[1]).toBe('Budi Santoso');
    expect(row[2]).toBe('RM-12345');
    expect(row[3]).toBe('2026-10-01');
    expect(row[4]).toBe('PRC (Packed Red Cells)');
    expect(row[5]).toBe('2');
    expect(row[6]).toBe('O+');
    expect(row[8]).toBe('Gresik');
    expect(row[13]).toBe('Rina');
    expect(row[15]).toBe('https://drive.google.com/file/d/abc/view');
  });

  it('menandai checklist hadir dengan ✓ dan tidak hadir dengan —', () => {
    const row = buildRow(makeInput());
    expect(row[9]).toBe('✓'); // informConcern
    expect(row[10]).toBe('✓'); // suratPermintaan
    expect(row[11]).toBe('—'); // formReaksi = false
  });

  it('mengubah bagCount jadi string', () => {
    const row = buildRow(makeInput({ bagCount: 5 }));
    expect(row[5]).toBe('5');
  });

  it('menangani field teks kosong tanpa error', () => {
    const row = buildRow(
      makeInput({ notes: '', bagNumber: '', bloodTypeRh: '', originLabel: '' }),
    );
    expect(row[7]).toBe('');
    expect(row[8]).toBe('');
    expect(row[12]).toBe('');
  });
});

describe('columnLetter', () => {
  it('mengubah 1..26 jadi A..Z', () => {
    expect(columnLetter(1)).toBe('A');
    expect(columnLetter(16)).toBe('P');
    expect(columnLetter(26)).toBe('Z');
  });

  it('menangani lebih dari 26 kolom', () => {
    expect(columnLetter(27)).toBe('AA');
    expect(columnLetter(28)).toBe('AB');
    expect(columnLetter(52)).toBe('AZ');
    expect(columnLetter(53)).toBe('BA');
  });
});
