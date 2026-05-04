import pool from './database.js';

class ShopService {
  /**
   * Получить кэшированные персональные награды пользователя
   */
  async getCachedPersonalRewards(userId) {
    try {
      const result = await pool.query(
        `SELECT id, name, description, xp_cost, icon
         FROM user_personal_rewards
         WHERE user_id = $1 AND expires_at > NOW()
         ORDER BY xp_cost ASC`,
        [userId]
      );
      console.log(`[SHOP_SERVICE] Found ${result.rows.length} cached rewards for user ${userId}`);
      return result.rows;
    } catch (error) {
      console.error('[SHOP_SERVICE] Error getting cached personal rewards:', error);
      return [];
    }
  }

  /**
   * Сохранить персональные награды в кэш
   */
  async cachePersonalRewards(userId, rewards) {
    try {
      console.log(`[SHOP_SERVICE] Caching ${rewards.length} rewards for user ${userId}`);
      
      // Удаляем старые награды пользователя
      const deleteResult = await pool.query('DELETE FROM user_personal_rewards WHERE user_id = $1', [userId]);
      console.log(`[SHOP_SERVICE] Deleted ${deleteResult.rowCount} old rewards`);
      
      // Добавляем новые
      for (const reward of rewards) {
        await pool.query(
          `INSERT INTO user_personal_rewards (user_id, name, description, xp_cost, icon)
           VALUES ($1, $2, $3, $4, $5)`,
          [userId, reward.name, reward.description, reward.xp_cost, reward.icon]
        );
      }
      
      console.log(`[SHOP_SERVICE] ✓ Successfully cached ${rewards.length} rewards`);
      return true;
    } catch (error) {
      console.error('[SHOP_SERVICE] Error caching personal rewards:', error);
      throw error;
    }
  }

  /**
   * Получить все доступные товары магазина
   */
  async getShopItems(type = null) {
    try {
      let query = 'SELECT * FROM shop_items WHERE is_active = true';
      const params = [];
      
      if (type) {
        query += ' AND type = $1';
        params.push(type);
      }
      
      query += ' ORDER BY xp_cost ASC';
      
      const result = await pool.query(query, params);
      return result.rows.map(item => ({
        ...item,
        effect_value: typeof item.effect_value === 'string' 
          ? JSON.parse(item.effect_value) 
          : item.effect_value
      }));
    } catch (error) {
      console.error('Error getting shop items:', error);
      throw error;
    }
  }

  /**
   * Получить активные бустеры пользователя
   */
  async getUserActiveBoosters(userId) {
    try {
      // Сначала очищаем истекшие бустеры
      await pool.query('SELECT cleanup_expired_boosters()');
      
      const result = await pool.query(
        `SELECT uab.*, si.name, si.icon, si.effect_type
         FROM user_active_boosters uab
         JOIN user_purchases up ON uab.purchase_id = up.id
         JOIN shop_items si ON up.item_id = si.id
         WHERE uab.user_id = $1 AND uab.expires_at > NOW()
         ORDER BY uab.expires_at ASC`,
        [userId]
      );
      
      return result.rows;
    } catch (error) {
      console.error('Error getting user boosters:', error);
      throw error;
    }
  }

  /**
   * Получить текущий множитель XP пользователя
   */
  async getUserXPMultiplier(userId) {
    try {
      const boosters = await this.getUserActiveBoosters(userId);
      
      // Находим максимальный множитель среди активных бустеров
      let maxMultiplier = 1.0;
      for (const booster of boosters) {
        if (booster.effect_type === 'xp_multiplier' && booster.multiplier > maxMultiplier) {
          maxMultiplier = booster.multiplier;
        }
      }
      
      return maxMultiplier;
    } catch (error) {
      console.error('Error getting XP multiplier:', error);
      return 1.0;
    }
  }

  /**
   * Купить товар
   */
  async purchaseItem(userId, itemId) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Получаем информацию о товаре
      const itemResult = await client.query(
        'SELECT * FROM shop_items WHERE id = $1 AND is_active = true',
        [itemId]
      );
      
      if (itemResult.rows.length === 0) {
        throw new Error('Товар не найден или недоступен');
      }
      
      const item = itemResult.rows[0];
      
      // Проверяем баланс пользователя (available_xp, а не total_xp)
      const userResult = await client.query(
        'SELECT available_xp FROM users WHERE id = $1',
        [userId]
      );
      
      if (userResult.rows.length === 0) {
        throw new Error('Пользователь не найден');
      }
      
      const userXP = userResult.rows[0].available_xp;
      
      if (userXP < item.xp_cost) {
        throw new Error(`Недостаточно XP. Нужно: ${item.xp_cost}, есть: ${userXP}`);
      }
      
      // Списываем только available_xP (total_xp остается неизменным)
      await client.query(
        'UPDATE users SET available_xp = available_xp - $1 WHERE id = $2',
        [item.xp_cost, userId]
      );
      
      // Создаём запись о покупке
      const expiresAt = item.duration_hours 
        ? new Date(Date.now() + item.duration_hours * 60 * 60 * 1000)
        : null;
      
      const purchaseResult = await client.query(
        `INSERT INTO user_purchases (user_id, item_id, xp_spent, expires_at)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [userId, itemId, item.xp_cost, expiresAt]
      );
      
      const purchase = purchaseResult.rows[0];
      
      // Если это бустер, активируем его
      if (item.type === 'booster' && item.effect_type === 'xp_multiplier') {
        const effectValue = typeof item.effect_value === 'string' 
          ? JSON.parse(item.effect_value) 
          : item.effect_value;
        
        // Удаляем старый бустер того же типа, если есть
        await client.query(
          'DELETE FROM user_active_boosters WHERE user_id = $1 AND booster_type = $2',
          [userId, item.effect_type]
        );
        
        // Добавляем новый бустер
        await client.query(
          `INSERT INTO user_active_boosters (user_id, purchase_id, booster_type, multiplier, expires_at)
           VALUES ($1, $2, $3, $4, $5)`,
          [userId, purchase.id, item.effect_type, effectValue.multiplier, expiresAt]
        );
      }
      
      await client.query('COMMIT');
      
      return {
        success: true,
        purchase,
        item,
        remainingXP: userXP - item.xp_cost
      };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error purchasing item:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Получить историю покупок пользователя
   */
  async getUserPurchases(userId, limit = 20) {
    try {
      const result = await pool.query(
        `SELECT up.*, si.name, si.icon, si.type, si.description
         FROM user_purchases up
         JOIN shop_items si ON up.item_id = si.id
         WHERE up.user_id = $1
         ORDER BY up.purchased_at DESC
         LIMIT $2`,
        [userId, limit]
      );
      
      return result.rows;
    } catch (error) {
      console.error('Error getting user purchases:', error);
      throw error;
    }
  }

  /**
   * Использовать награду (активировать таймер если есть)
   */
  async useReward(userId, purchaseId) {
    try {
      // Получаем информацию о награде
      const purchaseResult = await pool.query(
        `SELECT up.*, si.duration_minutes, si.name 
         FROM user_purchases up
         JOIN shop_items si ON si.id = up.item_id
         WHERE up.id = $1 AND up.user_id = $2 AND up.is_used = false`,
        [purchaseId, userId]
      );
      
      if (purchaseResult.rows.length === 0) {
        throw new Error('Награда не найдена или уже использована');
      }
      
      const purchase = purchaseResult.rows[0];
      const durationMinutes = purchase.duration_minutes || 0;
      const hasTimer = durationMinutes > 0;
      
      let expiresAt = null;
      
      if (hasTimer) {
        // Награда с таймером — активируем
        const result = await pool.query(
          `UPDATE user_purchases 
           SET activated_at = NOW(), 
               expires_at = NOW() + INTERVAL '1 minute' * $3
           WHERE id = $1 AND user_id = $2
           RETURNING *`,
          [purchaseId, userId, durationMinutes]
        );
        expiresAt = result.rows[0].expires_at;
        
        console.log(`⏱️ Таймер активирован для награды "${purchase.name}" (${durationMinutes} мин)`);
      } else {
        // Награда без таймера — сразу помечаем как использованную
        await pool.query(
          `UPDATE user_purchases 
           SET is_used = true, used_at = NOW()
           WHERE id = $1 AND user_id = $2`,
          [purchaseId, userId]
        );
        
        console.log(`✅ Награда "${purchase.name}" использована (без таймера)`);
      }
      
      return {
        reward: purchase,
        hasTimer,
        expiresAt,
        durationMinutes
      };
    } catch (error) {
      console.error('Error using reward:', error);
      throw error;
    }
  }

  /**
   * Получить активные таймеры пользователя
   */
  async getActiveTimers(userId) {
    try {
      const result = await pool.query(
        `SELECT up.id, up.activated_at, up.expires_at, 
                si.name, si.icon, si.duration_minutes
         FROM user_purchases up
         JOIN shop_items si ON si.id = up.item_id
         WHERE up.user_id = $1 
           AND up.activated_at IS NOT NULL 
           AND up.expires_at > NOW()
           AND up.is_used = false
         ORDER BY up.expires_at ASC`,
        [userId]
      );
      
      return result.rows.map(row => ({
        id: row.id,
        name: row.name,
        icon: row.icon,
        activatedAt: row.activated_at,
        expiresAt: row.expires_at,
        durationMinutes: row.duration_minutes,
        remainingSeconds: Math.max(0, Math.floor((new Date(row.expires_at) - new Date()) / 1000))
      }));
    } catch (error) {
      console.error('Error getting active timers:', error);
      throw error;
    }
  }
}

export default new ShopService();

