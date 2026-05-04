import express from 'express';
import pool from '../database.js';

const router = express.Router();

const MASTER_PASSWORD = 'wewillwin2025';

/**
 * POST /api/auth/check-password
 * Проверить пароль для первого входа
 */
router.post('/check-password', async (req, res) => {
  try {
    const { userId, password } = req.body;

    if (!userId || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'userId and password are required' 
      });
    }

    // Проверяем пароль
    if (password !== MASTER_PASSWORD) {
      return res.json({ 
        success: false, 
        authorized: false,
        message: 'Неверный пароль' 
      });
    }

    // Авторизуем пользователя
    await pool.query(
      'UPDATE users SET is_authorized = true WHERE id = $1',
      [userId]
    );

    console.log(`[AUTH] User ${userId} authorized successfully`);

    res.json({ 
      success: true, 
      authorized: true,
      message: 'Добро пожаловать!' 
    });
  } catch (error) {
    console.error('[AUTH] Error checking password:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/auth/status/:userId
 * Получить статус авторизации и onboarding
 */
router.get('/status/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await pool.query(
      `SELECT is_authorized, onboarding_completed, onboarding_step 
       FROM users 
       WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found' 
      });
    }

    const user = result.rows[0];

    res.json({ 
      success: true, 
      isAuthorized: user.is_authorized || false,
      onboardingCompleted: user.onboarding_completed || false,
      onboardingStep: user.onboarding_step
    });
  } catch (error) {
    console.error('[AUTH] Error getting status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/auth/update-onboarding
 * Обновить шаг onboarding
 */
router.post('/update-onboarding', async (req, res) => {
  try {
    const { userId, step, completed } = req.body;

    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        error: 'userId is required' 
      });
    }

    if (completed) {
      // Завершаем onboarding
      await pool.query(
        `UPDATE users 
         SET onboarding_completed = true, onboarding_step = null 
         WHERE id = $1`,
        [userId]
      );
      console.log(`[AUTH] User ${userId} completed onboarding`);
    } else {
      // Обновляем шаг
      await pool.query(
        'UPDATE users SET onboarding_step = $1 WHERE id = $2',
        [step, userId]
      );
      console.log(`[AUTH] User ${userId} at onboarding step: ${step}`);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[AUTH] Error updating onboarding:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;



