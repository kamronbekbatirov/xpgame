import pool from './database.js';

async function clearAllUsers() {
  const client = await pool.connect();
  try {
    console.log('🗑️  Начинаю очистку базы данных...');
    
    await client.query('DELETE FROM user_active_boosters');
    console.log('✓ Удалены активные бустеры');
    
    await client.query('DELETE FROM user_purchases');
    console.log('✓ Удалены покупки');
    
    await client.query('DELETE FROM user_personal_rewards');
    console.log('✓ Удалены персональные награды');
    
    await client.query('DELETE FROM user_daily_motivation');
    console.log('✓ Удалена мотивация дня');
    
    await client.query('DELETE FROM budget_subscriptions');
    console.log('✓ Удалены подписки');
    
    await client.query('DELETE FROM budget_expenses');
    console.log('✓ Удалены расходы');
    
    await client.query('DELETE FROM budget_incomes');
    console.log('✓ Удалены доходы');
    
    await client.query('DELETE FROM xp_history');
    console.log('✓ Удалена история XP');
    
    await client.query('DELETE FROM tasks');
    console.log('✓ Удалены задачи');
    
    await client.query('DELETE FROM weaknesses');
    console.log('✓ Удалены слабости');
    
    await client.query('DELETE FROM goals');
    console.log('✓ Удалены цели');
    
    await client.query('DELETE FROM user_achievements');
    console.log('✓ Удалены достижения');
    
    // conversation_context не существует, пропускаем
    
    await client.query('DELETE FROM users');
    console.log('✓ Удалены пользователи');
    
    console.log('\n✅ Все пользователи и связанные данные успешно удалены!');
    console.log('🎉 Можете проходить онбординг заново!');
  } catch (error) {
    console.error('❌ Ошибка при очистке БД:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

clearAllUsers();

