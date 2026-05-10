#!/usr/bin/env node

/**
 * Seed users from petugas_laborat.xlsx to Supabase local database.
 * 
 * Reads Excel file, generates bcrypt hashes for passwords (case-insensitive),
 * and inserts all users into the profiles table.
 */

const XLSX = require('xlsx');
const bcrypt = require('bcryptjs');
const { execSync } = require('child_process');
const path = require('path');

const EXCEL_PATH = '/Users/rama/Downloads/petugas_laborat.xlsx';
const SALT_ROUNDS = 10;

// Role mapping from Excel to DB
const ROLE_MAP = {
  'ADMIN': 'admin',
  'PETUGAS': 'petugas',
  'VIEWER': 'viewer',
};

async function main() {
  console.log('📖 Reading Excel file...');
  const wb = XLSX.readFile(EXCEL_PATH);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

  // Skip header row
  const dataRows = rows.slice(1);
  
  console.log(`Found ${dataRows.length} users in Excel\n`);

  const users = [];
  
  for (const row of dataRows) {
    const [nama, nik, username, password, excelRole] = row;
    
    if (!username || !password || !excelRole) {
      console.warn(`⚠️  Skipping incomplete row: ${JSON.stringify(row)}`);
      continue;
    }

    const role = ROLE_MAP[excelRole.toUpperCase()];
    if (!role) {
      console.warn(`⚠️  Unknown role "${excelRole}" for user ${username}, skipping`);
      continue;
    }

    // Lowercase password for case-insensitive login
    const passwordLower = password.toString().toLowerCase();
    
    // Generate bcrypt hash
    const passwordHash = await bcrypt.hash(passwordLower, SALT_ROUNDS);
    
    users.push({
      username: username.toString().toLowerCase(), // lowercase username too
      nama: nama || username,
      role,
      passwordHash,
      isActive: true,
    });

    console.log(`✓ ${username.toString().toLowerCase()} (${role}) — password: ${password} → hashed`);
  }

  console.log(`\n📝 Generating SQL for ${users.length} users...\n`);

  // Generate SQL INSERT statements
  const sqlStatements = users.map(u => {
    const username = u.username.replace(/'/g, "''"); // escape single quotes
    const nama = u.nama.replace(/'/g, "''");
    const hash = u.passwordHash.replace(/'/g, "''");
    
    return `INSERT INTO profiles (username, nama, role, password_hash, is_active) VALUES ('${username}', '${nama}', '${u.role}', '${hash}', ${u.isActive});`;
  });

  const fullSQL = sqlStatements.join('\n');

  // Write SQL to temp file
  const sqlPath = '/tmp/seed-users.sql';
  require('fs').writeFileSync(sqlPath, fullSQL);

  console.log(`💾 SQL written to ${sqlPath}\n`);
  console.log('🚀 Executing SQL via Supabase CLI...\n');

  // Execute SQL via psql (Supabase local DB)
  try {
    const output = execSync(`psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -f ${sqlPath}`, {
      cwd: path.join(__dirname, '..'),
      encoding: 'utf-8',
    });
    console.log(output);
    console.log('✅ All users seeded successfully!\n');
  } catch (error) {
    console.error('❌ Error executing SQL:', error.message);
    console.error('\nSQL content:');
    console.error(fullSQL);
    process.exit(1);
  }

  // Print summary
  console.log('📊 Summary:');
  console.log(`   Total users: ${users.length}`);
  console.log(`   Admin: ${users.filter(u => u.role === 'admin').length}`);
  console.log(`   Petugas: ${users.filter(u => u.role === 'petugas').length}`);
  console.log(`   Viewer: ${users.filter(u => u.role === 'viewer').length}`);
  console.log('\n🎉 Done! You can now login with any user from the Excel file.');
  console.log('   Example: username=lina, password=09164 (or 09164 — case-insensitive)');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
