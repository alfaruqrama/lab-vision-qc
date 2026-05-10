#!/usr/bin/env node
/**
 * Seed default lot configuration to Supabase
 * 
 * Usage: node scripts/seed-lot-config.cjs
 */

const { createClient } = require('@supabase/supabase-js');

// Supabase config
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH';

// Rama user ID (from profiles table)
const RAMA_USER_ID = 'ba98d317-ae71-4138-9df8-07cf0480bd7d';

// Default lot configuration (from mock-data.ts)
const DEFAULT_LOT_CONFIG = {
  CA660: [
    {
      lot: 'CA-2024-001',
      exp: '2026-12-31',
      Kontrol: {
        PT: { mean: 12.5, sd: 0.3 },
        APTT: { mean: 32.0, sd: 1.5 },
        INR: { mean: 1.0, sd: 0.05 },
      },
    },
  ],
  EASYLITE: [
    {
      lot: 'EL-2024-001',
      exp: '2026-09-30',
      NORMAL: {
        Na: { mean: 140, sd: 2 },
        K: { mean: 4.0, sd: 0.2 },
        Cl: { mean: 100, sd: 2 },
      },
      HIGH: {
        Na: { mean: 155, sd: 2 },
        K: { mean: 6.5, sd: 0.3 },
        Cl: { mean: 115, sd: 2 },
      },
    },
  ],
  ONCALL1: [
    {
      lot: '1790338',
      exp: '2026-05-28',
      CTRL0: { GDA: { mean: 47, sd: 7.5 } },
      CTRL1: { GDA: { mean: 134, sd: 13.5 } },
      CTRL2: { GDA: { mean: 364, sd: 36.5 } },
    },
  ],
  ONCALL2: [
    {
      lot: '1790338',
      exp: '2026-05-28',
      CTRL0: { GDA: { mean: 47, sd: 7.5 } },
      CTRL1: { GDA: { mean: 134, sd: 13.5 } },
      CTRL2: { GDA: { mean: 364, sd: 36.5 } },
    },
  ],
};

async function main() {
  console.log('🔧 Seeding Default Lot Configuration\n');

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // Check if config already exists
  const { data: existing, error: checkError } = await supabase
    .from('lot_config')
    .select('id')
    .limit(1);

  if (checkError) {
    console.error('❌ Error checking existing config:', checkError.message);
    process.exit(1);
  }

  if (existing && existing.length > 0) {
    console.log('⚠️  Lot config already exists (found', existing.length, 'row(s))');
    console.log('   Skipping seed to avoid duplicates.\n');
    console.log('   To re-seed, delete existing config first:');
    console.log('   DELETE FROM lot_config;\n');
    process.exit(0);
  }

  // Insert default config
  console.log('📝 Inserting default lot config...');
  console.log('   - CA660: 1 lot');
  console.log('   - EASYLITE: 1 lot (NORMAL + HIGH)');
  console.log('   - ONCALL1: 1 lot (CTRL0 + CTRL1 + CTRL2)');
  console.log('   - ONCALL2: 1 lot (CTRL0 + CTRL1 + CTRL2)\n');

  const { data, error } = await supabase
    .from('lot_config')
    .insert({
      config: DEFAULT_LOT_CONFIG,
      updated_at: new Date().toISOString(),
      updated_by: RAMA_USER_ID,
    })
    .select();

  if (error) {
    console.error('❌ Error inserting config:', error.message);
    process.exit(1);
  }

  console.log('✅ Lot config seeded successfully!');
  console.log('   ID:', data[0].id);
  console.log('   Updated by: rama (', RAMA_USER_ID, ')');
  console.log('   Updated at:', data[0].updated_at, '\n');

  console.log('🔍 Verify in Supabase Studio:');
  console.log('   http://127.0.0.1:54323/project/default/editor/lot_config\n');
}

main().catch(console.error);
