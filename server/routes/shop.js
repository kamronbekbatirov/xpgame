import express from 'express';
import shopService from '../shop.js';
import openaiService from '../openai-service.js';
import { Goals, Weaknesses } from '../models.js';

const router = express.Router();

/**
 * GET /api/shop/items
 * Получить все товары магазина
 */
router.get('/items', async (req, res) => {
  try {
    const { type } = req.query;
    const items = await shopService.getShopItems(type);
    res.json({ success: true, items });
  } catch (error) {
    console.error('Error getting shop items:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/shop/personal-rewards/:userId
 * Получить персональные награды на основе слабостей (из кэша или сгенерировать)
 */
router.get('/personal-rewards/:userId', async (req, res) => {
  const startTime = Date.now();
  try {
    const { userId } = req.params;
    // Правильно парсим булев параметр из query string
    // force=true или force='true' → true, иначе false (включая undefined)
    const forceRefresh = req.query.force === 'true' || req.query.force === true;
    
    console.log(`[SHOP] Getting personal rewards for user ${userId}, force=${forceRefresh} (raw: ${req.query.force}, type: ${typeof req.query.force})`);
    
    // Получаем слабости и цели пользователя
    const weaknesses = await Weaknesses.getByUserId(userId);
    const goals = await Goals.getByUserId(userId);
    
    if (weaknesses.length === 0) {
      console.log(`[SHOP] User ${userId} has no weaknesses`);
      return res.json({ 
        success: true, 
        rewards: [],
        cached: false,
        message: 'Добавьте слабые стороны, чтобы получить персональные награды'
      });
    }
    
    // Проверяем кэш (если не force)
    if (!forceRefresh) {
      const cachedRewards = await shopService.getCachedPersonalRewards(userId);
      if (cachedRewards.length > 0) {
        const elapsed = Date.now() - startTime;
        console.log(`[SHOP] ⚡ Returning ${cachedRewards.length} cached rewards for user ${userId} (${elapsed}ms)`);
        return res.json({ 
          success: true, 
          rewards: cachedRewards,
          cached: true
        });
      }
      console.log(`[SHOP] No cache found for user ${userId}, generating...`);
    } else {
      console.log(`[SHOP] Force refresh requested for user ${userId}`);
    }
    
    // Генерируем новые награды через AI
    console.log(`[SHOP] 🤖 Generating AI rewards for user ${userId}...`);
    const result = await openaiService.generatePersonalRewards(userId, weaknesses, goals);
    const genElapsed = Date.now() - startTime;
    console.log(`[SHOP] ✓ Generated ${result.rewards.length} rewards (${genElapsed}ms)`);
    
    // Сохраняем в кэш
    await shopService.cachePersonalRewards(userId, result.rewards);
    console.log(`[SHOP] ✓ Cached rewards for user ${userId}`);
    
    const totalElapsed = Date.now() - startTime;
    res.json({ 
      success: true, 
      rewards: result.rewards,
      cached: false,
      generationTime: totalElapsed
    });
  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error(`[SHOP] ❌ Error getting personal rewards (${elapsed}ms):`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/shop/boosters/:userId
 * Получить активные бустеры пользователя
 */
router.get('/boosters/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const boosters = await shopService.getUserActiveBoosters(userId);
    const multiplier = await shopService.getUserXPMultiplier(userId);
    
    res.json({ 
      success: true, 
      boosters,
      currentMultiplier: multiplier
    });
  } catch (error) {
    console.error('Error getting user boosters:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/shop/purchase
 * Купить товар
 */
router.post('/purchase', async (req, res) => {
  try {
    const { userId, itemId } = req.body;
    
    if (!userId || !itemId) {
      return res.status(400).json({ 
        success: false, 
        error: 'userId и itemId обязательны' 
      });
    }
    
    const result = await shopService.purchaseItem(userId, itemId);
    
    res.json({ 
      success: true, 
      purchase: result.purchase,
      item: result.item,
      remainingXP: result.remainingXP
    });
  } catch (error) {
    console.error('Error purchasing item:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/shop/add-personal-reward
 * Добавить персональную награду в магазин
 */
router.post('/add-personal-reward', async (req, res) => {
  try {
    const { userId, reward } = req.body;
    
    if (!userId || !reward) {
      return res.status(400).json({ 
        success: false, 
        error: 'userId и reward обязательны' 
      });
    }
    
    // Добавляем награду в магазин как персональную
    const { default: pool } = await import('../database.js');
    const result = await pool.query(
      `INSERT INTO shop_items (type, name, description, xp_cost, icon, effect_type, effect_value, duration_minutes, is_active)
       VALUES ('reward', $1, $2, $3, $4, 'custom_reward', $5, $6, true)
       RETURNING *`,
      [
        reward.name,
        reward.description,
        reward.xp_cost,
        reward.icon,
        JSON.stringify({ userId, generatedByAI: true }),
        reward.duration_minutes || 0
      ]
    );
    
    res.json({ 
      success: true, 
      item: result.rows[0],
      itemId: result.rows[0].id
    });
  } catch (error) {
    console.error('Error adding personal reward:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/shop/purchases/:userId
 * Получить историю покупок
 */
router.get('/purchases/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit } = req.query;
    
    const purchases = await shopService.getUserPurchases(
      userId, 
      limit ? parseInt(limit) : 20
    );
    
    res.json({ success: true, purchases });
  } catch (error) {
    console.error('Error getting purchases:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/shop/use-reward
 * Использовать награду (активировать таймер если есть)
 */
router.post('/use-reward', async (req, res) => {
  try {
    const { userId, purchaseId } = req.body;
    
    if (!userId || !purchaseId) {
      return res.status(400).json({ 
        success: false, 
        error: 'userId и purchaseId обязательны' 
      });
    }
    
    const result = await shopService.useReward(userId, purchaseId);
    
    res.json({ 
      success: true, 
      reward: result.reward,
      hasTimer: result.hasTimer,
      expiresAt: result.expiresAt,
      durationMinutes: result.durationMinutes,
      message: result.hasTimer 
        ? `Таймер запущен на ${result.durationMinutes} мин! ⏱️ Наслаждайся!` 
        : 'Награда использована! 🎉'
    });
  } catch (error) {
    console.error('Error using reward:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/shop/active-timers/:userId
 * Получить активные таймеры пользователя
 */
router.get('/active-timers/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const timers = await shopService.getActiveTimers(userId);
    res.json({ success: true, timers });
  } catch (error) {
    console.error('Error getting active timers:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;

