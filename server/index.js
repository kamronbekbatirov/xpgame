import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import crypto from 'crypto';
import dotenv from 'dotenv';
import pool from './database.js';
import bot from './bot.js';
import openaiService from './openai-service.js';
import gamificationService from './gamification.js';
import { Users, Goals, Weaknesses, Tasks, Achievements } from './models.js';
import shopRoutes from './routes/shop.js';
import authRoutes from './routes/auth.js';
import budgetRoutes from './routes/budget.js';
import goalChatRoutes from './routes/goal-chat.js';
import onboardingRoutes from './routes/onboarding.js';
import unifiedChatRoutes from './routes/unified-chat.js';
import timerChecker from './timer-checker.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3003;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

/**
 * Проверка подлинности данных Telegram Web App
 */
function verifyTelegramWebAppData(initData) {
  try {
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');
    urlParams.delete('hash');
    
    const dataCheckString = Array.from(urlParams.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');
    
    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(process.env.TELEGRAM_BOT_TOKEN)
      .digest();
    
    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');
    
    return calculatedHash === hash;
  } catch (error) {
    console.error('Error verifying Telegram data:', error);
    return false;
  }
}

/**
 * Middleware для проверки аутентификации
 */
async function authMiddleware(req, res, next) {
  const initData = req.headers['x-telegram-init-data'];
  
  if (process.env.NODE_ENV === 'development' || !initData) {
    // В режиме разработки используем тестового пользователя
    if (!req.user) {
      try {
        // Пытаемся получить первого пользователя из БД для тестирования
        const result = await pool.query('SELECT * FROM users ORDER BY id LIMIT 1');
        if (result.rows.length > 0) {
          req.user = result.rows[0];
        }
      } catch (error) {
        console.error('Error getting test user:', error);
      }
    }
    return next();
  }
  
  if (!verifyTelegramWebAppData(initData)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  // Извлекаем данные пользователя из initData
  try {
    const params = new URLSearchParams(initData);
    const userJson = params.get('user');
    if (userJson) {
      const userData = JSON.parse(userJson);
      // Получаем пользователя из БД
      const user = await Users.findByTelegramId(userData.id);
      if (user) {
        req.user = user;
      }
    }
  } catch (error) {
    console.error('Error parsing user data:', error);
  }
  
  next();
}

// ============= API ROUTES =============

// Подключаем роуты магазина
app.use('/api/shop', authMiddleware, shopRoutes);

// Подключаем роуты авторизации (без authMiddleware, т.к. это первый вход)
app.use('/api/auth', authRoutes);

// Проверка здоровья сервера
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'XP Game API is running' });
});

// Получение информации о пользователе
app.get('/api/user/:telegramId', authMiddleware, async (req, res) => {
  try {
    const { telegramId } = req.params;
    const user = await Users.findByTelegramId(parseInt(telegramId));
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const gameStats = await gamificationService.getUserGameStats(user.id);
    res.json(gameStats);
  } catch (error) {
    console.error('Error getting user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Создание или обновление пользователя
app.post('/api/user', authMiddleware, async (req, res) => {
  try {
    const { telegram_id, username, first_name, last_name, photo_url } = req.body;
    const user = await Users.findOrCreate(
      parseInt(telegram_id),
      username,
      first_name,
      last_name
    );
    
    // Обновляем photo_url если передан
    if (photo_url) {
      await pool.query(
        'UPDATE users SET photo_url = $1 WHERE id = $2',
        [photo_url, user.id]
      );
      user.photo_url = photo_url;
    }
    
    res.json(user);
  } catch (error) {
    console.error('Error creating/updating user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============= GOALS =============

// Получение целей пользователя
app.get('/api/goals/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const goals = await Goals.getByUserId(parseInt(userId));
    res.json(goals);
  } catch (error) {
    console.error('Error getting goals:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Создание новой цели
app.post('/api/goals', authMiddleware, async (req, res) => {
  try {
    const { user_id, title, description, category, priority, auto_generate_tasks } = req.body;
    
    // Создаём цель с флагом автогенерации
    const result = await pool.query(
      `INSERT INTO goals (user_id, title, description, category, priority, auto_generate_tasks)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
      parseInt(user_id),
      title,
        description || null,
        category || 'personal',
        priority || 1,
        auto_generate_tasks !== false // По умолчанию true
      ]
    );
    
    const goal = result.rows[0];
    
    // Проверяем достижения
    const user = await Users.getStats(parseInt(user_id));
    const achievements = await gamificationService.checkAllAchievements(parseInt(user_id), user);
    
    res.json({ goal, unlockedAchievements: achievements });
  } catch (error) {
    console.error('Error creating goal:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Обновление цели
app.put('/api/goals/:goalId', authMiddleware, async (req, res) => {
  try {
    const { goalId } = req.params;
    const { title, description, category, priority, auto_generate_tasks } = req.body;
    
    const fields = [];
    const values = [];
    let paramIndex = 1;
    
    if (title !== undefined) {
      fields.push(`title = $${paramIndex++}`);
      values.push(title);
    }
    if (description !== undefined) {
      fields.push(`description = $${paramIndex++}`);
      values.push(description);
    }
    if (category !== undefined) {
      fields.push(`category = $${paramIndex++}`);
      values.push(category);
    }
    if (priority !== undefined) {
      fields.push(`priority = $${paramIndex++}`);
      values.push(priority);
    }
    if (auto_generate_tasks !== undefined) {
      fields.push(`auto_generate_tasks = $${paramIndex++}`);
      values.push(auto_generate_tasks);
    }
    
    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    values.push(parseInt(goalId));
    
    const result = await pool.query(
      `UPDATE goals SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Goal not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating goal:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Удаление цели
app.delete('/api/goals/:goalId', authMiddleware, async (req, res) => {
  try {
    const { goalId } = req.params;
    await Goals.delete(parseInt(goalId));
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting goal:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============= WEAKNESSES =============

// Получение слабостей пользователя
app.get('/api/weaknesses/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const weaknesses = await Weaknesses.getByUserId(parseInt(userId));
    res.json(weaknesses);
  } catch (error) {
    console.error('Error getting weaknesses:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Создание слабости
app.post('/api/weaknesses', authMiddleware, async (req, res) => {
  try {
    const { user_id, title, description, severity } = req.body;
    const weakness = await Weaknesses.create(
      parseInt(user_id),
      title,
      description,
      severity || 3
    );
    res.json(weakness);
  } catch (error) {
    console.error('Error creating weakness:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Обновление слабости
app.put('/api/weaknesses/:weaknessId', authMiddleware, async (req, res) => {
  try {
    const { weaknessId } = req.params;
    const updates = req.body;
    const updatedWeakness = await Weaknesses.update(parseInt(weaknessId), updates);
    res.json(updatedWeakness);
  } catch (error) {
    console.error('Error updating weakness:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Удаление слабости
app.delete('/api/weaknesses/:weaknessId', authMiddleware, async (req, res) => {
  try {
    const { weaknessId } = req.params;
    await Weaknesses.delete(parseInt(weaknessId));
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting weakness:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============= AI PLAN GENERATION =============

// Генерация плана развития с помощью OpenAI
app.post('/api/generate-plan', authMiddleware, async (req, res) => {
  try {
    const { user_id } = req.body;
    
    // Получаем цели и слабости пользователя
    const goals = await Goals.getActive(parseInt(user_id));
    const weaknesses = await Weaknesses.getByUserId(parseInt(user_id));
    
    // Фильтруем только цели с включенной автогенерацией
    const goalsForGeneration = goals.filter(g => g.auto_generate_tasks !== false);
    
    if (goalsForGeneration.length === 0 && weaknesses.length === 0) {
      return res.status(400).json({ 
        error: 'Необходимо указать хотя бы одну цель с включенной автогенерацией или слабость' 
      });
    }
    
    console.log(`🎯 Генерация плана для ${goalsForGeneration.length} из ${goals.length} целей (с auto_generate_tasks=true)`);
    
    // Получаем последний response_id для сохранения контекста
    const previousResponseId = await openaiService.getLastResponseId(parseInt(user_id));
    
    // Генерируем план с помощью OpenAI
    const { responseId, plan } = await openaiService.createDevelopmentPlan(
      parseInt(user_id),
      goalsForGeneration,
      weaknesses,
      previousResponseId
    );
    
    // Сохраняем задачи в базу данных
    const createdTasks = [];
    for (const task of plan.tasks) {
      // Привязываем задачу к цели по категории или по содержанию
      let relatedGoal = null;
      
      // Попытка 1: точное совпадение категории
      if (task.category) {
        relatedGoal = goalsForGeneration.find(g => 
          g.category && g.category.toLowerCase() === task.category.toLowerCase()
        );
      }
      
      // Попытка 2: поиск по названию цели в категории задачи
      if (!relatedGoal && task.category) {
        relatedGoal = goalsForGeneration.find(g => 
          g.title.toLowerCase().includes(task.category.toLowerCase()) ||
          task.category.toLowerCase().includes(g.title.toLowerCase())
        );
      }
      
      // Попытка 3: поиск по описанию задачи
      if (!relatedGoal) {
        relatedGoal = goalsForGeneration.find(g => 
          task.title.toLowerCase().includes(g.title.toLowerCase()) ||
          task.description?.toLowerCase().includes(g.title.toLowerCase())
        );
      }
      
      // Fallback: используем первую цель с автогенерацией
      if (!relatedGoal && goalsForGeneration.length > 0) {
        relatedGoal = goalsForGeneration[0];
      }
      
      const dueDate = task.estimated_days 
        ? new Date(Date.now() + task.estimated_days * 24 * 60 * 60 * 1000)
        : null;
      
      const createdTask = await Tasks.create(
        parseInt(user_id),
        relatedGoal?.id || null,
        task.title,
        task.description,
        task.xp_reward,
        task.difficulty,
        dueDate
      );
      
      createdTasks.push(createdTask);
    }
    
    res.json({
      success: true,
      responseId,
      analysis: plan.analysis,
      tasks: createdTasks,
      recommendations: plan.recommendations
    });
  } catch (error) {
    console.error('Error generating plan:', error);
    res.status(500).json({ error: 'Ошибка генерации плана: ' + error.message });
  }
});

// Обновление плана на основе прогресса
app.post('/api/update-plan', authMiddleware, async (req, res) => {
  try {
    const { user_id } = req.body;
    
    const completedTasks = await Tasks.getCompletedByUserId(parseInt(user_id), 10);
    const currentGoals = await Goals.getActive(parseInt(user_id));
    const weaknesses = await Weaknesses.getByUserId(parseInt(user_id));
    const userStats = await Users.getStats(parseInt(user_id));
    const previousResponseId = await openaiService.getLastResponseId(parseInt(user_id));
    
    const { responseId, update } = await openaiService.updatePlan(
      parseInt(user_id),
      completedTasks,
      currentGoals,
      weaknesses,
      userStats,
      previousResponseId
    );
    
    // Создаем новые задачи с улучшенной логикой привязки к целям
    const createdTasks = [];
    for (const task of update.new_tasks) {
      // Используем ту же логику, что и при генерации плана
      let relatedGoal = null;
      
      if (task.category) {
        relatedGoal = currentGoals.find(g => 
          g.category && g.category.toLowerCase() === task.category.toLowerCase()
        );
      }
      
      if (!relatedGoal && task.category) {
        relatedGoal = currentGoals.find(g => 
          g.title.toLowerCase().includes(task.category.toLowerCase()) ||
          task.category.toLowerCase().includes(g.title.toLowerCase())
        );
      }
      
      if (!relatedGoal) {
        relatedGoal = currentGoals.find(g => 
          task.title.toLowerCase().includes(g.title.toLowerCase()) ||
          task.description?.toLowerCase().includes(g.title.toLowerCase())
        );
      }
      
      if (!relatedGoal && currentGoals.length > 0) {
        relatedGoal = currentGoals[0];
      }
      
      const dueDate = task.estimated_days 
        ? new Date(Date.now() + task.estimated_days * 24 * 60 * 60 * 1000)
        : null;
      
      const createdTask = await Tasks.create(
        parseInt(user_id),
        relatedGoal?.id || null,
        task.title,
        task.description,
        task.xp_reward,
        task.difficulty,
        dueDate
      );
      
      createdTasks.push(createdTask);
    }
    
    res.json({
      success: true,
      responseId,
      progress_analysis: update.progress_analysis,
      tasks: createdTasks,
      motivation_message: update.motivation_message
    });
  } catch (error) {
    console.error('Error updating plan:', error);
    res.status(500).json({ error: 'Ошибка обновления плана: ' + error.message });
  }
});

// Проверка статуса обновления задач
app.get('/api/tasks/refresh-status/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    
    const result = await pool.query(
      'SELECT last_refresh_at, next_refresh_at FROM user_task_refresh WHERE user_id = $1',
      [parseInt(userId)]
    );
    
    if (result.rows.length === 0) {
      // Первый раз - создаём запись
      const now = new Date();
      const nextRefresh = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      
      await pool.query(
        'INSERT INTO user_task_refresh (user_id, last_refresh_at, next_refresh_at) VALUES ($1, $2, $3)',
        [parseInt(userId), now, nextRefresh]
      );
      
      return res.json({
        canRefresh: true,
        lastRefreshAt: now,
        nextRefreshAt: nextRefresh,
        secondsUntilNext: 24 * 60 * 60
      });
    }
    
    const { last_refresh_at, next_refresh_at } = result.rows[0];
    const now = new Date();
    const canRefresh = new Date(next_refresh_at) <= now;
    const secondsUntilNext = canRefresh ? 0 : Math.floor((new Date(next_refresh_at) - now) / 1000);
    
    res.json({
      canRefresh,
      lastRefreshAt: last_refresh_at,
      nextRefreshAt: next_refresh_at,
      secondsUntilNext
    });
  } catch (error) {
    console.error('Error checking refresh status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Автоматическое обновление задач (вызывается раз в 24 часа)
app.post('/api/tasks/auto-refresh', authMiddleware, async (req, res) => {
  try {
    const { user_id, force } = req.body;
    
    // Проверяем, можно ли обновить задачи
    const statusResult = await pool.query(
      'SELECT next_refresh_at FROM user_task_refresh WHERE user_id = $1',
      [parseInt(user_id)]
    );
    
    const now = new Date();
    
    if (!force && statusResult.rows.length > 0) {
      const nextRefresh = new Date(statusResult.rows[0].next_refresh_at);
      if (nextRefresh > now) {
        const secondsLeft = Math.floor((nextRefresh - now) / 1000);
        return res.status(400).json({ 
          error: `Обновление задач доступно через ${Math.ceil(secondsLeft / 3600)} часов`,
          secondsUntilNext: secondsLeft
        });
      }
    }
    
    // Выполняем обновление задач через updatePlan
    const completedTasks = await Tasks.getCompletedByUserId(parseInt(user_id), 10);
    const currentGoals = await Goals.getActive(parseInt(user_id));
    const goalsForGeneration = currentGoals.filter(g => g.auto_generate_tasks !== false);
    const weaknesses = await Weaknesses.getByUserId(parseInt(user_id));
    const userStats = await Users.getStats(parseInt(user_id));
    const previousResponseId = await openaiService.getLastResponseId(parseInt(user_id));
    
    if (goalsForGeneration.length === 0 && weaknesses.length === 0) {
      return res.status(400).json({ 
        error: 'Необходимо указать хотя бы одну цель с включенной автогенерацией или слабость' 
      });
    }
    
    console.log(`🔄 Автообновление задач для пользователя ${user_id}`);
    
    const { responseId, update } = await openaiService.updatePlan(
      parseInt(user_id),
      completedTasks,
      goalsForGeneration,
      weaknesses,
      userStats,
      previousResponseId
    );
    
    // Создаем новые задачи
    const createdTasks = [];
    for (const task of update.new_tasks) {
      let relatedGoal = null;
      
      if (task.category) {
        relatedGoal = goalsForGeneration.find(g => 
          g.category && g.category.toLowerCase() === task.category.toLowerCase()
        );
      }
      
      if (!relatedGoal && task.category) {
        relatedGoal = goalsForGeneration.find(g => 
          g.title.toLowerCase().includes(task.category.toLowerCase()) ||
          task.category.toLowerCase().includes(g.title.toLowerCase())
        );
      }
      
      if (!relatedGoal) {
        relatedGoal = goalsForGeneration.find(g => 
          task.title.toLowerCase().includes(g.title.toLowerCase()) ||
          task.description?.toLowerCase().includes(g.title.toLowerCase())
        );
      }
      
      if (!relatedGoal && goalsForGeneration.length > 0) {
        relatedGoal = goalsForGeneration[0];
      }
      
      const dueDate = task.estimated_days 
        ? new Date(Date.now() + task.estimated_days * 24 * 60 * 60 * 1000)
        : null;
      
      const createdTask = await Tasks.create(
        parseInt(user_id),
        relatedGoal?.id || null,
        task.title,
        task.description,
        task.xp_reward,
        task.difficulty,
        dueDate
      );
      
      createdTasks.push(createdTask);
    }
    
    // Обновляем время последнего обновления
    const nextRefresh = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    await pool.query(
      `INSERT INTO user_task_refresh (user_id, last_refresh_at, next_refresh_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id) 
       DO UPDATE SET last_refresh_at = $2, next_refresh_at = $3`,
      [parseInt(user_id), now, nextRefresh]
    );
    
    res.json({
      success: true,
      responseId,
      progress_analysis: update.progress_analysis,
      tasks: createdTasks,
      motivation_message: update.motivation_message,
      nextRefreshAt: nextRefresh,
      secondsUntilNext: 24 * 60 * 60
    });
  } catch (error) {
    console.error('Error auto-refreshing tasks:', error);
    res.status(500).json({ error: 'Ошибка автообновления задач: ' + error.message });
  }
});

// ============= TASKS =============

// Получение задач пользователя
app.get('/api/tasks/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const { status } = req.query;
    const tasks = await Tasks.getByUserId(parseInt(userId), status);
    res.json(tasks);
  } catch (error) {
    console.error('Error getting tasks:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Завершение задачи
app.post('/api/tasks/:taskId/complete', authMiddleware, async (req, res) => {
  try {
    const { taskId } = req.params;
    const { user_id } = req.body;
    
    const result = await gamificationService.completeTask(
      parseInt(user_id),
      parseInt(taskId)
    );
    
    res.json(result);
  } catch (error) {
    console.error('Error completing task:', error);
    res.status(500).json({ error: error.message });
  }
});

// Отправка feedback по задаче
app.post('/api/tasks/:taskId/feedback', authMiddleware, async (req, res) => {
  try {
    const { taskId } = req.params;
    const userId = req.user.id;
    const { feedback } = req.body;

    if (!feedback || feedback.trim().length === 0) {
      return res.status(400).json({ error: 'Feedback не может быть пустым' });
    }

    // Получаем информацию о задаче
    const taskResult = await pool.query(
      'SELECT * FROM tasks WHERE id = $1 AND user_id = $2',
      [taskId, userId]
    );

    if (taskResult.rows.length === 0) {
      return res.status(404).json({ error: 'Задача не найдена' });
    }

    const task = taskResult.rows[0];

    // Сохраняем feedback
    await pool.query(
      `INSERT INTO task_feedback (task_id, user_id, goal_id, feedback_text)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (task_id, user_id) DO UPDATE SET feedback_text = $4, created_at = CURRENT_TIMESTAMP`,
      [taskId, userId, task.goal_id, feedback.trim()]
    );

    console.log(`[FEEDBACK] ✅ User ${userId} submitted feedback for task ${taskId}`);

    res.json({ success: true });
  } catch (error) {
    console.error('Error submitting feedback:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Обновление статуса задачи
app.put('/api/tasks/:taskId/status', authMiddleware, async (req, res) => {
  try {
    const { taskId } = req.params;
    const { status } = req.body;
    const task = await Tasks.updateStatus(parseInt(taskId), status);
    res.json(task);
  } catch (error) {
    console.error('Error updating task status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Удаление задачи
app.delete('/api/tasks/:taskId', authMiddleware, async (req, res) => {
  try {
    const { taskId } = req.params;
    await Tasks.delete(parseInt(taskId));
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============= ACHIEVEMENTS =============

// Получение всех достижений
app.get('/api/achievements', authMiddleware, async (req, res) => {
  try {
    const achievements = await Achievements.getAll();
    res.json(achievements);
  } catch (error) {
    console.error('Error getting achievements:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Получение достижений пользователя
app.get('/api/achievements/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const achievements = await Achievements.getUserAchievements(parseInt(userId));
    res.json(achievements);
  } catch (error) {
    console.error('Error getting user achievements:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============= GAMIFICATION =============

// Получение ежедневного бонуса
app.post('/api/daily-bonus', authMiddleware, async (req, res) => {
  try {
    const { user_id } = req.body;
    const result = await gamificationService.dailyBonus(parseInt(user_id));
    res.json(result);
  } catch (error) {
    console.error('Error getting daily bonus:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Получение рейтинга
app.get('/api/leaderboard', authMiddleware, async (req, res) => {
  try {
    const { limit } = req.query;
    const leaderboard = await gamificationService.getLeaderboard(
      parseInt(limit) || 10
    );
    res.json(leaderboard);
  } catch (error) {
    console.error('Error getting leaderboard:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Получение мотивационного сообщения (с кэшированием на сутки)
app.post('/api/motivation', authMiddleware, async (req, res) => {
  try {
    const { user_id, force } = req.body;
    const userId = parseInt(user_id);
    
    // Проверяем кэш (если не force)
    if (!force) {
      const cachedResult = await pool.query(
        `SELECT message, expires_at FROM user_daily_motivation 
         WHERE user_id = $1 AND expires_at > NOW()
         LIMIT 1`,
        [userId]
      );
      
      if (cachedResult.rows.length > 0) {
        const expiresAt = new Date(cachedResult.rows[0].expires_at);
        const secondsUntilExpiry = Math.ceil((expiresAt - new Date()) / 1000);
        console.log(`[MOTIVATION] ⚡ Returning cached motivation for user ${userId} (expires in ${secondsUntilExpiry}s)`);
        return res.json({ 
          message: cachedResult.rows[0].message, 
          cached: true,
          secondsUntilExpiry: secondsUntilExpiry
        });
      }
    }
    
    // Генерируем новую мотивацию
    console.log(`[MOTIVATION] 🤖 Generating new motivation for user ${userId}${force ? ' (forced)' : ''}`);
    const userStats = await Users.getStats(userId);
    const previousResponseId = await openaiService.getLastResponseId(userId);
    
    const { message } = await openaiService.getMotivationalMessage(
      userId,
      userStats,
      previousResponseId
    );
    
    // Сохраняем в кэш (заменяем старое если есть)
    await pool.query(
      `INSERT INTO user_daily_motivation (user_id, message)
       VALUES ($1, $2)
       ON CONFLICT (user_id) 
       DO UPDATE SET message = $2, created_at = CURRENT_TIMESTAMP, expires_at = CURRENT_TIMESTAMP + INTERVAL '24 hours'`,
      [userId, message]
    );
    
    console.log(`[MOTIVATION] ✓ Motivation cached for user ${userId}`);
    res.json({ message, cached: false });
  } catch (error) {
    console.error('Error getting motivation:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Получение таблицы лидеров
app.get('/api/leaderboard', authMiddleware, async (req, res) => {
  try {
    const { limit, userId } = req.query;
    const leaderboardData = await gamificationService.getLeaderboard(
      parseInt(limit) || 50,
      userId ? parseInt(userId) : null
    );
    res.json(leaderboardData);
  } catch (error) {
    console.error('Error getting leaderboard:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============= ROUTES =============
app.use('/api/budget', authMiddleware, budgetRoutes);
app.use('/api/goal-chat', authMiddleware, goalChatRoutes);
app.use('/api/onboarding', authMiddleware, onboardingRoutes);
app.use('/api/unified-chat', authMiddleware, unifiedChatRoutes);

// ============= START SERVER =============

app.listen(PORT, '127.0.0.1', () => {
  console.log(`✓ XP Game API server running on localhost:${PORT}`);
  console.log(`✓ Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // Запускаем проверку таймеров
  timerChecker.start();
});

export default app;

