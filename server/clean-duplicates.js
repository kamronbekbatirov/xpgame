import pool from './database.js';

async function cleanDuplicates() {
  try {
    console.log('🧹 Cleaning duplicate shop items...\n');
    
    // Удаляем дубликаты, оставляя только записи с минимальным id
    const result = await pool.query(`
      DELETE FROM shop_items
      WHERE id NOT IN (
        SELECT MIN(id)
        FROM shop_items
        GROUP BY name, xp_cost, type
      )
    `);
    
    console.log(`✅ Deleted ${result.rowCount} duplicate items\n`);
    
    // Показываем оставшиеся товары
    const items = await pool.query('SELECT * FROM shop_items ORDER BY xp_cost ASC');
    
    console.log(`Remaining ${items.rows.length} items:\n`);
    items.rows.forEach(item => {
      console.log(`${item.icon} ${item.name} - ${item.xp_cost} XP`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

cleanDuplicates();



