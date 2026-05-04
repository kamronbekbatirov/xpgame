import pool from './database.js';

async function checkShopItems() {
  try {
    console.log('🛍️  Checking shop items...\n');
    
    const result = await pool.query('SELECT * FROM shop_items ORDER BY xp_cost ASC');
    
    console.log(`Found ${result.rows.length} items:\n`);
    
    result.rows.forEach(item => {
      console.log(`${item.icon} ${item.name}`);
      console.log(`  Type: ${item.type}`);
      console.log(`  Cost: ${item.xp_cost} XP`);
      console.log(`  Effect: ${item.effect_type} = ${item.effect_value}`);
      console.log(`  Duration: ${item.duration_hours || 'N/A'} hours`);
      console.log(`  Active: ${item.is_active}`);
      console.log('');
    });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkShopItems();



