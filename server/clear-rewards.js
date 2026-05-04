import pool from './database.js';

async function clearRewards() {
  try {
    await pool.query('DELETE FROM user_personal_rewards');
    console.log('✓ Персональные награды очищены');
    
    await pool.query('DELETE FROM user_purchases');
    console.log('✓ Покупки очищены');
    
    await pool.query("DELETE FROM shop_items WHERE type = 'reward'");
    console.log('✓ Награды из магазина удалены');
    
    console.log('\n✅ Кэш наград полностью очищен!');
  } catch (error) {
    console.error('❌ Ошибка:', error);
  } finally {
    await pool.end();
  }
}

clearRewards();


