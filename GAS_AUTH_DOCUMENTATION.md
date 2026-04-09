# Google Apps Script - Auth System Documentation

## Overview
Dokumentasi ini menjelaskan implementasi backend autentikasi menggunakan Google Apps Script (GAS) untuk Portal Lab RS Petrokimia Gresik.

## Setup

### 1. Buat Google Sheet "Users"
Buat sheet baru dengan nama **"Users"** dengan struktur kolom berikut:

| A | B | C | D | E | F | G | H |
|---|---|---|---|---|---|---|---|
| username | nama | passwordHash | salt | role | isActive | token | tokenExpiry |

**Deskripsi Kolom:**
- `username`: Username unik untuk login
- `nama`: Nama lengkap user
- `passwordHash`: Hash SHA-256 dari password + salt
- `salt`: Random string untuk hashing
- `role`: Role user (admin/petugas/viewer)
- `isActive`: Status aktif user (TRUE/FALSE)
- `token`: Session token (random UUID)
- `tokenExpiry`: Timestamp expiry token (milliseconds)

### 2. Deploy Google Apps Script

Buat file `Code.gs` di Google Apps Script dengan kode berikut:

```javascript
// ============================================
// PORTAL LAB - AUTH SYSTEM
// RS Petrokimia Gresik
// ============================================

const SHEET_NAME = 'Users';
const SESSION_DURATION = 4 * 60 * 60 * 1000; // 4 jam dalam ms

// ─── Helper Functions ───

function hashPassword(password, salt) {
  const raw = salt + password;
  const hash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw);
  return hash.map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
}

function generateSalt() {
  return Utilities.getUuid().replace(/-/g, '').slice(0, 16);
}

function generateToken() {
  return Utilities.getUuid() + '-' + Utilities.getUuid();
}

function getSheet() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
}

function findUserByUsername(username) {
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === username) {
      return {
        row: i + 1,
        username: data[i][0],
        nama: data[i][1],
        passwordHash: data[i][2],
        salt: data[i][3],
        role: data[i][4],
        isActive: data[i][5],
        token: data[i][6],
        tokenExpiry: data[i][7]
      };
    }
  }
  return null;
}

function findUserByToken(token) {
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][6] === token) {
      return {
        row: i + 1,
        username: data[i][0],
        nama: data[i][1],
        passwordHash: data[i][2],
        salt: data[i][3],
        role: data[i][4],
        isActive: data[i][5],
        token: data[i][6],
        tokenExpiry: data[i][7]
      };
    }
  }
  return null;
}

function validateAdmin(token) {
  const user = findUserByToken(token);
  if (!user || !user.isActive) return false;
  if (user.tokenExpiry < Date.now()) return false;
  return user.role === 'admin';
}

// ─── Main Handler ───

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    
    switch (action) {
      case 'login':
        return handleLogin(data);
      case 'logout':
        return handleLogout(data);
      case 'validateToken':
        return handleValidateToken(data);
      case 'getUsers':
        return handleGetUsers(data);
      case 'createUser':
        return handleCreateUser(data);
      case 'updateUser':
        return handleUpdateUser(data);
      case 'resetPassword':
        return handleResetPassword(data);
      case 'deleteUser':
        return handleDeleteUser(data);
      default:
        return ContentService.createTextOutput(JSON.stringify({
          success: false,
          message: 'Invalid action'
        })).setMimeType(ContentService.MimeType.JSON);
    }
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ─── Action Handlers ───

function handleLogin(data) {
  const { username, password } = data;
  
  const user = findUserByUsername(username);
  if (!user) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: 'Username atau password salah'
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  if (!user.isActive) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: 'User tidak aktif'
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  // Verify password
  const hash = hashPassword(password, user.salt);
  if (hash !== user.passwordHash) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: 'Username atau password salah'
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  // Generate token
  const token = generateToken();
  const tokenExpiry = Date.now() + SESSION_DURATION;
  
  // Update token in sheet
  const sheet = getSheet();
  sheet.getRange(user.row, 7).setValue(token);
  sheet.getRange(user.row, 8).setValue(tokenExpiry);
  
  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    user: {
      username: user.username,
      nama: user.nama,
      role: user.role,
      token: token
    }
  })).setMimeType(ContentService.MimeType.JSON);
}

function handleLogout(data) {
  const { token } = data;
  
  const user = findUserByToken(token);
  if (user) {
    const sheet = getSheet();
    sheet.getRange(user.row, 7).setValue('');
    sheet.getRange(user.row, 8).setValue('');
  }
  
  return ContentService.createTextOutput(JSON.stringify({
    success: true
  })).setMimeType(ContentService.MimeType.JSON);
}

function handleValidateToken(data) {
  const { token } = data;
  
  const user = findUserByToken(token);
  if (!user || !user.isActive) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: 'Token tidak valid'
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  if (user.tokenExpiry < Date.now()) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: 'Token expired'
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    user: {
      username: user.username,
      nama: user.nama,
      role: user.role,
      token: user.token
    }
  })).setMimeType(ContentService.MimeType.JSON);
}

function handleGetUsers(data) {
  const { token } = data;
  
  if (!validateAdmin(token)) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: 'Unauthorized'
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  const sheet = getSheet();
  const data_rows = sheet.getDataRange().getValues();
  const users = [];
  
  for (let i = 1; i < data_rows.length; i++) {
    users.push({
      username: data_rows[i][0],
      nama: data_rows[i][1],
      role: data_rows[i][4],
      isActive: data_rows[i][5]
    });
  }
  
  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    users: users
  })).setMimeType(ContentService.MimeType.JSON);
}

function handleCreateUser(data) {
  const { token, username, nama, password, role } = data;
  
  if (!validateAdmin(token)) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: 'Unauthorized'
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  // Check if username exists
  if (findUserByUsername(username)) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: 'Username sudah digunakan'
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  // Generate salt and hash password
  const salt = generateSalt();
  const passwordHash = hashPassword(password, salt);
  
  // Add to sheet
  const sheet = getSheet();
  sheet.appendRow([username, nama, passwordHash, salt, role, true, '', '']);
  
  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    message: 'User berhasil dibuat'
  })).setMimeType(ContentService.MimeType.JSON);
}

function handleUpdateUser(data) {
  const { token, username, nama, role, isActive } = data;
  
  if (!validateAdmin(token)) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: 'Unauthorized'
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  const user = findUserByUsername(username);
  if (!user) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: 'User tidak ditemukan'
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  const sheet = getSheet();
  if (nama !== undefined) sheet.getRange(user.row, 2).setValue(nama);
  if (role !== undefined) sheet.getRange(user.row, 5).setValue(role);
  if (isActive !== undefined) sheet.getRange(user.row, 6).setValue(isActive);
  
  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    message: 'User berhasil diupdate'
  })).setMimeType(ContentService.MimeType.JSON);
}

function handleResetPassword(data) {
  const { token, username, newPassword } = data;
  
  if (!validateAdmin(token)) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: 'Unauthorized'
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  const user = findUserByUsername(username);
  if (!user) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: 'User tidak ditemukan'
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  // Generate new salt and hash
  const salt = generateSalt();
  const passwordHash = hashPassword(newPassword, salt);
  
  const sheet = getSheet();
  sheet.getRange(user.row, 3).setValue(passwordHash);
  sheet.getRange(user.row, 4).setValue(salt);
  
  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    message: 'Password berhasil direset'
  })).setMimeType(ContentService.MimeType.JSON);
}

function handleDeleteUser(data) {
  const { token, username } = data;
  
  if (!validateAdmin(token)) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: 'Unauthorized'
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  const user = findUserByUsername(username);
  if (!user) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: 'User tidak ditemukan'
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  // Set isActive to false instead of deleting
  const sheet = getSheet();
  sheet.getRange(user.row, 6).setValue(false);
  
  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    message: 'User berhasil dihapus'
  })).setMimeType(ContentService.MimeType.JSON);
}

// ─── Init Admin Function (Run once manually) ───

function initAdmin() {
  const sheet = getSheet();
  
  // Check if admin already exists
  if (findUserByUsername('admin')) {
    Logger.log('Admin user already exists');
    return;
  }
  
  // Create default admin
  const username = 'admin';
  const nama = 'Administrator';
  const password = 'admin123'; // CHANGE THIS!
  const role = 'admin';
  
  const salt = generateSalt();
  const passwordHash = hashPassword(password, salt);
  
  sheet.appendRow([username, nama, passwordHash, salt, role, true, '', '']);
  
  Logger.log('Admin user created successfully');
  Logger.log('Username: admin');
  Logger.log('Password: admin123');
  Logger.log('PLEASE CHANGE THE PASSWORD IMMEDIATELY!');
}
```

### 3. Deploy as Web App

1. Di Google Apps Script editor, klik **Deploy** > **New deployment**
2. Pilih type: **Web app**
3. Settings:
   - Execute as: **Me**
   - Who has access: **Anyone** (karena akan diakses dari web app)
4. Klik **Deploy**
5. Copy **Web app URL** yang diberikan
6. Simpan URL tersebut di localStorage browser dengan key `gs-url-auth`

### 4. Inisialisasi Admin User

1. Di Google Apps Script editor, pilih function `initAdmin` dari dropdown
2. Klik **Run**
3. Authorize script jika diminta
4. Check log untuk konfirmasi admin user berhasil dibuat
5. **PENTING**: Login dan ubah password default segera!

## API Endpoints

Semua request menggunakan method **POST** dengan Content-Type `application/json`.

### 1. Login
```json
{
  "action": "login",
  "username": "admin",
  "password": "password123"
}
```

**Response Success:**
```json
{
  "success": true,
  "user": {
    "username": "admin",
    "nama": "Administrator",
    "role": "admin",
    "token": "uuid-token-here"
  }
}
```

**Response Failed:**
```json
{
  "success": false,
  "message": "Username atau password salah"
}
```

### 2. Logout
```json
{
  "action": "logout",
  "token": "user-token"
}
```

**Response:**
```json
{
  "success": true
}
```

### 3. Validate Token
```json
{
  "action": "validateToken",
  "token": "user-token"
}
```

**Response Success:**
```json
{
  "success": true,
  "user": {
    "username": "admin",
    "nama": "Administrator",
    "role": "admin",
    "token": "uuid-token-here"
  }
}
```

### 4. Get Users (Admin Only)
```json
{
  "action": "getUsers",
  "token": "admin-token"
}
```

**Response:**
```json
{
  "success": true,
  "users": [
    {
      "username": "admin",
      "nama": "Administrator",
      "role": "admin",
      "isActive": true
    },
    {
      "username": "petugas1",
      "nama": "Petugas Lab 1",
      "role": "petugas",
      "isActive": true
    }
  ]
}
```

### 5. Create User (Admin Only)
```json
{
  "action": "createUser",
  "token": "admin-token",
  "username": "newuser",
  "nama": "New User",
  "password": "password123",
  "role": "petugas"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User berhasil dibuat"
}
```

### 6. Update User (Admin Only)
```json
{
  "action": "updateUser",
  "token": "admin-token",
  "username": "existinguser",
  "nama": "Updated Name",
  "role": "viewer",
  "isActive": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "User berhasil diupdate"
}
```

### 7. Reset Password (Admin Only)
```json
{
  "action": "resetPassword",
  "token": "admin-token",
  "username": "targetuser",
  "newPassword": "newpassword123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Password berhasil direset"
}
```

### 8. Delete User (Admin Only)
```json
{
  "action": "deleteUser",
  "token": "admin-token",
  "username": "targetuser"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User berhasil dihapus"
}
```

## Security Features

1. **Password Hashing**: Password di-hash menggunakan SHA-256 dengan salt unik per user
2. **Session Token**: Random UUID token untuk setiap session
3. **Token Expiry**: Session otomatis expired setelah 4 jam
4. **Role-Based Access**: Endpoint admin hanya bisa diakses oleh user dengan role admin
5. **Soft Delete**: User yang dihapus hanya di-set `isActive = false`, tidak dihapus permanent

## Frontend Configuration

Di browser console atau localStorage manager, set URL GAS:

```javascript
localStorage.setItem('gs-url-auth', 'https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec');
```

## Testing

1. Buat admin user dengan function `initAdmin()`
2. Test login dari frontend dengan username `admin` dan password `admin123`
3. Ubah password admin segera setelah login pertama
4. Buat user baru dengan role berbeda untuk testing
5. Test semua fitur: login, logout, create user, update user, reset password, delete user

## Troubleshooting

**Error: "Script function not found"**
- Pastikan function `doPost` ada di Code.gs
- Re-deploy web app

**Error: "Unauthorized"**
- Token expired atau tidak valid
- Login ulang untuk mendapatkan token baru

**Error: "Username sudah digunakan"**
- Username harus unik
- Gunakan username lain

**Session expired terlalu cepat**
- Check `SESSION_DURATION` di script (default 4 jam)
- Adjust sesuai kebutuhan

## Maintenance

- Backup sheet Users secara berkala
- Monitor log di Apps Script untuk error
- Review user list secara periodik
- Hapus token expired secara manual jika perlu (kolom G & H)
