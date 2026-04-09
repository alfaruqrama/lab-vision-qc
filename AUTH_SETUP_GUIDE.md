# Portal Lab - Auth System Setup Guide

## Implementasi Selesai ✅

Sistem autentikasi lengkap telah diimplementasikan dengan fitur:

### Frontend
- ✅ Login page dengan UI minimalis
- ✅ Protected routes dengan role-based access
- ✅ Session management (4 jam auto-expire)
- ✅ User info & logout di navbar
- ✅ Admin panel untuk kelola user
- ✅ Filter menu berdasarkan role
- ✅ Auto-redirect saat session expired

### Backend (Google Apps Script)
- ✅ Password hashing dengan SHA-256 + salt
- ✅ Session token management
- ✅ Role-based authorization
- ✅ CRUD operations untuk user management

## Setup Instructions

### 1. Setup Google Apps Script Backend

1. Buka Google Sheets dan buat sheet baru bernama **"Users"**
2. Tambahkan header kolom di row 1:
   ```
   username | nama | passwordHash | salt | role | isActive | token | tokenExpiry
   ```
3. Buka **Extensions** > **Apps Script**
4. Copy semua kode dari file `GAS_AUTH_DOCUMENTATION.md` bagian "Deploy Google Apps Script"
5. Paste ke `Code.gs`
6. Jalankan function `initAdmin()` untuk membuat admin default:
   - Pilih `initAdmin` dari dropdown function
   - Klik **Run**
   - Authorize jika diminta
   - Check log untuk konfirmasi
7. Deploy as Web App:
   - Klik **Deploy** > **New deployment**
   - Type: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Klik **Deploy**
   - Copy **Web app URL**

### 2. Configure Frontend

1. Buka aplikasi di browser
2. Buka Developer Console (F12)
3. Set URL GAS di localStorage:
   ```javascript
   localStorage.setItem('gs-url-auth', 'YOUR_GAS_WEB_APP_URL_HERE');
   ```
4. Refresh halaman

### 3. First Login

1. Buka `/login`
2. Login dengan kredensial default:
   - Username: `admin`
   - Password: `admin123`
3. **PENTING**: Segera ubah password admin setelah login pertama!

### 4. Kelola User

1. Login sebagai admin
2. Klik menu **"Kelola User"** di home page
3. Tambah user baru dengan role:
   - **Admin**: Full access, bisa kelola user
   - **Petugas**: Bisa input data, tidak bisa kelola user
   - **Viewer**: Hanya bisa lihat dashboard/chart, tidak bisa input

## Role Permissions

### Admin
- ✅ Dashboard Kunjungan (view + input)
- ✅ Monitor Suhu (view)
- ✅ Lab QC (view + input)
- ✅ Kelola User

### Petugas
- ✅ Dashboard Kunjungan (view + input)
- ✅ Monitor Suhu (view)
- ✅ Lab QC (view + input)
- ❌ Kelola User

### Viewer
- ✅ Dashboard Kunjungan (view only)
- ✅ Monitor Suhu (view)
- ✅ Lab QC (view only)
- ❌ Input Harian
- ❌ Input QC
- ❌ Kelola User

## File Structure

```
src/
├── lib/
│   ├── auth-types.ts          # Type definitions
│   └── auth-api.ts            # API functions
├── hooks/
│   └── use-auth.tsx           # Auth context & provider
├── components/
│   └── layout/
│       └── ProtectedRoute.tsx # Route guard
├── pages/
│   ├── LoginPage.tsx          # Login page
│   └── AdminUserPanel.tsx     # User management
└── App.tsx                    # Routes with auth
```

## Security Features

1. **Password Hashing**: SHA-256 dengan salt unik per user
2. **Session Token**: Random UUID untuk setiap session
3. **Auto Expiry**: Session otomatis expired setelah 4 jam
4. **Role-Based Access**: Endpoint dan UI difilter berdasarkan role
5. **Soft Delete**: User yang dihapus hanya di-set inactive

## Testing Checklist

- [ ] Login dengan admin berhasil
- [ ] Session expired setelah 4 jam
- [ ] Logout berhasil clear session
- [ ] Buat user baru (admin, petugas, viewer)
- [ ] Edit user berhasil
- [ ] Reset password berhasil
- [ ] Delete user berhasil (soft delete)
- [ ] Viewer tidak bisa akses Input Harian
- [ ] Viewer tidak bisa akses Input QC
- [ ] Petugas tidak bisa akses Kelola User
- [ ] Menu difilter sesuai role
- [ ] Auto-redirect ke login saat session expired

## Troubleshooting

### "URL GAS auth belum dikonfigurasi"
- Set `gs-url-auth` di localStorage dengan URL GAS yang benar

### "Username atau password salah"
- Pastikan kredensial benar
- Check sheet Users di Google Sheets
- Pastikan user isActive = TRUE

### "Akses ditolak"
- User tidak memiliki permission untuk halaman tersebut
- Check role user di Admin Panel

### Session expired terlalu cepat
- Default 4 jam, bisa diubah di `auth-types.ts` (SESSION_DURATION)
- Juga ubah di GAS `Code.gs` (SESSION_DURATION)

## Next Steps

1. Ubah password admin default
2. Buat user untuk testing dengan role berbeda
3. Test semua fitur dengan role yang berbeda
4. Setup backup untuk sheet Users
5. Monitor log di Apps Script untuk error

## Documentation

Dokumentasi lengkap Google Apps Script ada di file:
- `GAS_AUTH_DOCUMENTATION.md`

Dokumentasi ini mencakup:
- Setup lengkap GAS
- Struktur sheet Users
- API endpoints
- Security features
- Testing guide
- Troubleshooting

---

**Portal Lab RS Petrokimia Gresik**  
Auth System v1.0 - 2026
