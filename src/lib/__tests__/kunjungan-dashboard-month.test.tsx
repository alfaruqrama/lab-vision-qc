import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// recharts memakai ResizeObserver, tidak tersedia di jsdom.
class ResizeObserverPolyfill {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverPolyfill;

// Mock data + hooks supaya dashboard bisa dirender tanpa Supabase/GAS.
vi.mock('@/hooks/use-kunjungan-data', () => ({
  useKunjunganData: () => ({
    data: {
      // Omzet punya dua bulan; GAS bilang OKTOBER (yang punya rows).
      omzet: {
        OKTOBER: [{ d: 1, total: 100, target: 90, pct: 110 }],
        AGUSTUS: [{ d: 1, total: 50, target: 40, pct: 125 }],
      },
      // Kunjungan & MCU hanya punya AGUSTUS, jadi default tab itu AGUSTUS.
      kunjungan: { AGUSTUS: [{ d: 1, total: 10, target: 9, pct: 111 }] },
      mcu: { AGUSTUS: [{ d: 1, omzet: 5 }] },
    },
    status: 'live',
    lastUpdated: '2026-11-13T00:00:00.000Z',
    currentMonth: 'OKTOBER',
    error: null,
    refresh: vi.fn(),
    availableMonths: (tab: string) =>
      tab === 'mcu' ? ['AGUSTUS'] : tab === 'kunjungan' ? ['AGUSTUS'] : ['AGUSTUS', 'OKTOBER'],
    kumulatif: null,
  }),
}));

vi.mock('@/hooks/use-auth', () => ({ useAuth: () => ({ canAccess: () => false }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn() } }));

// Tab Laporan/Input menarik Supabase + xlsx di level modul; mock agar test
// dashboard tidak butuh env var.
vi.mock('@/components/kunjungan/LaporanTab', () => ({ default: () => <div>Laporan</div> }));
vi.mock('@/components/kunjungan/InputHarianTab', () => ({ default: () => <div>Input</div> }));

import KunjunganDashboard from '@/pages/KunjunganDashboard';

function renderDashboard() {
  return render(
    <MemoryRouter>
      <KunjunganDashboard />
    </MemoryRouter>
  );
}

function monthSelect() {
  return screen.getByRole('combobox') as HTMLSelectElement;
}

describe('pemilihan bulan per tab', () => {
  it('tab Omzet membuka bulan dari GAS saat bulan itu berisi data', async () => {
    renderDashboard();
    await waitFor(() => {
      expect(monthSelect().value).toBe('OKTOBER');
    });
  });

  it('tab Kunjungan memakai default sendiri, bukan bulan yang dipilih user di tab Omzet', async () => {
    renderDashboard();
    await waitFor(() => {
      expect(monthSelect().value).toBe('OKTOBER');
    });

    // User menyentuh tab Omzet (pilih OKTOBER secara eksplisit).
    fireEvent.change(monthSelect(), { target: { value: 'OKTOBER' } });

    fireEvent.click(screen.getByText('Kunjungan'));

    // Kunjungan hanya punya AGUSTUS; bulan tab itu harus AGUSTUS.
    await waitFor(() => {
      expect(monthSelect().value).toBe('AGUSTUS');
    });
    // Isi tab harus sesuai bulan itu — bukan kosong karena bulan Omzet.
    expect(screen.getByText(/Total Kunjungan AGUSTUS/)).toBeInTheDocument();
    expect(screen.queryByText(/Belum ada data kunjungan/)).not.toBeInTheDocument();
  });

  it('tab MCU memakai default sendiri walau tab lain sudah disentuh', async () => {
    renderDashboard();
    await waitFor(() => {
      expect(monthSelect().value).toBe('OKTOBER');
    });

    fireEvent.change(monthSelect(), { target: { value: 'OKTOBER' } });
    fireEvent.click(screen.getByText('Omzet MCU'));

    await waitFor(() => {
      expect(monthSelect().value).toBe('AGUSTUS');
    });
  });

  it('pilihan user di tab Omzet tetap utuh setelah pindah tab', async () => {
    renderDashboard();
    await waitFor(() => {
      expect(monthSelect().value).toBe('OKTOBER');
    });

    fireEvent.change(monthSelect(), { target: { value: 'AGUSTUS' } });
    expect(monthSelect().value).toBe('AGUSTUS');

    fireEvent.click(screen.getByText('Kunjungan'));
    await waitFor(() => {
      expect(monthSelect().value).toBe('AGUSTUS');
    });

    fireEvent.click(screen.getByText('Omzet'));
    await waitFor(() => {
      expect(monthSelect().value).toBe('AGUSTUS');
    });
  });
});
