import { describe, it, expect } from 'vitest';
import { canModifyRecords, type UserRole } from '../auth-types';

describe('canModifyRecords', () => {
  it('mengizinkan admin, petugas, dan developer', () => {
    expect(canModifyRecords('admin')).toBe(true);
    expect(canModifyRecords('petugas')).toBe(true);
    expect(canModifyRecords('developer')).toBe(true);
  });

  it('menolak viewer (hanya baca)', () => {
    expect(canModifyRecords('viewer')).toBe(false);
  });

  it('menolak role yang tidak diketahui / kosong', () => {
    expect(canModifyRecords(undefined)).toBe(false);
    expect(canModifyRecords(null)).toBe(false);
    expect(canModifyRecords('' as UserRole)).toBe(false);
    expect(canModifyRecords('tamu' as UserRole)).toBe(false);
  });
});
