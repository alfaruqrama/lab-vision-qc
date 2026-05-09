# Portal Lab Internal — RS Petrokimia Gresik

Sistem informasi laboratorium terintegrasi untuk Pemantapan Mutu Internal (PMI), monitoring suhu, dan manajemen operasional laboratorium.

> Integrated laboratory information system for Internal Quality Assurance, temperature monitoring, and lab operations management.

---

## Fitur / Features

| Modul | Deskripsi | Description |
|-------|-----------|-------------|
| QC / PMI | Input kontrol harian, grafik Levey-Jennings, laporan bulanan | Daily QC input, L-J charts, monthly reports |
| Monitor Suhu | Pemantauan suhu peralatan laboratorium | Equipment temperature monitoring |
| Kunjungan | Dashboard statistik kunjungan pasien | Patient visit statistics dashboard |
| TCM Form | Formulir pengiriman spesimen (akses publik) | Specimen submission form (public access) |
| Admin | Manajemen user & role-based access | User & role management |

## Tech Stack

- React 18 · TypeScript · Vite
- Tailwind CSS · shadcn/ui
- Recharts · React Query
- XLSX & DOCX export
- Vercel (deployment)

## Getting Started

### Prerequisites

- Node.js >= 18
- Bun (recommended) atau npm

### Install & Run

```sh
# Clone repository
git clone <repository-url>
cd lab-vision-qc

# Install dependencies
bun install
# atau: npm install

# Jalankan development server
bun dev
# atau: npm run dev
```

Aplikasi akan berjalan di `http://localhost:5173`

## Project Structure

```
src/
├── components/     # UI components (shadcn/ui + custom)
├── hooks/          # Custom hooks (auth, QC store, suhu, theme)
├── lib/            # Utilities & API layer
├── pages/          # Route pages
└── main.tsx        # Entry point
public/
├── favicon.ico
└── manifest.json
```

## Scripts

| Command | Keterangan |
|---------|------------|
| `bun dev` | Development server |
| `bun run build` | Production build |
| `bun run test` | Run unit tests |
| `bun run lint` | ESLint check |

## Deployment

Deploy otomatis via Vercel. Setiap push ke branch `main` akan trigger production build.

## License

Internal use only — RS Petrokimia Gresik

---

Dikembangkan untuk Unit Laboratorium RS Petrokimia Gresik.
