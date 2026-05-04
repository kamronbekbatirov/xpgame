import pool from './database.js';

async function checkTables() {
  try {
    console.log('📋 Checking all tables...\n');
    
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    console.log('All tables:');
    result.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });
    
    // Проверяем специфичные таблицы
    const tables = ['shop_items', 'user_purchases', 'user_active_boosters'];
    
    console.log('\n🔍 Checking shop tables:');
    for (const table of tables) {
      try {
        const count = await pool.query(`SELECT COUNT(*) FROM ${table}`);
        console.log(`  ✅ ${table}: ${count.rows[0].count} rows`);
      } catch (error) {
        console.log(`  ❌ ${table}: NOT FOUND`);
      }
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkTables();



