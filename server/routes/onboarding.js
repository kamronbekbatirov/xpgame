import express from 'express';
import pool from '../database.js';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// UHM System Prompt
const UHM_SYSTEM_PROMPT = `Ты AI-коуч. Проводишь БЫСТРУЮ постановку цели (5-8 сообщений).

## ЭТАПЫ:
1. intro → Спроси цель
2. meaning → Почему важно?
3. vision → Как выглядит успех?
4. reality → Где сейчас? Препятствия?
5. formulate → Сформулируй цель
6. strategy → План действий
7. systems → Привычки
8. complete → ФИНАЛ

## ПРАВИЛА:
- 1 вопрос за раз
- Кратко (2-3 предложения)  
- После 1 ответа переходи дальше
- НЕ ЗАТЯГИВАЙ!

## ФОРМАТ - ОБЯЗАТЕЛЬНО в конце КАЖДОГО ответа:

<!--UHM_STATE:{"stage":"ЭТАП","progress":ЧИСЛО}-->

## ФИНАЛ (stage=complete) - КРИТИЧЕСКИ ВАЖНО!

Когда готов завершить, ОБЯЗАТЕЛЬНО добавь ОБА маркера:

1. Поздравь пользователя
2. Добавь state с stage="complete"
3. Добавь result с целью и задачами

Пример финального ответа:
"🎉 Отлично! Мы разобрались с твоей целью!

Я создал для тебя план. Начни с первых задач - и вперёд к цели!

<!--UHM_STATE:{"stage":"complete","progress":100}-->
<!--UHM_RESULT:{"goal":"Твоя цель","keyResults":["KR1","KR2","KR3"],"firstTasks":["Задача 1","Задача 2","Задача 3"]}-->"

БЕЗ UHM_RESULT цель НЕ СОЗДАСТСЯ! Всегда добавляй его при complete!`;

// Хранилище диалогов (в production лучше использовать Redis или БД)
const conversations = new Map();

// Начало онбординга
router.post('/start', async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId required' });
    }

    // Получаем имя пользователя
    const userResult = await pool.query(
      'SELECT first_name FROM users WHERE id = $1',
      [userId]
    );
    
    const firstName = userResult.rows[0]?.first_name || 'друг';

    // Создаём начальный контекст
    const conversationId = `onboarding_${userId}`;
    conversations.set(conversationId, {
      messages: [],
      stage: 'intro',
      progress: 0,
      userData: {}
    });

    // Генерируем приветствие
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: UHM_SYSTEM_PROMPT },
        { 
          role: 'user', 
          content: `Пользователя зовут ${firstName}. Начни диалог - поприветствуй и объясни что вы будете делать. Спроси о его цели.` 
        }
      ],
      temperature: 0.7,
      max_tokens: 500
    });

    const aiMessage = response.choices[0].message.content;
    
    // Убираем технические маркеры из ответа пользователю
    const cleanMessage = aiMessage.replace(/<!--UHM_.*?-->/gs, '').trim();

    // Сохраняем в историю
    conversations.get(conversationId).messages.push(
      { role: 'assistant', content: aiMessage }
    );

    console.log(`[ONBOARDING] Started for user ${userId} (${firstName})`);

    res.json({ 
      message: cleanMessage,
      stage: 'intro',
      progress: 0
    });

  } catch (error) {
    console.error('[ONBOARDING] Error starting:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Отправка сообщения
router.post('/message', async (req, res) => {
  try {
    const { userId, message } = req.body;
    
    if (!userId || !message) {
      return res.status(400).json({ error: 'userId and message required' });
    }

    const conversationId = `onboarding_${userId}`;
    let conversation = conversations.get(conversationId);

    // Если нет контекста, создаём новый
    if (!conversation) {
      conversation = {
        messages: [],
        stage: 'intro',
        progress: 0,
        userData: {}
      };
      conversations.set(conversationId, conversation);
    }

    // Добавляем сообщение пользователя
    conversation.messages.push({ role: 'user', content: message });

    // Формируем историю для OpenAI
    const chatMessages = [
      { role: 'system', content: UHM_SYSTEM_PROMPT },
      ...conversation.messages.map(m => ({
        role: m.role,
        content: m.content
      }))
    ];

    // Получаем ответ от AI
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: chatMessages,
      temperature: 0.7,
      max_tokens: 800
    });

    const aiMessage = response.choices[0].message.content;
    
    // Парсим состояние из ответа
    let nextStage = conversation.stage;
    let progress = conversation.progress;
    let isComplete = false;
    let goalData = null;

    const stateMatch = aiMessage.match(/<!--UHM_STATE:(.*?)-->/s);
    if (stateMatch) {
      try {
        const state = JSON.parse(stateMatch[1]);
        nextStage = state.stage || nextStage;
        progress = state.progress || progress;
        isComplete = state.stage === 'complete';
      } catch (e) {
        console.error('Error parsing UHM_STATE:', e);
      }
    }

    const resultMatch = aiMessage.match(/<!--UHM_RESULT:(.*?)-->/s);
    if (resultMatch) {
      try {
        goalData = JSON.parse(resultMatch[1]);
      } catch (e) {
        console.error('Error parsing UHM_RESULT:', e);
      }
    }

    // Убираем маркеры из ответа
    const cleanMessage = aiMessage.replace(/<!--UHM_.*?-->/gs, '').trim();

    // Сохраняем ответ AI
    conversation.messages.push({ role: 'assistant', content: aiMessage });
    conversation.stage = nextStage;
    conversation.progress = progress;

    // Если завершено, создаём цель и задачи в БД
    if (isComplete) {
      if (goalData) {
        await createGoalAndTasks(userId, goalData);
        console.log(`[ONBOARDING] Created goal from UHM_RESULT for user ${userId}`);
      } else {
        // Fallback: извлекаем цель из истории диалога
        const fallbackGoal = await extractGoalFromHistory(conversation.messages, userId);
        if (fallbackGoal) {
          await createGoalAndTasks(userId, fallbackGoal);
          console.log(`[ONBOARDING] Created goal from FALLBACK for user ${userId}`);
        } else {
          console.error(`[ONBOARDING] Failed to create goal for user ${userId} - no data`);
        }
      }
      // Очищаем контекст
      conversations.delete(conversationId);
    }

    console.log(`[ONBOARDING] User ${userId} -> stage: ${nextStage}, progress: ${progress}%`);

    res.json({
      message: cleanMessage,
      nextStage,
      progress,
      isComplete
    });

  } catch (error) {
    console.error('[ONBOARDING] Error processing message:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Извлечение цели из истории диалога (fallback)
async function extractGoalFromHistory(messages, userId) {
  try {
    // Берём первое сообщение пользователя как основу цели
    const userMessages = messages.filter(m => m.role === 'user');
    if (userMessages.length === 0) return null;
    
    const firstGoalMessage = userMessages[0]?.content || 'Моя цель';
    
    // Используем AI чтобы сформулировать цель и задачи
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Извлеки цель и создай 3 задачи из диалога. 
          
Ответь ТОЛЬКО в JSON формате:
{"goal":"краткая цель","keyResults":["KR1","KR2","KR3"],"firstTasks":["Задача 1","Задача 2","Задача 3"]}`
        },
        {
          role: 'user',
          content: `Диалог:\n${messages.map(m => `${m.role}: ${m.content}`).join('\n')}\n\nСоздай цель и задачи.`
        }
      ],
      temperature: 0.3,
      max_tokens: 300
    });
    
    const content = response.choices[0].message.content;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    // Совсем простой fallback
    return {
      goal: firstGoalMessage.substring(0, 100),
      keyResults: ['Начать работать над целью'],
      firstTasks: ['Первый шаг к цели', 'Изучить тему', 'Составить план']
    };
    
  } catch (error) {
    console.error('[ONBOARDING] Error extracting goal from history:', error);
    return null;
  }
}

// Создание цели и задач из результатов UHM
async function createGoalAndTasks(userId, goalData) {
  try {
    const { goal, keyResults, firstTasks } = goalData;

    // Создаём цель
    const goalResult = await pool.query(
      `INSERT INTO goals (user_id, title, description, category, priority, auto_generate_tasks)
       VALUES ($1, $2, $3, 'personal', 1, true)
       RETURNING id`,
      [userId, goal, `Key Results:\n${keyResults.map((kr, i) => `${i+1}. ${kr}`).join('\n')}`]
    );

    const goalId = goalResult.rows[0].id;

    // Создаём задачи
    for (const task of firstTasks) {
      await pool.query(
        `INSERT INTO tasks (user_id, goal_id, title, xp_reward, difficulty, status)
         VALUES ($1, $2, $3, $4, 'medium', 'pending')`,
        [userId, goalId, task, Math.floor(Math.random() * 20) + 15]
      );
    }

    console.log(`[ONBOARDING] Created goal ${goalId} with ${firstTasks.length} tasks for user ${userId}`);

  } catch (error) {
    console.error('[ONBOARDING] Error creating goal and tasks:', error);
    throw error;
  }
}

export default router;

