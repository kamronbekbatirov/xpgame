import express from 'express';
import pool from '../database.js';
import openaiService from '../openai-service.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Папка для временных файлов
const TEMP_DIR = path.join(__dirname, '..', 'temp-exports');
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

/**
 * GET /api/goal-chat/:goalId/messages
 * Получить историю чата для цели
 */
router.get('/:goalId/messages', async (req, res) => {
  try {
    const { goalId } = req.params;
    const userId = req.user.id;

    // Проверяем, что цель принадлежит пользователю
    const goalCheck = await pool.query(
      'SELECT id FROM goals WHERE id = $1 AND user_id = $2',
      [goalId, userId]
    );

    if (goalCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Цель не найдена' });
    }

    // Получаем историю сообщений
    const messages = await pool.query(
      `SELECT id, role, content, metadata, created_at
       FROM goal_chat_messages
       WHERE goal_id = $1 AND user_id = $2
       ORDER BY created_at ASC`,
      [goalId, userId]
    );

    res.json({ messages: messages.rows });
  } catch (error) {
    console.error('Error fetching chat messages:', error);
    res.status(500).json({ error: 'Ошибка при загрузке сообщений' });
  }
});

/**
 * POST /api/goal-chat/:goalId/message
 * Отправить сообщение в чат
 */
router.post('/:goalId/message', async (req, res) => {
  try {
    const { goalId } = req.params;
    const userId = req.user.id;
    const { message } = req.body;

    console.log(`[CHAT] 📨 New message from user ${userId} for goal ${goalId}: "${message.substring(0, 50)}..."`);

    if (!message || message.trim().length === 0) {
      return res.status(400).json({ error: 'Сообщение не может быть пустым' });
    }

    // Проверяем, что цель принадлежит пользователю
    const goalCheck = await pool.query(
      'SELECT id FROM goals WHERE id = $1 AND user_id = $2',
      [goalId, userId]
    );

    if (goalCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Цель не найдена' });
    }

    // Получаем историю чата (последние 20 сообщений)
    const historyResult = await pool.query(
      `SELECT role, content, response_id
       FROM goal_chat_messages
       WHERE goal_id = $1 AND user_id = $2
       ORDER BY created_at DESC
       LIMIT 20`,
      [goalId, userId]
    );

    const chatHistory = historyResult.rows.reverse();
    
    // Получаем последний response_id от assistant для передачи CoT
    const lastAssistantMessage = historyResult.rows.find(msg => msg.role === 'assistant' && msg.response_id);
    const previousResponseId = lastAssistantMessage?.response_id || null;

    // Сохраняем сообщение пользователя
    await pool.query(
      `INSERT INTO goal_chat_messages (goal_id, user_id, role, content)
       VALUES ($1, $2, 'user', $3)`,
      [goalId, userId, message]
    );

    console.log(`[CHAT] 🤖 Sending to AI with ${chatHistory.length} history messages, previous_response_id: ${previousResponseId}...`);

    // Отправляем запрос к AI с previous_response_id для передачи CoT
    const aiResponse = await openaiService.chatAboutGoal(
      userId,
      goalId,
      message,
      chatHistory,
      previousResponseId
    );

    console.log(`[CHAT] ✅ AI responded with ${aiResponse.message.length} chars, response_id: ${aiResponse.responseId}`);

    // Сохраняем ответ AI с response_id
    await pool.query(
      `INSERT INTO goal_chat_messages (goal_id, user_id, role, content, metadata, response_id)
       VALUES ($1, $2, 'assistant', $3, $4, $5)`,
      [goalId, userId, aiResponse.message, JSON.stringify(aiResponse.metadata), aiResponse.responseId]
    );

    // Если AI создал roadmap, сохраняем его
    if (aiResponse.roadmap) {
      await pool.query(
        `INSERT INTO goal_context (goal_id, user_id, roadmap, current_stage)
         VALUES ($1, $2, $3, 0)
         ON CONFLICT (goal_id, user_id)
         DO UPDATE SET roadmap = $3, updated_at = CURRENT_TIMESTAMP`,
        [goalId, userId, JSON.stringify(aiResponse.roadmap)]
      );
    }

    res.json({
      message: aiResponse.message,
      roadmapCreated: aiResponse.metadata.roadmapCreated || false
    });

  } catch (error) {
    console.error('Error sending chat message:', error);
    res.status(500).json({ error: 'Ошибка при отправке сообщения' });
  }
});

/**
 * GET /api/goal-chat/:goalId/context
 * Получить контекст цели (roadmap, текущий этап)
 */
router.get('/:goalId/context', async (req, res) => {
  try {
    const { goalId } = req.params;
    const userId = req.user.id;

    // Проверяем, что цель принадлежит пользователю
    const goalCheck = await pool.query(
      'SELECT id FROM goals WHERE id = $1 AND user_id = $2',
      [goalId, userId]
    );

    if (goalCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Цель не найдена' });
    }

    // Получаем контекст
    const contextResult = await pool.query(
      `SELECT roadmap, current_stage, preferences, ai_notes, updated_at
       FROM goal_context
       WHERE goal_id = $1 AND user_id = $2`,
      [goalId, userId]
    );

    if (contextResult.rows.length === 0) {
      return res.json({ context: null });
    }

    res.json({ context: contextResult.rows[0] });
  } catch (error) {
    console.error('Error fetching goal context:', error);
    res.status(500).json({ error: 'Ошибка при загрузке контекста' });
  }
});

/**
 * PUT /api/goal-chat/:goalId/context
 * Обновить контекст цели (например, перейти к следующему этапу)
 */
router.put('/:goalId/context', async (req, res) => {
  try {
    const { goalId } = req.params;
    const userId = req.user.id;
    const { currentStage, roadmap, preferences, aiNotes } = req.body;

    // Проверяем, что цель принадлежит пользователю
    const goalCheck = await pool.query(
      'SELECT id FROM goals WHERE id = $1 AND user_id = $2',
      [goalId, userId]
    );

    if (goalCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Цель не найдена' });
    }

    // Обновляем контекст
    const updateFields = [];
    const updateValues = [];
    let valueIndex = 1;

    if (currentStage !== undefined) {
      updateFields.push(`current_stage = $${valueIndex++}`);
      updateValues.push(currentStage);
    }

    if (roadmap !== undefined) {
      updateFields.push(`roadmap = $${valueIndex++}`);
      updateValues.push(JSON.stringify(roadmap));
    }

    if (preferences !== undefined) {
      updateFields.push(`preferences = $${valueIndex++}`);
      updateValues.push(JSON.stringify(preferences));
    }

    if (aiNotes !== undefined) {
      updateFields.push(`ai_notes = $${valueIndex++}`);
      updateValues.push(aiNotes);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'Нет данных для обновления' });
    }

    updateValues.push(goalId, userId);

    await pool.query(
      `UPDATE goal_context
       SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE goal_id = $${valueIndex++} AND user_id = $${valueIndex++}`,
      updateValues
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating goal context:', error);
    res.status(500).json({ error: 'Ошибка при обновлении контекста' });
  }
});

/**
 * DELETE /api/goal-chat/:goalId/messages
 * Очистить историю чата для цели
 */
router.delete('/:goalId/messages', async (req, res) => {
  try {
    const { goalId } = req.params;
    const userId = req.user.id;

    // Проверяем, что цель принадлежит пользователю
    const goalCheck = await pool.query(
      'SELECT id FROM goals WHERE id = $1 AND user_id = $2',
      [goalId, userId]
    );

    if (goalCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Цель не найдена' });
    }

    // Удаляем все сообщения
    await pool.query(
      'DELETE FROM goal_chat_messages WHERE goal_id = $1 AND user_id = $2',
      [goalId, userId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting chat messages:', error);
    res.status(500).json({ error: 'Ошибка при удалении сообщений' });
  }
});

// POST /api/goal-chat/export-temp - Создать временный файл для экспорта
router.post('/export-temp', async (req, res) => {
  try {
    const { content, fileName } = req.body;
    
    if (!content || !fileName) {
      return res.status(400).json({ error: 'Content and fileName are required' });
    }

    // Генерируем уникальное имя файла
    const uniqueFileName = `${Date.now()}-${fileName}`;
    const filePath = path.join(TEMP_DIR, uniqueFileName);
    
    // Сохраняем файл
    fs.writeFileSync(filePath, content, 'utf-8');
    
    // Удаляем файл через 5 минут
    setTimeout(() => {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log(`Deleted temp file: ${uniqueFileName}`);
        }
      } catch (error) {
        console.error('Error deleting temp file:', error);
      }
    }, 5 * 60 * 1000);
    
    // Возвращаем URL для скачивания (принудительно HTTPS для Telegram API)
    const protocol = req.get('x-forwarded-proto') || req.protocol;
    const downloadUrl = `https://${req.get('host')}/xpgame/api/goal-chat/download/${uniqueFileName}`;
    res.json({ url: downloadUrl });
  } catch (error) {
    console.error('Error creating temp file:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/goal-chat/download/:fileName - Скачать временный файл
router.get('/download/:fileName', (req, res) => {
  try {
    const { fileName } = req.params;
    const filePath = path.join(TEMP_DIR, fileName);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Устанавливаем заголовки для скачивания
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName.split('-').slice(1).join('-')}"`);
    res.setHeader('Access-Control-Allow-Origin', 'https://web.telegram.org');
    
    // Отправляем файл
    res.sendFile(filePath);
  } catch (error) {
    console.error('Error downloading file:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/goal-chat/:goalId/generate-tasks
 * Генерация задач из roadmap
 */
router.post('/:goalId/generate-tasks', async (req, res) => {
  try {
    const { goalId } = req.params;
    const userId = req.user.id;
    const { daysToGenerate = 7 } = req.body;

    console.log(`[GENERATE-TASKS] 📋 User ${userId} generating tasks for goal ${goalId}`);

    // Проверяем, что цель принадлежит пользователю
    const goalCheck = await pool.query(
      'SELECT id FROM goals WHERE id = $1 AND user_id = $2',
      [goalId, userId]
    );

    if (goalCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Цель не найдена' });
    }

    // Получаем roadmap из контекста
    const contextResult = await pool.query(
      'SELECT * FROM goal_context WHERE goal_id = $1 AND user_id = $2',
      [goalId, userId]
    );

    if (contextResult.rows.length === 0 || !contextResult.rows[0].roadmap) {
      return res.status(400).json({ error: 'Roadmap не найден. Сначала создайте план в чате.' });
    }

    const context = contextResult.rows[0];
    const roadmap = context.roadmap;

    // Генерируем задачи через AI
    const tasks = await openaiService.generateTasksFromRoadmap(userId, goalId, roadmap, daysToGenerate);

    // Сохраняем задачи в базу данных
    const insertedTasks = [];
    for (const task of tasks) {
      // Вычисляем due_date: сегодня + (day - 1) дней (day начинается с 1)
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + (task.day - 1));
      dueDate.setHours(23, 59, 59, 999); // Конец дня
      
      const result = await pool.query(
        `INSERT INTO tasks (user_id, goal_id, title, description, difficulty, xp_reward, due_date, roadmap_stage, from_chat)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
         RETURNING *`,
        [
          userId,
          goalId,
          task.title,
          task.description,
          task.difficulty,
          task.xp_reward,
          dueDate.toISOString(),
          task.roadmap_stage
        ]
      );
      insertedTasks.push(result.rows[0]);
    }

    // Обновляем флаг tasks_generated в контексте
    await pool.query(
      `UPDATE goal_context SET tasks_generated = true, updated_at = CURRENT_TIMESTAMP
       WHERE goal_id = $1 AND user_id = $2`,
      [goalId, userId]
    );

    console.log(`[GENERATE-TASKS] ✅ Created ${insertedTasks.length} tasks`);

    res.json({
      success: true,
      tasksCount: insertedTasks.length,
      tasks: insertedTasks
    });

  } catch (error) {
    console.error('Error generating tasks:', error);
    res.status(500).json({ error: 'Ошибка при генерации задач' });
  }
});

export default router;

