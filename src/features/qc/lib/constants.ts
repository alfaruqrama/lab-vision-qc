import type { InstrumentType } from '@/lib/types';
import { FlaskConical, Droplets, Syringe, TestTube } from 'lucide-react';

/** Human-readable instrument labels */
export const INSTRUMENT_LABELS: Record<InstrumentType, string> = {
  CA660: 'Sysmex CA-660',
  EASYLITE: 'Easylite',
  ONCALL1: 'On Call Sure 1',
  ONCALL2: 'On Call Sure 2',
};

/** Short descriptions per instrument */
export const INSTRUMENT_DESCRIPTIONS: Record<InstrumentType, string> = {
  CA660: 'Koagulasi — PT, APTT, INR',
  EASYLITE: 'Elektrolit — Na⁺, K⁺, Cl⁻',
  ONCALL1: 'Gula Darah Strip — GDA',
  ONCALL2: 'Gula Darah Strip — GDA',
};

/** Control level count per instrument */
export const INSTRUMENT_LEVEL_INFO: Record<InstrumentType, string> = {
  CA660: '1 level kontrol',
  EASYLITE: '2 level kontrol (Normal & High)',
  ONCALL1: '3 level kontrol (CTRL 0, 1, 2)',
  ONCALL2: '3 level kontrol (CTRL 0, 1, 2)',
};

/** Icon component per instrument */
export const INSTRUMENT_ICONS: Record<InstrumentType, typeof FlaskConical> = {
  CA660: FlaskConical,
  EASYLITE: Droplets,
  ONCALL1: Syringe,
  ONCALL2: TestTube,
};

/** Instrument accent colors for cards */
export const INSTRUMENT_COLORS: Record<InstrumentType, { bg: string; text: string; border: string }> = {
  CA660: { bg: 'bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-500/20' },
  EASYLITE: { bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-500/20' },
  ONCALL1: { bg: 'bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-500/20' },
  ONCALL2: { bg: 'bg-purple-500/10', text: 'text-purple-600 dark:text-purple-400', border: 'border-purple-500/20' },
};
