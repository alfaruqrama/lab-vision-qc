-- 008: Tambah kolom `extra jsonb` ke module_config
-- Digunakan untuk menyimpan config khusus per modul (misal: layout section laporan)
-- Key `/kunjungan/laporan` akan menyimpan struktur section order, hidden, labels, custom sections

alter table module_config add column if not exists extra jsonb;
