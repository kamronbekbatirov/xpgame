import pool from './database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function applyMigration() {
  try {
    console.log('📦 Applying shop migration...');
    
    const migrationPath = path.join(__dirname, 'migrations', 'add_shop_tables.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    await pool.query(sql);
    
    console.log('✅ Shop migration applied successfully!');
    
    // Проверяем, что таблицы созданы
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE '%shop%'
      ORDER BY table_name
    `);
    
    console.log('\n📋 Shop tables:');
    result.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });
    
    // Проверяем товары
    const items = await pool.query('SELECT COUNT(*) FROM shop_items');
    console.log(`\n🛍️  Shop items count: ${items.rows[0].count}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error applying migration:', error);
    process.exit(1);
  }
}

applyMigration();



