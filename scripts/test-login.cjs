#!/usr/bin/env node

/**
 * Test login functionality with Supabase backend.
 * Tests case-insensitive password login.
 */

const bcrypt = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'http://127.0.0.1:54321';
const SUPABASE_ANON_KEY = 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testLogin(username, password) {
  console.log(`\n🔐 Testing login: ${username} / ${password}`);
  
  try {
    // Query user by username
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, username, nama, role, password_hash, is_active')
      .eq('username', username)
      .single();

    if (profileError || !profile) {
      console.log('❌ User not found');
      if (profileError) console.log('   Error:', profileError.message, profileError.code);
      return false;
    }

    if (!profile.is_active) {
      console.log('❌ User not active');
      return false;
    }

    // Verify password (case-insensitive)
    const passwordMatch = await bcrypt.compare(password.toLowerCase(), profile.password_hash);
    
    if (!passwordMatch) {
      console.log('❌ Password mismatch');
      return false;
    }

    console.log(`✅ Login successful!`);
    console.log(`   ID: ${profile.id}`);
    console.log(`   Name: ${profile.nama}`);
    console.log(`   Role: ${profile.role}`);
    return true;
  } catch (error) {
    console.error('❌ Error:', error.message);
    return false;
  }
}

async function main() {
  console.log('🧪 Testing Supabase Auth Integration\n');
  console.log('=' .repeat(50));

  const tests = [
    // Test case-insensitive password
    { username: 'lina', password: '09164', expected: true },
    { username: 'lina', password: '09164', expected: true }, // uppercase NIK
    
    // Test admin user
    { username: 'admin', password: 'admin123', expected: true },
    { username: 'admin', password: 'ADMIN123', expected: true }, // uppercase
    
    // Test petugas
    { username: 'rama', password: '21241', expected: true },
    
    // Test viewer
    { username: 'viewer', password: 'viewer', expected: true },
    { username: 'viewer', password: 'VIEWER', expected: true },
    
    // Test wrong password
    { username: 'lina', password: 'wrong', expected: false },
    
    // Test non-existent user
    { username: 'nonexistent', password: 'test', expected: false },
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    const result = await testLogin(test.username, test.password);
    
    if (result === test.expected) {
      passed++;
    } else {
      failed++;
      console.log(`   ⚠️  Expected ${test.expected}, got ${result}`);
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
  
  if (failed === 0) {
    console.log('\n🎉 All tests passed!');
  } else {
    console.log('\n❌ Some tests failed');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
