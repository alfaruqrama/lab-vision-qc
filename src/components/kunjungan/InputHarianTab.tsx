import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { Plus, Trash2, Send, RotateCcw, Save, Download, Settings, X, Search, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import * as XLSX from 'xlsx';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PenjaminEntry { nama: string; badge: string; }

export interface KunjunganInputRow {
  id: string;
  namaPenjamin: string;
  badge: string;
  rjYani: number; riYani: number; igd: number; mcuAuto: number;
  promo: number; dokter: number; exc: number; prior: number;
  grhuRj: number; grhuRi: number; sat: number; ppk1: number;
  total: number;
}

export interface McuInputRow {
  id: string;
  namaPenjamin: string; // linked to tabel utama by name
  paket: string;
  peserta: number; nominal: number; total: number;
}

export interface InputHarianDraft {
  tanggal: string;
  kunjungan: KunjunganInputRow[];
  mcu: McuInputRow[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DRAFT_KEY    = 'input-harian-draft';
const PENJAMIN_KEY = 'penjamin-list-custom';

export const KUNJUNGAN_COLS: { k: string; l: string; readOnly?: boolean }[] = [
  { k: 'rjYani',  l: 'RJ YANI' },
  { k: 'riYani',  l: 'RI YANI' },
  { k: 'igd',     l: 'IGD' },
  { k: 'mcuAuto', l: 'MCU AUTO', readOnly: true },
  { k: 'promo',   l: 'PROMO' },
  { k: 'dokter',  l: 'DOKTER' },
  { k: 'exc',     l: 'EXC' },
  { k: 'prior',   l: 'PRIOR' },
  { k: 'grhuRj',  l: 'GRHU RJ' },
  { k: 'grhuRi',  l: 'GRHU RI' },
  { k: 'sat',     l: 'SAT' },
  { k: 'ppk1',    l: 'PPK1' },
];

export const LABEL_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  'PG':            { bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-300' },
  'BPJS':          { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-300' },
  'BRI LIFE PG':   { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-300' },
  'PROKESPEN':     { bg: 'bg-purple-50',  text: 'text-purple-700',  border: 'border-purple-300' },
  'PROKESPEN BPJS':{ bg: 'bg-cyan-50',    text: 'text-cyan-700',    border: 'border-cyan-300' },
  'JKK':           { bg: 'bg-orange-50',  text: 'text-orange-700',  border: 'border-orange-300' },
  'UMUM':          { bg: 'bg-yellow-50',  text: 'text-yellow-700',  border: 'border-yellow-300' },
  'NPG':           { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-300' },
  'AS':            { bg: 'bg-pink-50',    text: 'text-pink-700',    border: 'border-pink-300' },
};
const ALL_LABELS = Object.keys(LABEL_STYLES);

function labelClass(badge: string) {
  const s = LABEL_STYLES[badge] || LABEL_STYLES['NPG'];
  return `${s.bg} ${s.text} ${s.border}`;
}

// ─── Default penjamin list (built-in, tidak bisa dihapus) ─────────────────────
const BUILTIN_PENJAMIN: PenjaminEntry[] = [
  { nama: 'KARYAWAN PG', badge: 'PG' },
  { nama: 'KELUARGA PG', badge: 'PG' },
  { nama: 'KARYAWAN PG INHEALTH', badge: 'PG' },
  { nama: 'KELUARGA PG INHEALTH', badge: 'PG' },
  { nama: 'BPJS KESEHATAN', badge: 'BPJS' },
  { nama: 'BPJS KESEHATAN - KAPITASI', badge: 'NPG' },
  { nama: 'BPJS NAIK KELAS.', badge: 'BPJS' },
  { nama: 'KARYAWAN PG BRI LIFE', badge: 'BRI LIFE PG' },
  { nama: 'KELUARGA PG BRI LIFE', badge: 'BRI LIFE PG' },
  { nama: 'PROKESPEN MURNI', badge: 'PROKESPEN' },
  { nama: 'PROKESPEN BPJS COB', badge: 'PROKESPEN BPJS' },
  { nama: 'PASIEN UMUM', badge: 'UMUM' },
  { nama: 'MCU UMUM', badge: 'UMUM' },
  { nama: 'GENERAL PATIENT', badge: 'UMUM' },
  { nama: 'BPJS KETENAGAKERJAAN (JKK)', badge: 'JKK' },
  { nama: 'K3PG', badge: 'NPG' },
  { nama: 'COB BPJS KESEHATAN', badge: 'NPG' },
  { nama: 'ADHI KARYA (PERSERO), PT', badge: 'NPG' },
  { nama: 'ADINATA GRAHA SOLUSI, PT', badge: 'NPG' },
  { nama: 'ADIRA DINAMIKA MEDICILIN (ADMEDIKA)', badge: 'AS' },
  { nama: 'ADMEDIKA - INHEALTH MANDIRI', badge: 'AS' },
  { nama: 'AIA ADMEDIKA', badge: 'AS' },
  { nama: 'AIA FINANCIAL', badge: 'AS' },
  { nama: 'AJ INHEALTH', badge: 'AS' },
  { nama: 'AKSES TELKO MEDIKA (PT TELKOM AKSES)', badge: 'NPG' },
  { nama: 'ANEKA JASA GRHADIKA, PT', badge: 'NPG' },
  { nama: 'APLIKANUSA LINTASARTA, PT', badge: 'NPG' },
  { nama: 'ASURANSI ACA (ADMEDIKA)', badge: 'AS' },
  { nama: 'ASURANSI ADIRA MEDICILLIN - JSMART', badge: 'AS' },
  { nama: 'ASURANSI ADMEDIKA', badge: 'AS' },
  { nama: 'ASURANSI ALLIANZ ADMEDIKA', badge: 'AS' },
  { nama: 'ASURANSI ASTRA BUANA, PT', badge: 'AS' },
  { nama: 'ASURANSI AXA INDONESIA (ADMEDIKA), PT', badge: 'AS' },
  { nama: 'ASURANSI BRI LIFE, PT', badge: 'AS' },
  { nama: 'ASURANSI GARDA MEDIKA (ADMEDIKA)', badge: 'AS' },
  { nama: 'ASURANSI INHEALTH (ADMEDIKA)', badge: 'AS' },
  { nama: 'ASURANSI JIWA MANULIFE INDONESIA, PT (ADMEDIKA)', badge: 'AS' },
  { nama: 'ASURANSI MEGA LIFE', badge: 'AS' },
  { nama: 'ASURANSI RAMAYANA', badge: 'AS' },
  { nama: 'ASURANSI SINAR MAS, PT (ADMEDIKA)', badge: 'AS' },
  { nama: 'ASURANSI TAKAFUL KELUARGA, PT', badge: 'AS' },
  { nama: 'AVRIST ADMEDIKA', badge: 'AS' },
  { nama: 'AXA INSURANCE INDONESIA, PT', badge: 'AS' },
  { nama: 'AXA MANDIRI (ADMEDIKA)', badge: 'AS' },
  { nama: 'BANK RAKYAT INDONESIA', badge: 'NPG' },
  { nama: 'BANK TABUNGAN NEGARA (BTN)', badge: 'NPG' },
  { nama: 'BNI LIFE INSURANCE, PT', badge: 'AS' },
  { nama: 'CARGILL INDONESIA, PT', badge: 'NPG' },
  { nama: 'CEMINDO GEMILANG', badge: 'NPG' },
  { nama: 'CIGNA INDONESIA, PT (ADMEDIKA)', badge: 'AS' },
  { nama: 'DPB PETROKIMIA KAYAKU', badge: 'NPG' },
  { nama: 'EQUITY LIFE INDONESIA, PT', badge: 'AS' },
  { nama: 'FWD LIFE INDONESIA', badge: 'AS' },
  { nama: 'GENERALI INDONESIA LIFE (ADMEDIKA)', badge: 'AS' },
  { nama: 'GRAHA SARANA GRESIK, PT', badge: 'NPG' },
  { nama: 'HM. SAMPOERNA, PT', badge: 'NPG' },
  { nama: 'HIKARI TEKNOLOGI INDONESIA', badge: 'AS' },
  { nama: 'INHEALTH INDEMITY', badge: 'AS' },
  { nama: 'JASA RAHARJA, PT', badge: 'NPG' },
  { nama: 'JASINDO HEALTHCARE', badge: 'AS' },
  { nama: 'JINDAL STAINLES INDONESIA, PT', badge: 'NPG' },
  { nama: 'KOPERASI WARGA SEMEN GRESIK (KWSG)', badge: 'NPG' },
  { nama: 'KRAKATAU MEDIKA, PT', badge: 'NPG' },
  { nama: 'LIPPO LIFE ASSURANCE, PT (MEDITAP)', badge: 'AS' },
  { nama: 'MANDIRI INHEALTH OWLEXA', badge: 'AS' },
  { nama: 'MEGA INSURANCE (Fullerton)', badge: 'AS' },
  { nama: 'NIPSEA PAINT AND CHEMICALS (NIPPON PAINT), PT', badge: 'NPG' },
  { nama: 'PANGANSARI UTAMA, PT', badge: 'NPG' },
  { nama: 'PBV PETROKIMIA GRESIK', badge: 'NPG' },
  { nama: 'PELINDO, PT', badge: 'NPG' },
  { nama: 'PERTAMINA, PT', badge: 'NPG' },
  { nama: 'PETRO GRAHA MEDIKA (RSPG)(PGM), PT', badge: 'NPG' },
  { nama: 'PETRO JORDAN ABADI, PT', badge: 'NPG' },
  { nama: 'PETROKIMIA GRESIK, PT', badge: 'NPG' },
  { nama: 'PETROKIMIA KAYAKU, PT', badge: 'NPG' },
  { nama: 'PETRONIKA, PT', badge: 'NPG' },
  { nama: 'PETROSIDA, PT', badge: 'NPG' },
  { nama: 'PJB UNIT PEMBANGKITAN GRESIK, PT', badge: 'NPG' },
  { nama: 'PLN NUSANTARA, PT', badge: 'NPG' },
  { nama: 'PT INDOSPRING TBK', badge: 'NPG' },
  { nama: 'PT KNAUF GYPSUM INDONESIA', badge: 'NPG' },
  { nama: 'PT PAMAPERSADA NUSANTARA', badge: 'NPG' },
  { nama: 'PT PUPUK INDONESIA', badge: 'NPG' },
  { nama: 'PT WIJAYA KARYA Tbk (WIKA)', badge: 'NPG' },
  { nama: 'SMELTING, PT', badge: 'NPG' },
  { nama: 'SOLVAY MANYAR, PT', badge: 'NPG' },
  { nama: 'SUNDAY INSURANCE', badge: 'AS' },
  { nama: 'HANWHA LIFE', badge: 'AS' },
  { nama: 'MNC LIFE', badge: 'AS' },
  { nama: 'OONA INSURANCE', badge: 'AS' },
  { nama: 'NAYAKA', badge: 'AS' },
  { nama: 'WILMAR NABATI INDONESIA, PT', badge: 'NPG' },
  { nama: 'XINYI GLASS INDONESIA, PT', badge: 'NPG' },
  { nama: 'YAYASAN KESEHATAN PERTAMINA', badge: 'NPG' },
  { nama: 'YAYASAN PETROKIMIA GRESIK', badge: 'NPG' },
  { nama: 'ANTIGEN MCU', badge: 'UMUM' },
  { nama: 'ANTIGEN PASIEN', badge: 'UMUM' },
  { nama: 'MCU CALON JAMAAH HAJI', badge: 'UMUM' },
  { nama: 'PAKET MINI MCU (UMUM)', badge: 'UMUM' },
  { nama: 'PAKET MERAH PUTIH (UMUM)', badge: 'UMUM' },
  { nama: 'PAKET PAHLAWAN (UMUM)', badge: 'UMUM' },
  { nama: 'PAKET SEGAR BUGAR', badge: 'UMUM' },
  { nama: 'PAKET SEHAT BUGAR', badge: 'UMUM' },
  { nama: 'PAKET NARKOBA (UMUM)', badge: 'UMUM' },
  { nama: 'PAKET BASIC PEKERJA (UMUM)', badge: 'UMUM' },
  // ─── PG (tambahan) ────────────────────────────────────────────────────────
  { nama: 'CALON KARYAWAN PT PGM',                             badge: 'PG' },
  { nama: 'ANTIGEN PG',                                        badge: 'PG' },
  { nama: 'KOPERASI KONSUMEN KLG PG (K3PG)',                   badge: 'PG' },
  // ─── AS — Asuransi (tambahan) ─────────────────────────────────────────────
  { nama: 'ADMEDIKA HEALTHCARE SOLUTION',                      badge: 'AS' },
  { nama: 'ASTRA AVIVA LIFE, PT',                              badge: 'AS' },
  { nama: 'ASURANSI ADMEDIKA ( PT. BANK CENTRAL ASIA)',        badge: 'AS' },
  { nama: 'ASURANSI AJ SEQUIS LIFE',                           badge: 'AS' },
  { nama: 'ASURANSI BINA DANA ARTHA, PT',                      badge: 'AS' },
  { nama: 'ASURANSI BUMIDA (ADMEDIKA)',                        badge: 'AS' },
  { nama: 'ASURANSI CAKRAWALA PROTEKSI, PT (ADMEDIKA)',        badge: 'AS' },
  { nama: 'ASURANSI INTRA ASIA (ADMEDIKA)',                    badge: 'AS' },
  { nama: 'ASURANSI JIWA RECAPITAL, PT (ADMEDIKA)',            badge: 'AS' },
  { nama: 'ASURANSI JMA SYARIAH (ADMEDIKA)',                   badge: 'AS' },
  { nama: 'ASURANSI KSK INSURANCE INDONESIA',                  badge: 'AS' },
  { nama: 'ASURANSI MEGA HEALTH, PT (ADMEDIKA)',               badge: 'AS' },
  { nama: 'ASURANSI RAMA (ADMEDIKA)',                          badge: 'AS' },
  { nama: 'ASURANSI TAKAFUL KELUARGA (ADMEDIKA)',              badge: 'AS' },
  { nama: 'ASURANSI TIRTA MEDICAL CENTER',                     badge: 'AS' },
  { nama: 'BNI LIFE INSURANCE (ADMEDIKA)',                     badge: 'AS' },
  { nama: 'BNI LIFE SYARIAH (ADMEDIKA)',                       badge: 'AS' },
  { nama: 'BNI LIFE TELKOMSEL (ADMEDIKA)',                     badge: 'AS' },
  { nama: 'PARAGON TECHNOLOGY AND INOVATION(ADMEDIKA), PT',   badge: 'AS' },
  { nama: 'CAR LIFE INSURANCE (ADMEDIKA)',                     badge: 'AS' },
  { nama: 'EQUITY LIFE INDONESIA, PT (ADMEDIKA)',              badge: 'AS' },
  { nama: 'GLOBAL ASST. & HEALTHCARE, PT',                     badge: 'AS' },
  { nama: 'GREAT EASTERN (ADMEDIKA)',                          badge: 'AS' },
  { nama: 'HANWHA LIFE (ADMEDIKA)',                            badge: 'AS' },
  { nama: 'INTERNASIONAL SOS (ASIH EKA ABADI, PT) (ISOS)',    badge: 'AS' },
  { nama: 'INTERNATIONAL PACIFIC CROSS (ADMEDIKA)',            badge: 'AS' },
  { nama: 'MAGNA SEHAT ADMEDIKA',                              badge: 'AS' },
  { nama: 'PERTAMINA (ADMEDIKA)',                              badge: 'AS' },
  { nama: 'PERTAMINA LUBRICANTS, PT (ADMEDIKA)',               badge: 'AS' },
  { nama: 'PT MNC LIFE ASSURANCE',                             badge: 'AS' },
  { nama: 'PT NAYAKA ERA HUSADA',                              badge: 'AS' },
  { nama: 'PT PRUDENTIAL LIFE ASSURANCE (ADMEDIKA)',           badge: 'AS' },
  { nama: 'PT. ASURANSI JIWA SINARMAS MSIG (ADMEDIKA)',       badge: 'AS' },
  { nama: 'RELIANCE (ISOMEDIK)',                               badge: 'AS' },
  { nama: 'RELIANCE INSURANCE, PT',                            badge: 'AS' },
  { nama: 'RELIANCE INSURANCE, PT (ADMEDIKA)',                 badge: 'AS' },
  { nama: 'SIMASCARD (ADMEDIKA)',                              badge: 'AS' },
  { nama: 'SOMPO (ADMEDIKA)',                                  badge: 'AS' },
  { nama: 'SINAR MAS, AJ',                                     badge: 'AS' },
  { nama: 'JIWA SEQWES',                                       badge: 'AS' },
  { nama: 'PGN SAKA (ADMEDIKA)',                               badge: 'AS' },
  { nama: 'ACROSS ASIA ASSIST',                                badge: 'AS' },
  { nama: 'ASURANSI JIWA ASTRA',                               badge: 'AS' },
  { nama: 'ASURANSI JIWA MANULIFE',                            badge: 'AS' },
  { nama: 'PT. ZURICH',                                        badge: 'AS' },
  { nama: 'BCA LIFE',                                          badge: 'AS' },
  { nama: 'ADMEDIKA (BCA)',                                    badge: 'AS' },
  { nama: 'CHUBB (ADMEDIKA)',                                  badge: 'AS' },
  { nama: 'ASURANSI CIPUTRA INDONESIA (ADMEDIKA), PT',        badge: 'AS' },
  { nama: 'VALE ADMEDIKA',                                     badge: 'AS' },
  { nama: 'ASURANSI FWD (FULLERTON)',                          badge: 'AS' },
  { nama: 'BOSOWA ASURANSI (ADMEDIKA)',                        badge: 'AS' },
  { nama: 'HARTA GENERAL INSURANCE, PT',                       badge: 'AS' },
  { nama: 'INTERNATIONAL SERVICE PACIFIC CROSS, PT',           badge: 'AS' },
  { nama: 'ADMINISTRASI ADMEDIKA, PT',                         badge: 'AS' },
  { nama: 'PRUDENTIAL SHARIA LIFE ASSURANCE , PT',             badge: 'AS' },
  { nama: 'MSIG LIFE INSURANCE INDONESIA Tbk (ADMEDIKA), PT', badge: 'AS' },
  { nama: 'ASKRIDA (ADMEDIKA)',                                badge: 'AS' },
  { nama: 'OWLEXA',                                            badge: 'AS' },
  { nama: 'HIKARI',                                            badge: 'AS' },
  { nama: 'PLN INSURANCE, PT',                                 badge: 'AS' },
  // ─── UMUM (tambahan) ──────────────────────────────────────────────────────
  { nama: 'PAKET PEJUANG (UMUM)',                              badge: 'UMUM' },
  { nama: 'PAKET PRE MARITAL SILVER',                          badge: 'UMUM' },
  { nama: 'PAKET PRE MARITAL GOLD',                            badge: 'UMUM' },
  { nama: 'VOUCHER FREE MCU',                                  badge: 'UMUM' },
  { nama: 'PAKET SCREENING A (UMUM)',                          badge: 'UMUM' },
  { nama: 'PAKET SCREENING B (UMUM)',                          badge: 'UMUM' },
  { nama: 'PAKET SCREENING C (UMUM)',                          badge: 'UMUM' },
  { nama: 'PAKET SCREENING D (UMUM)',                          badge: 'UMUM' },
  { nama: 'PAKET SCREENING E (UMUM)',                          badge: 'UMUM' },
  { nama: 'PAKET SAHABAT DIABETES (UMUM)',                     badge: 'UMUM' },
  { nama: 'PAKET SAHABAT GINJAL (UMUM)',                       badge: 'UMUM' },
  { nama: 'PAKET SAHABAT HATI (UMUM)',                         badge: 'UMUM' },
  { nama: 'PAKET SAHABAT JANTUNG BASIC (UMUM)',                badge: 'UMUM' },
  { nama: 'PAKET SAHABAT JANTUNG PREM (UMUM)',                 badge: 'UMUM' },
  { nama: 'PAKET MCU SAPI (UMUM)',                             badge: 'UMUM' },
  { nama: 'PROMO PETRONITE',                                   badge: 'UMUM' },
  { nama: 'PAKET PUTIH (UMUM)',                                badge: 'UMUM' },
  { nama: 'PAKET MERAH (UMUM)',                                badge: 'UMUM' },
  { nama: 'PAKET IGE ATOPY',                                   badge: 'UMUM' },
  // ─── NPG (tambahan) ───────────────────────────────────────────────────────
  { nama: 'ABYAKTA NASTARI TRANSINDO, PT',                     badge: 'NPG' },
  { nama: 'ADVANTIS AKAZA INDONESIA, PT',                      badge: 'NPG' },
  { nama: 'AHMAD PUTRA INDO KARYA, PT',                        badge: 'NPG' },
  { nama: 'ANGSA EMAS PERDANA, PT',                            badge: 'NPG' },
  { nama: 'ASTRA GRAPHIA, PT',                                 badge: 'NPG' },
  { nama: 'BABCOCK & WILCOX, PT',                              badge: 'NPG' },
  { nama: 'BAHAGIA SEJAHTERA BERSAMA, PT',                     badge: 'NPG' },
  { nama: 'BANIQL TEKNOLOGI INDONESIA, PT',                    badge: 'NPG' },
  { nama: 'BANK SYARIAH INDONESIA, PT',                        badge: 'NPG' },
  { nama: 'BATARA ELOK SEMESTA TERPADU, PT',                   badge: 'NPG' },
  { nama: 'BATARA ELOK SEMESTA TERPADU, PT (BEST)',            badge: 'NPG' },
  { nama: 'BERMAKS INDONESIA, PT',                             badge: 'NPG' },
  { nama: 'BIMA ASRI INTERMITRA, PT',                          badge: 'NPG' },
  { nama: 'BIRAWIDHA GARDA SANTOSA, PT',                       badge: 'NPG' },
  { nama: 'CAST INSPECTION AND ENGINEERING BATAM, PT',         badge: 'NPG' },
  { nama: 'DAVKO MEGAH CORPORINDO, PT',                        badge: 'NPG' },
  { nama: 'DEPRIWANGGA OM, PT',                                badge: 'NPG' },
  { nama: 'Dinas Kesehatan Kabupaten Gresik',                  badge: 'NPG' },
  { nama: 'DSV SOLUTIONS INDONESIA, PT',                       badge: 'NPG' },
  { nama: 'DUNIA KIMIA JAYA, PT',                              badge: 'NPG' },
  { nama: 'EDBERS NUSANTARA, PT',                              badge: 'NPG' },
  { nama: 'EKA BINTANG PERKASA, PT',                           badge: 'NPG' },
  { nama: 'ELIN JAYA',                                         badge: 'NPG' },
  { nama: 'ELIN SUSANTO JAYA, PT',                             badge: 'NPG' },
  { nama: 'EMITRACO INVESTAMA MANDIRI, PT',                    badge: 'NPG' },
  { nama: 'ETEX BUILDING PEFORMANCE INDONESIA, PT',            badge: 'NPG' },
  { nama: 'EXXONMOBIL LUBRICANTS INDONESIA (FULLERTON), PT',  badge: 'NPG' },
  { nama: 'FOKUS JASA MITRA, PT (FJM)',                        badge: 'NPG' },
  { nama: 'GLOSTER Furniture, PT',                             badge: 'NPG' },
  { nama: 'GRESIK CIPTA SEJAHTERA, PT',                        badge: 'NPG' },
  { nama: 'GRESIK POWER INDONESIA, PT',                        badge: 'NPG' },
  { nama: 'PT. GRESIK GASES INDONESIA',                        badge: 'NPG' },
  { nama: 'GUNA TEGUH ABADI, PT',                              badge: 'NPG' },
  { nama: 'HATCH, PT',                                         badge: 'NPG' },
  { nama: 'HIKMAH JAYA PUTRA, PT',                             badge: 'NPG' },
  { nama: 'IKPT GRESIK, PT',                                   badge: 'NPG' },
  { nama: 'INDONESIA DIRTAJAYA',                               badge: 'NPG' },
  { nama: 'INTECS TEKNIKATAMA INDUSTRI, PT',                   badge: 'NPG' },
  { nama: 'INTEGRITAS SOLUSI MEDIKA, PT (ISOMEDIK)',           badge: 'NPG' },
  { nama: 'INTI KARYA PERSADA TEHNIK ENJINIRING, PT',          badge: 'NPG' },
  { nama: 'KARTIKA BINA MEDIKATAMA, PT',                       badge: 'NPG' },
  { nama: 'KASHIWABARA ENGINEERING INDONESIA, PT',             badge: 'NPG' },
  { nama: 'KAWASAN INDUSTRI GRESIK, PT',                       badge: 'NPG' },
  { nama: 'Kementrian Kesehatan RI',                           badge: 'NPG' },
  { nama: 'KLUB RENANG PETROKIMIA GRESIK',                     badge: 'NPG' },
  { nama: 'KOPINDO CIPTA SEJAHTERA',                           badge: 'NPG' },
  { nama: 'KWSG',                                              badge: 'NPG' },
  { nama: 'LAUTAN AIR INDONESIA, PT',                          badge: 'NPG' },
  { nama: 'LERINDRO INTERNATIONAL, PT',                        badge: 'NPG' },
  { nama: 'LIKU TELAGA, PT',                                   badge: 'NPG' },
  { nama: 'LINDE INDONESIA, PT',                               badge: 'NPG' },
  { nama: 'MACAN ASUHAN PERKASA, PT',                          badge: 'NPG' },
  { nama: 'MARDIKA SARANA ENGINEERING, PT',                    badge: 'NPG' },
  { nama: 'MARGABUMI MATRARAYA (MM), PT',                      badge: 'NPG' },
  { nama: 'MEDIA DOKTER INVESTAMA, PT',                        badge: 'NPG' },
  { nama: 'MEGA ASIA GLOBAL, PT',                              badge: 'NPG' },
  { nama: 'MEISO MITRA UTAMA, PT',                             badge: 'NPG' },
  { nama: 'MIPCON PRIMA INDUSTRI, PT',                         badge: 'NPG' },
  { nama: 'MUCOINDO',                                          badge: 'NPG' },
  { nama: 'NETMARKS INDONESIA, PT',                            badge: 'NPG' },
  { nama: 'PANASONIC GOBEL LIFE SOLUTIONS MANUFACTURING INDONESIA, PT', badge: 'NPG' },
  { nama: 'PARNA MASPION SEJAHTERA, PT',                       badge: 'NPG' },
  { nama: 'PELINDO',                                           badge: 'NPG' },
  { nama: 'PERTAMEDIKA',                                       badge: 'NPG' },
  { nama: 'PERTAMINA HULU ENERGI WEST MADURA OFFSHORE, PT',   badge: 'NPG' },
  { nama: 'PERUSAHAAN KOLEGA',                                 badge: 'NPG' },
  { nama: 'PETRO JORDAN ABADI,PT (PJA)',                       badge: 'NPG' },
  { nama: 'PETRO KARYA MANDIRI, PT',                           badge: 'NPG' },
  { nama: 'PETRO OXO NUSANTARA, PT',                           badge: 'NPG' },
  { nama: 'PETROCENTRAL, PT',                                   badge: 'NPG' },
  { nama: 'PETROKAYAKU, PT',                                   badge: 'NPG' },
  { nama: 'PETROKAYAKU, PT (K3)',                              badge: 'NPG' },
  { nama: 'PETROKOPINDO CIPTA SELARAS, PT',                    badge: 'NPG' },
  { nama: 'PETROKOPINDO CIPTA SELARAS, PT (PCS)',              badge: 'NPG' },
  { nama: 'PETRONIKA',                                         badge: 'NPG' },
  { nama: 'PETROWIDADA, PT',                                   badge: 'NPG' },
  { nama: 'PGN SAKA, PT',                                      badge: 'NPG' },
  { nama: 'PHC MANAGE CARE PELINDO 3, PT',                     badge: 'NPG' },
  { nama: 'PJB - UNIT PEMBANGKIT PAITON, PT',                  badge: 'NPG' },
  { nama: 'PJB UNIT PEMELIHARAAN GRESIK',                      badge: 'NPG' },
  { nama: 'PLN POWER UP',                                      badge: 'NPG' },
  { nama: 'PRASADHA PAMUNAH LIMBAH INDUSTRI, PT',              badge: 'NPG' },
  { nama: 'PT AA INTERNATIONAL INDONESIA',                     badge: 'NPG' },
  { nama: 'PT ADHI KARYA ( UNIT PIPING )',                     badge: 'NPG' },
  { nama: 'PT ADHI KARYA ( UNIT STEEL STRUCTURE )',            badge: 'NPG' },
  { nama: 'PT ADHI KARYA (PERSERO) TBK',                      badge: 'NPG' },
  { nama: 'PT ADHI PERSADA BETON',                             badge: 'NPG' },
  { nama: 'PT ADHIKARYA ( UNIT STEEL STRUCTURE )',             badge: 'NPG' },
  { nama: 'PT ANDIKA JAYA PERSADA',                            badge: 'NPG' },
  { nama: 'PT ARMADA CAKRAWALA ESA',                           badge: 'NPG' },
  { nama: 'PT ARTOKAYA INDONESIA',                             badge: 'NPG' },
  { nama: 'PT ASUKA ENGINEERING INDONESIA',                    badge: 'NPG' },
  { nama: 'PT ATAMORA TEHNIK MAKMUR',                          badge: 'NPG' },
  { nama: 'PT AVER ASIA',                                      badge: 'NPG' },
  { nama: 'PT BAROKAH MANFAAT DUNIA AKHIRAT',                  badge: 'NPG' },
  { nama: 'PT BERLIAN AMAL PERKASA',                           badge: 'NPG' },
  { nama: 'PT BINA SARANA PUTRA',                              badge: 'NPG' },
  { nama: 'PT BIRAWIDHA GARDA SANTOSA',                        badge: 'NPG' },
  { nama: 'PT BLUE GAS INDONESIA',                             badge: 'NPG' },
  { nama: 'PT BUKIT ASAM ( PERTAMEDIKA )',                     badge: 'NPG' },
  { nama: 'PT BUMIMULIA INDAH LESTARI',                        badge: 'NPG' },
  { nama: 'PT CARGILL INDONESIA',                              badge: 'NPG' },
  { nama: 'PT CHIYODA INTERNATIONAL INDONESIA',                badge: 'NPG' },
  { nama: 'PT CIPTA MORTAR UTAMA',                             badge: 'NPG' },
  { nama: 'PT DHARMA GRAHA UTAMA',                             badge: 'NPG' },
  { nama: 'PT DUNIA KIMIA JAYA',                               badge: 'NPG' },
  { nama: 'PT ECOOILS JAYA INDONESIA',                         badge: 'NPG' },
  { nama: 'PT ENVILAB INDONESIA',                              badge: 'NPG' },
  { nama: 'PT GAS SECURITY SERVICES',                          badge: 'NPG' },
  { nama: 'PT GD INDONESIA',                                   badge: 'NPG' },
  { nama: 'PT GLOBAL ECO CHEMICALS INDONESIA',                 badge: 'NPG' },
  { nama: 'PT GLOBAL OCENIA SEJAHTERA',                        badge: 'NPG' },
  { nama: 'PT GRAHA MAKMUR CIPTA PRATAMA',                     badge: 'NPG' },
  { nama: 'PT INDAL STEEL PIPE',                               badge: 'NPG' },
  { nama: 'PT INDONESIA DIRTAJAYA ANEKA INDUSTRI BOX (PT INTAN USTRIX)', badge: 'NPG' },
  { nama: 'PT INTIM JAYA',                                     badge: 'NPG' },
  { nama: 'PT JAYA SAKTI MANDIRI UNGGUL',                      badge: 'NPG' },
  { nama: 'PT KIMIKA USAHA PRIMA',                             badge: 'NPG' },
  { nama: 'PT KINDEN INDONESIA',                               badge: 'NPG' },
  { nama: 'PT LF SERVICES INDONESIA',                          badge: 'NPG' },
  { nama: 'PT LIWAYWAY',                                       badge: 'NPG' },
  { nama: 'PT MARGABUMI MATRARAYA (MM)',                        badge: 'NPG' },
  { nama: 'PT MEDIKA PRAKARSA INDONESIA',                      badge: 'NPG' },
  { nama: 'PT METITO INDONESIA',                               badge: 'NPG' },
  { nama: 'PT MK PRIMA INDONESIA',                             badge: 'NPG' },
  { nama: 'PT MUCOINDO PRAKASA',                               badge: 'NPG' },
  { nama: 'PT NIPPON INDOSARI CORPINDO',                       badge: 'NPG' },
  { nama: 'PT PACINESIA CHEMICAL INDUSTRY',                    badge: 'NPG' },
  { nama: 'PT PEMBANGUNAN PERUMAHAN',                          badge: 'NPG' },
  { nama: 'PT PERTAMINA HULU ENERGI WMO',                      badge: 'NPG' },
  { nama: 'PT PETRO KARYA NIAGA',                              badge: 'NPG' },
  { nama: 'PT PINTAR DATA GROUP',                              badge: 'NPG' },
  { nama: 'PT PIPA NITROGEN SERVIS INDONESIA',                 badge: 'NPG' },
  { nama: 'PT PLN NUSANTARA POWER UP GRESIK',                  badge: 'NPG' },
  { nama: 'PT PRIMA SARANA JASA',                              badge: 'NPG' },
  { nama: 'PT PUPUK INDONESIA ENERGI',                         badge: 'NPG' },
  { nama: 'PT PUSPETINDO',                                     badge: 'NPG' },
  { nama: 'PT REZEKI SURYA INTIMAKMUR',                        badge: 'NPG' },
  { nama: 'PT SMCC UTAMA INDONESIA',                           badge: 'NPG' },
  { nama: 'PT SOLUSI MAJU JAYA',                               badge: 'NPG' },
  { nama: 'PT SOLVAY MANYAR',                                  badge: 'NPG' },
  { nama: 'PT SUCI ENERGY SOLUSI INDONESIA',                   badge: 'NPG' },
  { nama: 'PT SUZUKI FINANCE INDONESIA',                       badge: 'NPG' },
  { nama: 'PT SWADAYA CIPTA',                                  badge: 'NPG' },
  { nama: 'PT TECHNO PREFAB INDONESIA',                        badge: 'NPG' },
  { nama: 'PT TEKNIK UMUM SANKO ENG',                          badge: 'NPG' },
  { nama: 'PT TERAS TEKNIK PERDANA -PT MEISEI INDONESIA',      badge: 'NPG' },
  { nama: 'PT TIGA PILAR ENERGI',                              badge: 'NPG' },
  { nama: 'PT VOLAC WILMAR FEED INGREDIENTS INDONESIA',        badge: 'NPG' },
  { nama: 'PT WELTES ENERGI NUSANTARA',                        badge: 'NPG' },
  { nama: 'PT. ALDZAMA',                                       badge: 'NPG' },
  { nama: 'PT. BERDIKARI PONDASI PERKASA',                     badge: 'NPG' },
  { nama: 'PT. DELAPAN PINTU UTAMA',                           badge: 'NPG' },
  { nama: 'PT. KARYA MANUNGGAL JATI',                          badge: 'NPG' },
  { nama: 'PT. PAITON OPERATION MAINTENANCE INDONESIA (POMI)', badge: 'NPG' },
  { nama: 'PT. PERTAMINA BINA MEDIKA (PERTAMEDIKA)',           badge: 'NPG' },
  { nama: 'PT. PETRO OXO NUSANTARA',                           badge: 'NPG' },
  { nama: 'PT. WIJAYA KARYA',                                  badge: 'NPG' },
  { nama: 'PUPUK INDONESIA UTILITAS, PT',                      badge: 'NPG' },
  { nama: 'PUPUK INDONESIA, PT',                               badge: 'NPG' },
  { nama: 'Puskesmas Nelayan',                                 badge: 'NPG' },
  { nama: 'Qatar Energy LNG',                                  badge: 'NPG' },
  { nama: 'RAMAYANA KWSG',                                     badge: 'NPG' },
  { nama: 'RAMAYANA PJA',                                      badge: 'NPG' },
  { nama: 'REDTROINDO NUSANTARA, PT',                          badge: 'NPG' },
  { nama: 'REVAN JAYA MANDIRI, PT',                            badge: 'NPG' },
  { nama: 'RS PUPUK KALTIM BONTANG',                           badge: 'NPG' },
  { nama: 'SAKA INDONESIA PANGKAH LIMITED',                    badge: 'NPG' },
  { nama: 'SAMPOERNA ALAM SAMUDRA, PT',                        badge: 'NPG' },
  { nama: 'SEMEN INDONESIA DISTRIBUTOR',                       badge: 'NPG' },
  { nama: 'SENTANA ADIDAYA PRATAMA,PT',                        badge: 'NPG' },
  { nama: 'SIGAP PRATAMA SEJAHTERA, PT',                       badge: 'NPG' },
  { nama: 'SILVERINDO GLOBAL KARYA, PT',                       badge: 'NPG' },
  { nama: 'SUPERKRANE MITRA UTAMA TBK. PT',                    badge: 'NPG' },
  { nama: 'SURI TANI PEMUKA, PT',                              badge: 'NPG' },
  { nama: 'SYENSQO MANYAR, PT',                                badge: 'NPG' },
  { nama: 'TEKNOLOGI KARYA ABADI, PT',                         badge: 'NPG' },
  { nama: 'THE FIRST TRIJAYA CATERING & SUPPLIERS, PT',        badge: 'NPG' },
  { nama: 'TOKKI ENGINEERING AND FABRICATION, PT',             badge: 'NPG' },
  { nama: 'TPC INDO PLASTIC AND CHEMICALS, PT',                badge: 'NPG' },
  { nama: 'UNIVERSITAS INTERNATIONAL SEMEN INDONESIA',         badge: 'NPG' },
  { nama: 'WASA MITRA ENGINEERING, PT',                        badge: 'NPG' },
  { nama: 'WASKITA, PT',                                       badge: 'NPG' },
  { nama: 'WELLINDO JAYA PERSADA, PT',                         badge: 'NPG' },
  { nama: 'YAYASAN KESEHATAN PEGAWAI TELKOM, PT',              badge: 'NPG' },
  { nama: 'ALBEA RIGID PACKAGING SURABAYA',                    badge: 'NPG' },
  { nama: 'ATAMORA',                                           badge: 'NPG' },
  { nama: 'ABITECH',                                           badge: 'NPG' },
  { nama: 'ABHITECH',                                          badge: 'NPG' },
  { nama: 'CALON FOKUS JASA MITRA, PT (FJM)',                  badge: 'NPG' },
  { nama: 'CALON INDOSPRING',                                  badge: 'NPG' },
  { nama: 'CALON KAYAKU',                                      badge: 'NPG' },
  { nama: 'CALON LIWAYWAY',                                    badge: 'NPG' },
  { nama: 'CALON PETRO OXO',                                   badge: 'NPG' },
  { nama: 'CALON PJA',                                         badge: 'NPG' },
  { nama: 'DIRTAJAYA',                                         badge: 'NPG' },
  { nama: 'INDONESIA DIRTAJAYA',                               badge: 'NPG' },
  { nama: 'PAMA PERSADA',                                      badge: 'NPG' },
  { nama: 'PELINDO',                                           badge: 'NPG' },
  { nama: 'PERTAMEDIKA',                                       badge: 'NPG' },
  { nama: 'PETRONIKA',                                         badge: 'NPG' },
  { nama: 'PSV SOLUTION',                                      badge: 'NPG' },
];

const DEFAULT_ROWS: Omit<KunjunganInputRow, 'id'>[] = [
  { namaPenjamin: 'KARYAWAN PG',               badge: 'PG',             rjYani:0,riYani:0,igd:0,mcuAuto:0,promo:0,dokter:0,exc:0,prior:0,grhuRj:0,grhuRi:0,sat:0,ppk1:0,total:0 },
  { namaPenjamin: 'KELUARGA PG',               badge: 'PG',             rjYani:0,riYani:0,igd:0,mcuAuto:0,promo:0,dokter:0,exc:0,prior:0,grhuRj:0,grhuRi:0,sat:0,ppk1:0,total:0 },
  { namaPenjamin: 'KARYAWAN PG BRI LIFE',      badge: 'BRI LIFE PG',   rjYani:0,riYani:0,igd:0,mcuAuto:0,promo:0,dokter:0,exc:0,prior:0,grhuRj:0,grhuRi:0,sat:0,ppk1:0,total:0 },
  { namaPenjamin: 'KELUARGA PG BRI LIFE',      badge: 'BRI LIFE PG',   rjYani:0,riYani:0,igd:0,mcuAuto:0,promo:0,dokter:0,exc:0,prior:0,grhuRj:0,grhuRi:0,sat:0,ppk1:0,total:0 },
  { namaPenjamin: 'PROKESPEN MURNI',           badge: 'PROKESPEN',      rjYani:0,riYani:0,igd:0,mcuAuto:0,promo:0,dokter:0,exc:0,prior:0,grhuRj:0,grhuRi:0,sat:0,ppk1:0,total:0 },
  { namaPenjamin: 'PROKESPEN BPJS COB',        badge: 'PROKESPEN BPJS', rjYani:0,riYani:0,igd:0,mcuAuto:0,promo:0,dokter:0,exc:0,prior:0,grhuRj:0,grhuRi:0,sat:0,ppk1:0,total:0 },
  { namaPenjamin: 'BPJS KESEHATAN',            badge: 'BPJS',           rjYani:0,riYani:0,igd:0,mcuAuto:0,promo:0,dokter:0,exc:0,prior:0,grhuRj:0,grhuRi:0,sat:0,ppk1:0,total:0 },
  { namaPenjamin: 'BPJS NAIK KELAS.',          badge: 'BPJS',           rjYani:0,riYani:0,igd:0,mcuAuto:0,promo:0,dokter:0,exc:0,prior:0,grhuRj:0,grhuRi:0,sat:0,ppk1:0,total:0 },
  { namaPenjamin: 'PASIEN UMUM',               badge: 'UMUM',           rjYani:0,riYani:0,igd:0,mcuAuto:0,promo:0,dokter:0,exc:0,prior:0,grhuRj:0,grhuRi:0,sat:0,ppk1:0,total:0 },
  { namaPenjamin: 'BPJS KETENAGAKERJAAN (JKK)',badge: 'JKK',            rjYani:0,riYani:0,igd:0,mcuAuto:0,promo:0,dokter:0,exc:0,prior:0,grhuRj:0,grhuRi:0,sat:0,ppk1:0,total:0 },
];

const DEFAULT_PENJAMIN_NAMES = new Set(DEFAULT_ROWS.map(r => r.namaPenjamin));

// Validation: check if penjamin name exists in any list
function isPenjaminValid(nama: string, builtinList: PenjaminEntry[], customList: PenjaminEntry[]): boolean {
  if (!nama.trim()) return false;
  const allList = [...builtinList, ...customList];
  return allList.some(p => p.nama.toUpperCase() === nama.toUpperCase());
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayISO() { return new Date().toISOString().slice(0, 10); }
function nanoid()   { return Math.random().toString(36).slice(2,10) + Date.now().toString(36); }
function calcTotal(row: any): number { return KUNJUNGAN_COLS.reduce((s,c) => s+(Number(row[c.k])||0), 0); }
function defaultRows(): KunjunganInputRow[] { return DEFAULT_ROWS.map(p => ({ ...p, id: nanoid() })); }
function hasData(k: KunjunganInputRow[], m: McuInputRow[]) { return k.some(r=>r.total>0) || m.length>0; }
function numericKeyDown(e: React.KeyboardEvent) {
  const pass = ['Backspace','Tab','Delete','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'];
  if (pass.includes(e.key) || e.ctrlKey || e.metaKey) return;
  if (!/^\d$/.test(e.key)) e.preventDefault();
}

// ─── usePenjaminList hook ─────────────────────────────────────────────────────

function usePenjaminList() {
  const [custom, setCustom] = useState<PenjaminEntry[]>(() => {
    try { return JSON.parse(localStorage.getItem(PENJAMIN_KEY) || '[]'); } catch { return []; }
  });

  const allList: PenjaminEntry[] = [
    ...BUILTIN_PENJAMIN,
    ...custom.filter(c => !BUILTIN_PENJAMIN.some(b => b.nama === c.nama)),
  ];

  const addPenjamin = (entry: PenjaminEntry) => {
    if (allList.some(p => p.nama.toLowerCase() === entry.nama.toLowerCase())) return false;
    const next = [...custom, entry];
    setCustom(next);
    localStorage.setItem(PENJAMIN_KEY, JSON.stringify(next));
    return true;
  };

  const removePenjamin = (nama: string) => {
    const next = custom.filter(p => p.nama !== nama);
    setCustom(next);
    localStorage.setItem(PENJAMIN_KEY, JSON.stringify(next));
  };

  const isBuiltin = (nama: string) => BUILTIN_PENJAMIN.some(p => p.nama === nama);

  return { allList, custom, addPenjamin, removePenjamin, isBuiltin };
}

// ─── Export Excel ─────────────────────────────────────────────────────────────

// Mapping badge → nama kolom di format OMZET KUNJUNGAN
const REKAP_LABEL_MAP: Record<string, string> = {
  'PG':           'PT PETROKIMIA',
  'NPG':          'PERUSAHAAN LAIN',
  'BRI LIFE PG':  'BRI (PG)',
  'AS':           'ASURANSI KOMERSIAL',
  'PROKESPEN':    'PROKESPEN MURNI',
  'PROKESPEN BPJS': 'PROKESPEN BPJS',
  'BPJS':         'BPJS KES',
  'JKK':          'BPJS TK',
  'UMUM':         'TUNAI/UMUM',
};
const REKAP_LABEL_ORDER = ['PG','NPG','BRI LIFE PG','AS','PROKESPEN','PROKESPEN BPJS','BPJS','JKK','UMUM'];

function exportToExcel(tanggal: string, kunjungan: KunjunganInputRow[], mcu: McuInputRow[]) {
  const wb = XLSX.utils.book_new();
  const colH = ['KET','JAMINAN','RJ A.Yani','RI A.Yani','IGD','MCU','Promo','Dokter Luar','Poli Exc','Poli Prior','Grahu RJ','Grahu RI','Satelit','PPK1','TOTAL'];
  const aoa: any[][] = [['LAPORAN HARIAN KUNJUNGAN LABORATORIUM A. YANI'],['Tanggal :', tanggal], colH];

  const DEFAULT_NAMES_ORDER = DEFAULT_ROWS.map(r => r.namaPenjamin);
  const groups: Record<string, KunjunganInputRow[]> = {};
  for (const r of kunjungan) { if (!groups[r.badge]) groups[r.badge]=[]; groups[r.badge].push(r); }

  // Urutkan semua baris: DEFAULT_ROWS order dulu, lalu extras alfabetis
  const sortedRows = [...kunjungan].sort((a, b) => {
    const ai = DEFAULT_NAMES_ORDER.indexOf(a.namaPenjamin);
    const bi = DEFAULT_NAMES_ORDER.indexOf(b.namaPenjamin);
    if (ai >= 0 && bi >= 0) return ai - bi;
    if (ai >= 0) return -1;
    if (bi >= 0) return 1;
    return a.namaPenjamin.localeCompare(b.namaPenjamin);
  });

  // Track KET label: tampilkan hanya sekali per badge group
  let lastBadge = '';
  for (const r of sortedRows) {
    const ket = r.badge !== lastBadge ? (REKAP_LABEL_MAP[r.badge] || r.badge) : null;
    lastBadge = r.badge;
    aoa.push([ket, r.namaPenjamin, r.rjYani, r.riYani, r.igd, r.mcuAuto, r.promo, r.dokter, r.exc, r.prior, r.grhuRj, r.grhuRi, r.sat, r.ppk1, r.total]);
  }

  const tot: any[] = ['TOTAL', null];
  KUNJUNGAN_COLS.forEach(c => tot.push(kunjungan.reduce((s,r)=>s+(r as any)[c.k],0)));
  tot.push(kunjungan.reduce((s,r)=>s+r.total,0));
  aoa.push(tot);

  const ws1 = XLSX.utils.aoa_to_sheet(aoa);
  ws1['!cols'] = [{ wch:20 },{ wch:36 },...Array(13).fill({ wch:10 })];
  XLSX.utils.book_append_sheet(wb, ws1, 'Laporan Harian');

  // Sheet Rekap Kunjungan — format sesuai OMZET KUNJUNGAN 2026
  const rekapCols = REKAP_LABEL_ORDER.map(b => REKAP_LABEL_MAP[b]);
  const activeLabels = REKAP_LABEL_ORDER.filter(b => (groups[b]||[]).length > 0);
  const activeCols = activeLabels.map(b => REKAP_LABEL_MAP[b]);
  const rekapAoa: any[][] = [
    [`REKAP KUNJUNGAN - ${tanggal}`],
    ['KUNJUNGAN', ...activeCols, 'TOTAL KUNJUNGAN'],
  ];
  // RAWAT JALAN = rjYani + promo + dokter + exc + prior + grhuRj + sat + ppk1
  const rjVals = activeLabels.map(badge =>
    (groups[badge]||[]).reduce((s,r)=>s+r.rjYani+r.promo+r.dokter+r.exc+r.prior+r.grhuRj+r.sat+r.ppk1,0)
  );
  rekapAoa.push(['RAWAT JALAN', ...rjVals, rjVals.reduce((a,b)=>a+b,0)]);
  // RAWAT INAP = riYani + grhuRi
  const riVals = activeLabels.map(badge =>
    (groups[badge]||[]).reduce((s,r)=>s+r.riYani+r.grhuRi,0)
  );
  rekapAoa.push(['RAWAT INAP', ...riVals, riVals.reduce((a,b)=>a+b,0)]);
  const igdVals = activeLabels.map(badge => (groups[badge]||[]).reduce((s,r)=>s+r.igd,0));
  rekapAoa.push(['IGD', ...igdVals, igdVals.reduce((a,b)=>a+b,0)]);
  const mcuVals = activeLabels.map(badge => (groups[badge]||[]).reduce((s,r)=>s+r.mcuAuto,0));
  rekapAoa.push(['MCU', ...mcuVals, mcuVals.reduce((a,b)=>a+b,0)]);
  const totVals = activeLabels.map(badge => (groups[badge]||[]).reduce((s,r)=>s+r.total,0));
  rekapAoa.push(['TOTAL KUNJUNGAN', ...totVals, totVals.reduce((a,b)=>a+b,0)]);

  const ws3 = XLSX.utils.aoa_to_sheet(rekapAoa);
  ws3['!cols'] = [{ wch:18 }, ...Array(activeLabels.length+1).fill({ wch:16 })];
  XLSX.utils.book_append_sheet(wb, ws3, 'Rekap Kunjungan');

  const mcuAoa: any[][] = [
    [`MCU HARIAN - ${tanggal}`],
    ['No.','Nama Penjamin','Paket','Peserta','Nominal/Orang','Total'],
    ...mcu.map((r,i) => [i+1,r.namaPenjamin,r.paket,r.peserta,r.nominal,r.total]),
    ['TOTAL',null,null,mcu.reduce((s,r)=>s+r.peserta,0),null,mcu.reduce((s,r)=>s+r.total,0)],
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(mcuAoa);
  ws2['!cols'] = [{ wch:5 },{ wch:40 },{ wch:20 },{ wch:10 },{ wch:14 },{ wch:14 }];
  XLSX.utils.book_append_sheet(wb, ws2, 'MCU Harian');
  XLSX.writeFile(wb, `Lap_${tanggal}.xlsx`);
}

// ─── PenjaminCombobox ─────────────────────────────────────────────────────────

function PenjaminCombobox({ value, badge, list, usedNames = [], isDefault = false, isInvalid = false, onSelect, onOpenSettings }: {
  value: string; badge: string;
  list: PenjaminEntry[];
  usedNames?: string[];
  isDefault?: boolean;
  isInvalid?: boolean;
  onSelect: (nama: string, badge: string) => void;
  onOpenSettings?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0 });
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const filtered = query.length >= 1 && !isDefault
    ? list.filter(p => p.nama.toLowerCase().includes(query.toLowerCase())).slice(0, 8)
    : [];
  const noResult = query.length >= 2 && filtered.length === 0;

  useEffect(() => { setQuery(value); }, [value]);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (
        ref.current && !ref.current.contains(e.target as Node) &&
        (!dropRef.current || !dropRef.current.contains(e.target as Node))
      ) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const openDropdown = () => {
    if (isDefault || !inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    setDropPos({ top: rect.bottom + window.scrollY + 2, left: rect.left + window.scrollX });
    setOpen(true);
  };

  return (
    <div ref={ref} className="relative flex items-center gap-1">
      <Input
        ref={inputRef}
        value={query}
        onChange={e => { if (!isDefault) { setQuery(e.target.value); openDropdown(); } }}
        onFocus={openDropdown}
        disabled={isDefault}
        className={`h-6 text-[10px] w-[155px] px-1.5 ${isDefault ? 'opacity-60 cursor-not-allowed' : ''} ${isInvalid ? 'border-red-500 bg-red-50' : ''}`}
        placeholder="Cari penjamin..."
        title={isDefault ? 'Nama penjamin default tidak bisa diubah' : (isInvalid ? 'Nama penjamin tidak sesuai dengan list' : 'Cari penjamin...')}
      />
      {badge && (
        <span className={`text-[8px] font-bold px-1 py-0.5 rounded border whitespace-nowrap shrink-0 ${labelClass(badge)}`}>
          {badge}
        </span>
      )}
      {open && (filtered.length > 0 || noResult) && createPortal(
        <div
          ref={dropRef}
          style={{ position: 'absolute', top: dropPos.top, left: dropPos.left, zIndex: 9999, width: '288px' }}
          className="bg-popover border border-border rounded-md shadow-lg max-h-52 overflow-y-auto"
        >
          {filtered.map(p => {
            const isUsed = usedNames.includes(p.nama);
            return (
              <button key={p.nama}
                className={`w-full flex items-center gap-2 px-2 py-1 text-[10px] text-left transition-colors
                  ${isUsed ? 'opacity-40 cursor-not-allowed bg-muted' : 'hover:bg-muted'}`}
                onMouseDown={() => {
                  if (isUsed) return;
                  onSelect(p.nama, p.badge);
                  setQuery(p.nama);
                  setOpen(false);
                }}>
                <span className={`text-[8px] font-bold px-1 py-0.5 rounded border shrink-0 ${labelClass(p.badge)}`}>{p.badge}</span>
                <span className="truncate">{p.nama}</span>
                {isUsed && <span className="ml-auto text-[8px] text-muted-foreground shrink-0">sudah ada</span>}
              </button>
            );
          })}
          {noResult && (
            <div className="px-3 py-2.5 text-[10px] text-muted-foreground space-y-1">
              <p>"{query}" tidak ditemukan di list.</p>
              {onOpenSettings && (
                <button
                  className="flex items-center gap-1 text-accent font-semibold hover:underline"
                  onMouseDown={() => { setOpen(false); onOpenSettings(); }}>
                  <Settings className="w-3 h-3" /> Tambah penjamin baru di Settings
                </button>
              )}
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}

// ─── Admin PIN ────────────────────────────────────────────────────────────────

const ADMIN_PIN = '112231';

function PinModal({ onSuccess, onClose }: { onSuccess: () => void; onClose: () => void }) {
  const PIN_LEN     = 6;
  const MAX_ATTEMPTS = 3;
  const [pin,      setPin]      = useState('');
  const [error,    setError]    = useState('');
  const [attempts, setAttempts] = useState(0);
  const [locked,   setLocked]   = useState(false);

  const validate = (value: string) => {
    if (value === ADMIN_PIN) { onSuccess(); return; }
    const next = attempts + 1;
    setAttempts(next);
    setPin('');
    if (next >= MAX_ATTEMPTS) {
      setLocked(true);
      setError('Terlalu banyak percobaan. Coba lagi dalam 30 detik.');
      setTimeout(() => { setLocked(false); setAttempts(0); setError(''); }, 30_000);
    } else {
      setError(`PIN salah. Sisa ${MAX_ATTEMPTS - next} percobaan.`);
    }
  };

  const handleDigit = (d: string) => {
    if (locked || pin.length >= PIN_LEN) return;
    setError('');
    const next = pin + d;
    setPin(next);
    if (next.length === PIN_LEN) setTimeout(() => validate(next), 120);
  };

  const handleBack = () => { if (!locked) { setPin(p => p.slice(0, -1)); setError(''); } };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="card-clinical p-5 w-64 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5" /> Admin Penjamin
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-[10px] text-muted-foreground text-center">
          Masukkan PIN admin untuk mengelola daftar penjamin
        </p>

        {/* PIN dots */}
        <div className="flex justify-center gap-2">
          {Array.from({ length: PIN_LEN }).map((_, i) => (
            <div key={i} className={`w-2.5 h-2.5 rounded-full border-2 transition-colors
              ${i < pin.length ? 'bg-accent border-accent' : 'border-muted-foreground/40'}`} />
          ))}
        </div>

        {error && <p className="text-[10px] text-destructive text-center">{error}</p>}

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-1.5">
          {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((k, i) => (
            <button key={i}
              disabled={locked || k === ''}
              onClick={() => k === '⌫' ? handleBack() : k ? handleDigit(k) : undefined}
              className={`h-9 rounded-lg text-sm font-semibold border border-border transition-colors
                ${k === '' ? 'invisible pointer-events-none' : ''}
                ${k === '⌫' ? 'text-muted-foreground hover:bg-muted' : 'hover:bg-accent/10 active:bg-accent/20'}
                ${locked ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              {k}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Settings Modal ───────────────────────────────────────────────────────────

function SettingsModal({ list, custom, onAdd, onRemove, onClose, isBuiltin }: {
  list: PenjaminEntry[];
  custom: PenjaminEntry[];
  onAdd: (e: PenjaminEntry) => boolean;
  onRemove: (nama: string) => void;
  onClose: () => void;
  isBuiltin: (nama: string) => boolean;
}) {
  const [newNama,  setNewNama]  = useState('');
  const [newBadge, setNewBadge] = useState('NPG');
  const [search,   setSearch]   = useState('');

  const filtered = list.filter(p =>
    p.nama.toLowerCase().includes(search.toLowerCase()) ||
    p.badge.toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = () => {
    const nama = newNama.trim().toUpperCase();
    if (!nama) return;
    const ok = onAdd({ nama, badge: newBadge });
    if (ok) { setNewNama(''); toast.success(`${nama} ditambahkan ke list`); }
    else toast.error('Nama penjamin sudah ada di list');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-lg mx-4 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-sm font-bold flex items-center gap-2">
            <Settings className="w-4 h-4" /> Manajemen List Penjamin
          </h2>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>

        {/* Add new */}
        <div className="px-4 py-3 border-b border-border space-y-2">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Tambah Penjamin Baru</p>
          <div className="flex gap-2">
            <Input
              value={newNama}
              onChange={e => setNewNama(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              className="h-7 text-xs flex-1"
              placeholder="Nama penjamin (huruf kapital)"
            />
            <select
              value={newBadge}
              onChange={e => setNewBadge(e.target.value)}
              className={`h-7 text-[10px] font-bold rounded border px-1.5 w-32 cursor-pointer ${labelClass(newBadge)}`}>
              {ALL_LABELS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
            <Button size="sm" className="h-7 text-xs px-2 shrink-0" onClick={handleAdd}>
              <Plus className="w-3 h-3 mr-1" /> Tambah
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="px-4 py-2 border-b border-border">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)}
              className="h-7 text-xs pl-7" placeholder={`Cari dari ${list.length} penjamin...`} />
          </div>
        </div>

        {/* List */}
        <div className="overflow-y-auto flex-1 px-2 py-1">
          {filtered.map(p => (
            <div key={p.nama}
              className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted/50 group">
              <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${labelClass(p.badge)}`}>
                {p.badge}
              </span>
              <span className="text-[11px] flex-1 truncate">{p.nama}</span>
              {isBuiltin(p.nama)
                ? <span className="text-[8px] text-muted-foreground shrink-0">bawaan</span>
                : (
                  <Button variant="ghost" size="icon"
                    className="h-5 w-5 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 shrink-0"
                    onClick={() => { onRemove(p.nama); toast.success(`${p.nama} dihapus dari list`); }}>
                    <Trash2 className="w-2.5 h-2.5" />
                  </Button>
                )
              }
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="text-center text-[10px] text-muted-foreground py-6">Tidak ada hasil untuk "{search}"</p>
          )}
        </div>

        <div className="px-4 py-2 border-t border-border text-[9px] text-muted-foreground">
          {list.length} total · {custom.length} ditambahkan · {BUILTIN_PENJAMIN.length} bawaan
        </div>
      </div>
    </div>
  );
}

// ─── SummaryCard ──────────────────────────────────────────────────────────────

function SummaryCard({ label, value, color, sub }: { label: string; value: number; color: string; sub?: string }) {
  return (
    <div className="card-clinical px-2.5 py-1.5 flex flex-col min-w-[80px]">
      <p className="text-[8px] font-semibold uppercase tracking-wider text-muted-foreground font-mono-data">{label}</p>
      <p className="text-base font-bold font-display leading-tight" style={{ color }}>{value}</p>
      {sub && <p className="text-[8px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function InputHarianTab() {
  const { allList, custom, addPenjamin, removePenjamin, isBuiltin } = usePenjaminList();

  const [tanggal,    setTanggal]    = useState(todayISO());
  const [kunjungan,  setKunjungan]  = useState<KunjunganInputRow[]>(defaultRows());
  const [mcu,        setMcu]        = useState<McuInputRow[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const openAdminSettings = () => setShowPinModal(true);

  // Load draft
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d: InputHarianDraft = JSON.parse(raw);
        setTanggal(d.tanggal || todayISO());
        setKunjungan(d.kunjungan?.length ? d.kunjungan : defaultRows());
        setMcu(d.mcu || []);
      }
    } catch { /* ignore */ }
  }, []);

  // Auto-save
  useEffect(() => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ tanggal, kunjungan, mcu }));
  }, [tanggal, kunjungan, mcu]);

  // Warn on leave
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (hasData(kunjungan, mcu)) { e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [kunjungan, mcu]);

  // ── MCU → aggregate mcuAuto by NAMA PENJAMIN, auto-add missing rows ──────────
  useEffect(() => {
    const byName: Record<string, number> = {};
    for (const r of mcu) {
      if (r.namaPenjamin) byName[r.namaPenjamin] = (byName[r.namaPenjamin]||0) + (r.peserta||0);
    }
    setKunjungan(prev => {
      const existingNames = new Set(prev.map(r => r.namaPenjamin));
      const newRows: KunjunganInputRow[] = [];
      for (const [nama, peserta] of Object.entries(byName)) {
        if (!existingNames.has(nama)) {
          const entry = BUILTIN_PENJAMIN.find(p => p.nama === nama);
          const badge = entry?.badge || 'NPG';
          const row: KunjunganInputRow = {
            id: nanoid(), namaPenjamin: nama, badge,
            rjYani:0,riYani:0,igd:0,mcuAuto:peserta,promo:0,dokter:0,exc:0,prior:0,grhuRj:0,grhuRi:0,sat:0,ppk1:0,total:0,
          };
          row.total = calcTotal(row);
          newRows.push(row);
        }
      }
      const updated = prev.map(row => {
        const agg = byName[row.namaPenjamin] || 0;
        if (row.mcuAuto === agg) return row;
        const u = { ...row, mcuAuto: agg };
        u.total = calcTotal(u);
        return u;
      });
      return newRows.length > 0 ? [...updated, ...newRows] : updated;
    });
  }, [mcu]);

  // ── Kunjungan handlers ────────────────────────────────────────────────────
  const updateKunjungan = useCallback((id: string, field: string, val: string) => {
    setKunjungan(prev => prev.map(row => {
      if (row.id !== id) return row;
      const updated = { ...row, [field]: Number(val)||0 };
      updated.total = calcTotal(updated);
      return updated;
    }));
  }, []);

  const selectPenjamin = useCallback((id: string, nama: string, badge: string) => {
    // Check duplicate
    setKunjungan(prev => {
      const isDup = prev.some(r => r.id !== id && r.namaPenjamin === nama);
      if (isDup) {
        toast.warning(`"${nama}" sudah ada di tabel — tidak bisa duplikat`);
        // Clear the input
        return prev.map(r => r.id === id ? { ...r, namaPenjamin: '', badge: 'NPG' } : r);
      }
      return prev.map(r => r.id === id ? { ...r, namaPenjamin: nama, badge } : r);
    });
  }, []);

  const addKunjunganRow = () => setKunjungan(prev => [...prev, {
    id: nanoid(), namaPenjamin: '', badge: 'NPG',
    rjYani:0,riYani:0,igd:0,mcuAuto:0,promo:0,dokter:0,exc:0,prior:0,grhuRj:0,grhuRi:0,sat:0,ppk1:0,total:0,
  }]);
  const removeKunjunganRow = (id: string) => setKunjungan(prev => {
    const row = prev.find(r => r.id === id);
    if (row && DEFAULT_PENJAMIN_NAMES.has(row.namaPenjamin)) return prev;
    return prev.filter(r => r.id !== id);
  });

  // Names already used in tabel utama (for showing "sudah ada" in dropdown)
  const usedNames = kunjungan.map(r => r.namaPenjamin).filter(Boolean);

  // ── MCU handlers ──────────────────────────────────────────────────────────
  const updateMcu = useCallback((id: string, field: string, val: string) => {
    setMcu(prev => prev.map(row => {
      if (row.id !== id) return row;
      const num = ['peserta','nominal'].includes(field);
      const updated = { ...row, [field]: num ? Number(val)||0 : val };
      updated.total = updated.peserta * updated.nominal;
      return updated;
    }));
  }, []);

  const selectMcuPenjamin = useCallback((id: string, nama: string) => {
    setMcu(prev => prev.map(r => r.id === id ? { ...r, namaPenjamin: nama } : r));
  }, []);

  const addMcuRow    = () => setMcu(prev => [...prev, { id: nanoid(), namaPenjamin:'', paket:'', peserta:0, nominal:0, total:0 }]);
  const removeMcuRow = (id: string) => setMcu(prev => prev.filter(r => r.id !== id));

  // ── Reset ──────────────────────────────────────────────────────────────────
  const handleReset = () => {
    if (hasData(kunjungan, mcu) && !confirm('Reset semua data yang sudah diisi?')) return;
    setTanggal(todayISO());
    setKunjungan(defaultRows());
    setMcu([]);
    localStorage.removeItem(DRAFT_KEY);
    toast.success('Form direset');
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    const empty = kunjungan.filter(r => r.total>0 && !r.namaPenjamin.trim());
    if (empty.length) { toast.error(`${empty.length} baris ada angka tapi nama penjamin kosong`); return; }
    const GS_URL = (import.meta.env.VITE_GAS_INPUT_URL as string) || '';
    if (!GS_URL) { toast.error('VITE_GAS_INPUT_URL belum diset di .env'); return; }
    setSubmitting(true);
    try {
      await fetch(GS_URL, {
        method:'POST', mode:'no-cors',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'inputHarian', tanggal, kunjungan, mcu }),
      });
      toast.success('Data berhasil dikirim ke Sheets!');
      localStorage.removeItem(DRAFT_KEY);
    } catch (err: any) {
      toast.error(`Gagal kirim: ${err.message}`);
    } finally { setSubmitting(false); }
  };

  // ── Computed ───────────────────────────────────────────────────────────────
  const colTotals   = KUNJUNGAN_COLS.map(c => ({ k:c.k, total: kunjungan.reduce((s,r)=>s+(r as any)[c.k],0) }));
  const grandTotal  = kunjungan.reduce((s,r)=>s+r.total,0);
  const unitSummary = {
    rj:    kunjungan.reduce((s,r)=>s+r.rjYani,0),
    ri:    kunjungan.reduce((s,r)=>s+r.riYani,0),
    igd:   kunjungan.reduce((s,r)=>s+r.igd,0),
    mcu:   kunjungan.reduce((s,r)=>s+r.mcuAuto,0),
    promo: kunjungan.reduce((s,r)=>s+r.promo,0),
  };
  const labelSummary = ALL_LABELS.map(label => {
    const rows = kunjungan.filter(r=>r.badge===label);
    const rj  = rows.reduce((s,r)=>s+r.rjYani+r.promo+r.dokter+r.exc+r.prior+r.grhuRj+r.grhuRi+r.sat+r.ppk1,0);
    const ri  = rows.reduce((s,r)=>s+r.riYani,0);
    const igd = rows.reduce((s,r)=>s+r.igd,0);
    const mcu = rows.reduce((s,r)=>s+r.mcuAuto,0);
    const total = rows.reduce((s,r)=>s+r.total,0);
    return { label, rj, ri, igd, mcu, total };
  }).filter(l=>l.total>0);
  const mcuTotalPeserta = mcu.reduce((s,r)=>s+r.peserta,0);
  const mcuTotalNominal = mcu.reduce((s,r)=>s+r.total,0);

  // MCU: which names are linked to tabel utama
  const linkedNames = new Set(kunjungan.map(r=>r.namaPenjamin).filter(Boolean));

  const ActionButtons = () => (
    <div className="flex gap-1.5">
      <Button variant="outline" size="sm" className="h-7 text-xs px-2"
        onClick={openAdminSettings}>
        <Lock className="w-3 h-3 mr-1" /> Penjamin
      </Button>
      <Button variant="outline" size="sm" className="h-7 text-xs px-2"
        onClick={() => exportToExcel(tanggal, kunjungan, mcu)}>
        <Download className="w-3 h-3 mr-1" /> Export Excel
      </Button>
      <Button variant="outline" size="sm" className="h-7 text-xs px-2" onClick={handleReset}>
        <RotateCcw className="w-3 h-3 mr-1" /> Reset
      </Button>
      <Button size="sm" className="h-7 text-xs px-2 bg-[#1a3a5c] hover:bg-[#1a3a5c]/90 text-white"
        onClick={handleSubmit} disabled={submitting}>
        <Send className="w-3 h-3 mr-1" />{submitting?'Mengirim...':'Submit ke Sheets'}
      </Button>
    </div>
  );

  return (
    <>
      {showPinModal && (
        <PinModal
          onSuccess={() => { setShowPinModal(false); setShowSettings(true); }}
          onClose={() => setShowPinModal(false)}
        />
      )}
      {showSettings && (
        <SettingsModal
          list={allList} custom={custom}
          onAdd={addPenjamin} onRemove={removePenjamin}
          onClose={() => setShowSettings(false)} isBuiltin={isBuiltin}
        />
      )}

      <div className="space-y-3 page-transition">

        {/* Topbar */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-muted-foreground">Tanggal</label>
            <Input type="date" value={tanggal} onChange={e=>setTanggal(e.target.value)} className="w-36 text-xs h-7" />
          </div>
          <span className="text-[9px] text-muted-foreground flex items-center gap-1">
            <Save className="w-2.5 h-2.5" /> Draft tersimpan otomatis
          </span>
          <div className="ml-auto"><ActionButtons /></div>
        </div>

        {/* Summary */}
        <div className="card-clinical p-3 space-y-2">
          <h3 className="text-xs font-bold">Summary — {tanggal}</h3>
          <div className="flex gap-1.5 flex-wrap">
            <SummaryCard label="RJ A.Yani"   value={unitSummary.rj}    color="#2563eb" />
            <SummaryCard label="RI A.Yani"   value={unitSummary.ri}    color="#7c3aed" />
            <SummaryCard label="IGD"         value={unitSummary.igd}   color="#dc2626" />
            <SummaryCard label="MCU"         value={unitSummary.mcu}   color="#0891b2" sub={`${mcuTotalPeserta} peserta`} />
            <SummaryCard label="Grand Total" value={grandTotal}        color="#0a9e87" />
          </div>
          {labelSummary.length>0 && (
            <div className="overflow-x-auto">
              <table className="text-[10px] font-mono-data w-full" style={{ minWidth: `${labelSummary.length * 70 + 120}px` }}>
                <thead>
                  <tr className="border-b border-border">
                    <th className="py-1 text-left text-[9px] text-muted-foreground font-semibold pr-3 whitespace-nowrap">KUNJUNGAN</th>
                    {labelSummary.map(l=>(
                      <th key={l.label} className="py-1 text-center px-2 text-[9px]">
                        <span className={`font-bold px-1 py-0.5 rounded border ${labelClass(l.label)}`}>{l.label}</span>
                      </th>
                    ))}
                    <th className="py-1 text-right px-2 text-[9px] text-muted-foreground font-semibold">TOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  {([
                    { key: 'rj'  as const, label: 'RAWAT JALAN' },
                    { key: 'ri'  as const, label: 'RAWAT INAP' },
                    { key: 'igd' as const, label: 'IGD' },
                    { key: 'mcu' as const, label: 'MCU' },
                  ]).map(({ key, label }) => {
                    const rowTotal = labelSummary.reduce((s,l)=>s+l[key],0);
                    return (
                      <tr key={key} className="border-b border-border/20">
                        <td className="py-0.5 pr-3 text-[9px] text-muted-foreground whitespace-nowrap">{label}</td>
                        {labelSummary.map(l=>(
                          <td key={l.label} className="text-right px-2">{l[key]||'—'}</td>
                        ))}
                        <td className="text-right px-2 font-bold">{rowTotal||'—'}</td>
                      </tr>
                    );
                  })}
                  <tr className="border-t border-border">
                    <td className="py-0.5 pr-3 text-[9px] font-bold whitespace-nowrap">TOTAL</td>
                    {labelSummary.map(l=>(
                      <td key={l.label} className="text-right px-2 font-bold text-[#0a9e87]">{l.total||'—'}</td>
                    ))}
                    <td className="text-right px-2 font-bold text-[#0a9e87]">{labelSummary.reduce((s,l)=>s+l.total,0)||'—'}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Tabel Kunjungan */}
        <div className="card-clinical p-3 overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold">Kunjungan per Penjamin</h3>
            <span className="text-[9px] text-muted-foreground">{kunjungan.length} baris</span>
          </div>
          <div className="overflow-auto max-h-[480px]">
            <table className="w-full font-mono-data" style={{ minWidth:'820px', fontSize:'10px' }}>
              <thead className="sticky top-0 z-10 bg-muted">
                <tr className="bg-muted">
                  <th className="px-1 py-1.5 text-left w-6 text-[9px]">#</th>
                  <th className="px-1 py-1.5 text-left text-[9px]" style={{ minWidth:'200px' }}>NAMA PENJAMIN</th>
                  {KUNJUNGAN_COLS.map(c=>(
                    <th key={c.k} className={`px-1 py-1.5 text-center whitespace-nowrap text-[9px] ${c.readOnly?'bg-blue-50 text-blue-700':''}`}>
                      {c.l}
                      {c.readOnly && <span className="block text-[7px] text-blue-400 leading-none">auto</span>}
                    </th>
                  ))}
                  <th className="px-1 py-1.5 text-right font-bold text-[9px]">TOTAL</th>
                  <th className="w-6"/>
                </tr>
              </thead>
              <tbody>
                {kunjungan.map((row,i)=>{
                  const isEmpty = !row.namaPenjamin.trim();
                  const isValid = isEmpty || isPenjaminValid(row.namaPenjamin, BUILTIN_PENJAMIN, custom);
                  return (
                    <tr key={row.id} className={`border-t border-border/40 hover:bg-muted/20 ${!isValid ? 'bg-red-50/30' : ''}`}>
                      <td className="px-1 py-0.5 text-muted-foreground text-[9px]">{i+1}</td>
                      <td className={`px-0.5 py-0.5 ${!isValid && !isEmpty ? 'border-l-2 border-red-500' : ''}`}>
                        <PenjaminCombobox
                          value={row.namaPenjamin} badge={row.badge}
                          list={allList}
                          usedNames={usedNames.filter(n => n !== row.namaPenjamin)}
                          isDefault={DEFAULT_PENJAMIN_NAMES.has(row.namaPenjamin)}
                          isInvalid={!isValid && !isEmpty}
                          onSelect={(nama,badge) => selectPenjamin(row.id,nama,badge)}
                          onOpenSettings={openAdminSettings}
                        />
                      </td>
                      {KUNJUNGAN_COLS.map(c=>{
                        const isAuto = !!c.readOnly;
                        const val = (row as any)[c.k] as number;
                        return (
                          <td key={c.k} className={`px-0.5 py-0.5 ${isAuto?'bg-blue-50/40':''}`}>
                            {isAuto?(
                              <div className="h-6 w-11 flex items-center justify-center text-blue-700 font-bold text-[10px]">
                                {val>0?val:'—'}
                              </div>
                            ):(
                              <Input type="number" min={0}
                                value={val===0?'':val}
                                disabled={isEmpty || !isValid}
                                onChange={e=>updateKunjungan(row.id,c.k,e.target.value)}
                                onKeyDown={numericKeyDown}
                                className={`h-6 text-[10px] text-center w-11 px-0.5 ${isEmpty || !isValid?'opacity-40 cursor-not-allowed':''} ${!isValid && !isEmpty ? 'border-red-500' : ''}`}
                                placeholder="—" title={isEmpty?'Isi nama penjamin dulu': !isValid ? 'Nama penjamin tidak sesuai dengan list' : ''}
                              />
                            )}
                          </td>
                        );
                      })}
                      <td className="px-1 py-0.5 text-right font-bold text-[#0a9e87] text-[10px]">
                        {row.total>0?row.total:'—'}
                      </td>
                      <td className="px-0.5 py-0.5">
                        {!DEFAULT_PENJAMIN_NAMES.has(row.namaPenjamin) && (
                          <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-destructive"
                            onClick={()=>removeKunjunganRow(row.id)}>
                            <Trash2 className="w-2.5 h-2.5"/>
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                <tr className="border-t-2 border-border bg-muted/60 font-bold">
                  <td colSpan={2} className="px-1 py-1.5 text-right text-[9px] text-muted-foreground">TOTAL</td>
                  {colTotals.map(c=>(
                    <td key={c.k} className="px-1 py-1.5 text-center text-[10px] text-[#0a9e87]">
                      {c.total>0?c.total:'—'}
                    </td>
                  ))}
                  <td className="px-1 py-1.5 text-right text-[10px] text-[#0a9e87]">{grandTotal>0?grandTotal:'—'}</td>
                  <td/>
                </tr>
              </tbody>
            </table>
          </div>
          <Button variant="outline" size="sm" className="text-[10px] h-6 px-2 mt-2" onClick={addKunjunganRow}>
            <Plus className="w-2.5 h-2.5 mr-1"/> + Penjamin Baru
          </Button>
        </div>

        {/* Tabel MCU */}
        <div className="card-clinical p-3 overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="text-xs font-bold">MCU Harian</h3>
              <p className="text-[9px] text-muted-foreground">
                Peserta dijumlah per nama penjamin → otomatis masuk kolom MCU AUTO
              </p>
            </div>
            <span className="text-[9px] text-muted-foreground">{mcu.length} baris · {mcuTotalPeserta} peserta</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full font-mono-data" style={{ minWidth:'560px', fontSize:'10px' }}>
              <thead>
                <tr className="bg-muted">
                  <th className="px-1 py-1.5 text-left w-6 text-[9px]">#</th>
                  <th className="px-1 py-1.5 text-left text-[9px]" style={{ minWidth:'200px' }}>NAMA PENJAMIN</th>
                  <th className="px-1 py-1.5 text-left text-[9px]" style={{ minWidth:'80px' }}>PAKET</th>
                  <th className="px-1 py-1.5 text-center w-14 text-[9px]">PESERTA</th>
                  <th className="px-1 py-1.5 text-right w-32 text-[9px]">NOMINAL/ORG</th>
                  <th className="px-1 py-1.5 text-right w-32 text-[9px]">TOTAL</th>
                  <th className="px-1 py-1.5 text-center w-12 text-[9px]">LINK</th>
                  <th className="w-6"/>
                </tr>
              </thead>
              <tbody>
                {mcu.length===0 && (
                  <tr><td colSpan={8} className="px-2 py-6 text-center text-muted-foreground text-[10px]">
                    Belum ada data MCU — klik "+ Baris MCU"
                  </td></tr>
                )}
                {mcu.map((row,i)=>{
                  const isLinked = linkedNames.has(row.namaPenjamin);
                  return (
                    <tr key={row.id} className="border-t border-border/40 hover:bg-muted/20">
                      <td className="px-1 py-0.5 text-muted-foreground text-[9px]">{i+1}</td>
                      <td className="px-0.5 py-0.5">
                        <PenjaminCombobox
                          value={row.namaPenjamin} badge={''}
                          list={allList}
                          onSelect={(nama) => selectMcuPenjamin(row.id, nama)}
                          onOpenSettings={openAdminSettings}
                        />
                      </td>
                      <td className="px-0.5 py-0.5">
                        <Input value={row.paket} onChange={e=>updateMcu(row.id,'paket',e.target.value)}
                          className="h-6 text-[10px]" placeholder="Nama paket"/>
                      </td>
                      <td className="px-0.5 py-0.5">
                        <Input type="number" min={0} value={row.peserta||''}
                          onChange={e=>updateMcu(row.id,'peserta',e.target.value)}
                          onKeyDown={numericKeyDown}
                          className="h-6 text-[10px] text-center w-full" placeholder="0"/>
                      </td>
                      <td className="px-0.5 py-0.5">
                        <Input type="number" min={0} value={row.nominal||''}
                          onChange={e=>updateMcu(row.id,'nominal',e.target.value)}
                          onKeyDown={numericKeyDown}
                          className="h-6 text-[10px] text-right w-full" placeholder="0"/>
                      </td>
                      <td className="px-1 py-0.5 text-right font-bold text-[#0a9e87] text-[10px]">
                        {row.total>0?row.total.toLocaleString('id-ID'):'—'}
                      </td>
                      <td className="px-1 py-0.5 text-center">
                        {row.namaPenjamin && (
                          isLinked
                            ? <span className="text-[8px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-1 py-0.5 rounded">✓ linked</span>
                            : <span className="text-[8px] text-amber-600 bg-amber-50 border border-amber-200 px-1 py-0.5 rounded">not in tabel</span>
                        )}
                      </td>
                      <td className="px-0.5 py-0.5">
                        <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-destructive"
                          onClick={()=>removeMcuRow(row.id)}>
                          <Trash2 className="w-2.5 h-2.5"/>
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {mcu.length>0 && (
                  <tr className="border-t-2 border-border bg-muted/60 font-bold">
                    <td colSpan={3} className="px-1 py-1.5 text-right text-[9px] text-muted-foreground">TOTAL</td>
                    <td className="px-1 py-1.5 text-center text-[10px] text-[#0a9e87]">{mcuTotalPeserta}</td>
                    <td/>
                    <td className="px-1 py-1.5 text-right text-[10px] text-[#0a9e87]">{mcuTotalNominal.toLocaleString('id-ID')}</td>
                    <td/><td/>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Button variant="outline" size="sm" className="text-[10px] h-6 px-2 mt-2" onClick={addMcuRow}>
            <Plus className="w-2.5 h-2.5 mr-1"/> + Baris MCU
          </Button>
        </div>

        {/* Bottom */}
        <div className="flex justify-end gap-1.5 pt-2 border-t border-border">
          <ActionButtons/>
        </div>

      </div>
    </>
  );
}
