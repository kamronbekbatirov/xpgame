import express from 'express';
import pool from '../database.js';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Получить полный контекст пользователя
async function getUserContext(userId) {
  try {
    // Получаем данные пользователя
    const userResult = await pool.query(
      `SELECT id, first_name, level, total_xp, current_streak, longest_streak, available_xp 
       FROM users WHERE id = $1`,
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      return null;
    }
    
    const user = userResult.rows[0];
    
    // Получаем цели
    const goalsResult = await pool.query(
      `SELECT id, title, description, status FROM goals WHERE user_id = $1 ORDER BY created_at DESC LIMIT 5`,
      [userId]
    );
    
    // Получаем задачи
    const tasksResult = await pool.query(
      `SELECT t.id, t.title, t.status, t.difficulty, t.xp_reward, g.title as goal_title
       FROM tasks t
       LEFT JOIN goals g ON t.goal_id = g.id
       WHERE t.user_id = $1
       ORDER BY t.created_at DESC LIMIT 15`,
      [userId]
    );
    
    // Получаем feedback по задачам
    const feedbackResult = await pool.query(
      `SELECT tf.difficulty, tf.notes, t.title as task_title
       FROM task_feedback tf
       JOIN tasks t ON tf.task_id = t.id
       WHERE t.user_id = $1
       ORDER BY tf.created_at DESC LIMIT 5`,
      [userId]
    );
    
    // Получаем слабости
    const weaknessesResult = await pool.query(
      `SELECT name, severity FROM weaknesses WHERE user_id = $1`,
      [userId]
    );
    
    return {
      user,
      goals: goalsResult.rows,
      tasks: tasksResult.rows,
      feedback: feedbackResult.rows,
      weaknesses: weaknessesResult.rows
    };
  } catch (error) {
    console.error('[UNIFIED-CHAT] Error getting context:', error);
    return null;
  }
}

// Построить системный промпт
function buildSystemPrompt(context) {
  const { user, goals, tasks, feedback, weaknesses } = context;
  
  const pendingTasks = tasks.filter(t => t.status === 'pending' || t.status === 'in_progress');
  const completedTasks = tasks.filter(t => t.status === 'completed');
  
  let prompt = `Ты AI-коуч для ${user.first_name}. Помогаешь достигать целей.

## Информация о пользователе:
- Уровень: ${user.level}
- XP: ${user.total_xp} (доступно: ${user.available_xp})
- Текущая серия: ${user.current_streak} дней
- Лучшая серия: ${user.longest_streak} дней

## Цели (${goals.length}):
${goals.map(g => `• ${g.title}${g.description ? ` - ${g.description}` : ''}`).join('\n') || '• Нет целей'}

## Текущие задачи (${pendingTasks.length}):
${pendingTasks.map(t => `• ${t.title} (+${t.xp_reward} XP)${t.goal_title ? ` [${t.goal_title}]` : ''}`).join('\n') || '• Нет задач'}

## Выполненные задачи: ${completedTasks.length}`;

  if (feedback.length > 0) {
    prompt += `\n\n## Feedback по задачам:
${feedback.map(f => `• "${f.task_title}" - ${f.difficulty}${f.notes ? `: ${f.notes}` : ''}`).join('\n')}`;
  }

  if (weaknesses.length > 0) {
    prompt += `\n\n## Слабости/привычки над которыми работаем:
${weaknesses.map(w => `• ${w.name} (${w.severity})`).join('\n')}`;
  }

  prompt += `

## Правила:
- Отвечай кратко (2-4 предложения)
- Будь мотивирующим и поддерживающим
- Используй эмодзи умеренно
- Учитывай feedback при советах
- Можешь предложить изменить задачи если они слишком сложные

## Если пользователь просит создать задачу:
Добавь в конец ответа:
<!--CREATE_TASK:{"title":"название задачи","goalId":null_или_id,"xp":число}-->`;

  return prompt;
}

// Хранилище диалогов
const conversations = new Map();

// Отправка сообщения
router.post('/message', async (req, res) => {
  try {
    const { userId, message } = req.body;
    
    if (!userId || !message) {
      return res.status(400).json({ error: 'userId and message required' });
    }
    
    // Получаем контекст пользователя
    const context = await getUserContext(userId);
    if (!context) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Получаем или создаём историю диалога
    const convId = `unified_${userId}`;
    if (!conversations.has(convId)) {
      conversations.set(convId, []);
    }
    const history = conversations.get(convId);
    
    // Добавляем сообщение пользователя
    history.push({ role: 'user', content: message });
    
    // Ограничиваем историю последними 10 сообщениями
    while (history.length > 10) {
      history.shift();
    }
    
    // Формируем запрос к OpenAI
    const chatMessages = [
      { role: 'system', content: buildSystemPrompt(context) },
      ...history
    ];
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: chatMessages,
      temperature: 0.7,
      max_tokens: 500
    });
    
    let aiMessage = response.choices[0].message.content;
    
    // Проверяем на команду создания задачи
    let tasksCreated = false;
    const taskMatch = aiMessage.match(/<!--CREATE_TASK:(.*?)-->/s);
    if (taskMatch) {
      try {
        const taskData = JSON.parse(taskMatch[1]);
        await pool.query(
          `INSERT INTO tasks (user_id, goal_id, title, xp_reward, difficulty, status)
           VALUES ($1, $2, $3, $4, 'medium', 'pending')`,
          [userId, taskData.goalId || null, taskData.title, taskData.xp || 20]
        );
        tasksCreated = true;
        console.log(`[UNIFIED-CHAT] Created task for user ${userId}: ${taskData.title}`);
      } catch (e) {
        console.error('Error creating task:', e);
      }
    }
    
    // Убираем технические маркеры
    const cleanMessage = aiMessage.replace(/<!--.*?-->/gs, '').trim();
    
    // Сохраняем ответ AI
    history.push({ role: 'assistant', content: cleanMessage });
    
    console.log(`[UNIFIED-CHAT] User ${userId}: "${message.substring(0, 50)}..."`);
    
    res.json({
      message: cleanMessage,
      tasksCreated
    });
    
  } catch (error) {
    console.error('[UNIFIED-CHAT] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Task feedback
router.post('/task-feedback', async (req, res) => {
  try {
    const { userId, taskId, difficulty, notes } = req.body;
    
    if (!userId || !taskId || !difficulty) {
      return res.status(400).json({ error: 'userId, taskId, and difficulty required' });
    }
    
    // Сохраняем feedback
    await pool.query(
      `INSERT INTO task_feedback (task_id, difficulty, notes, created_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (task_id) DO UPDATE SET difficulty = $2, notes = $3, created_at = NOW()`,
      [taskId, difficulty, notes || '']
    );
    
    console.log(`[TASK-FEEDBACK] User ${userId} task ${taskId}: ${difficulty}`);
    
    res.json({ success: true });
    
  } catch (error) {
    console.error('[TASK-FEEDBACK] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;


