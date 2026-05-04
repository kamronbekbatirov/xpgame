import OpenAI from 'openai';
import dotenv from 'dotenv';
import pool from './database.js';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const DEFAULT_PLAN_MODEL = process.env.OPENAI_PLAN_MODEL || 'gpt-5';
const DEFAULT_UPDATE_MODEL = process.env.OPENAI_UPDATE_MODEL || DEFAULT_PLAN_MODEL;
const DEFAULT_MOTIVATION_MODEL = process.env.OPENAI_MOTIVATION_MODEL || DEFAULT_PLAN_MODEL;

const parseNumberEnv = (value, fallback) => {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const DEFAULT_TEMPERATURE = parseNumberEnv(process.env.OPENAI_TEMPERATURE, 0.35);
const DEFAULT_MAX_OUTPUT_TOKENS = parseNumberEnv(process.env.OPENAI_MAX_OUTPUT_TOKENS, 8000); // Увеличено для GPT-5 reasoning

const DEVELOPMENT_PLAN_SCHEMA = {
                type: 'object',
  additionalProperties: false,
                required: ['analysis', 'tasks', 'recommendations'],
                properties: {
                  analysis: {
                    type: 'string',
      description: 'Общий анализ целей и слабых сторон пользователя'
                  },
                  tasks: {
                    type: 'array',
      minItems: 5,
      maxItems: 30, // Увеличено для поддержки 5 задач на каждую цель (до 6 целей)
                    items: {
                      type: 'object',
        additionalProperties: false,
        required: ['title', 'description', 'difficulty', 'xp_reward', 'category', 'estimated_days'],
                      properties: {
                        title: {
                          type: 'string',
            minLength: 4,
                          description: 'Короткое название задачи'
                        },
                        description: {
                          type: 'string',
            minLength: 10,
                          description: 'Подробное описание задачи и критерии выполнения'
                        },
                        difficulty: {
                          type: 'string',
                          enum: ['easy', 'medium', 'hard'],
                          description: 'Сложность задачи'
                        },
                        xp_reward: {
                          type: 'integer',
            minimum: 30,
            maximum: 120,
                          description: 'Количество XP за выполнение (easy: 30-50, medium: 60-80, hard: 90-120)'
                        },
                        category: {
                          type: 'string',
                          description: 'Категория задачи (связь с целью)'
                        },
                        estimated_days: {
                          type: 'integer',
            minimum: 1,
            maximum: 1,
                          description: 'Все задачи на 1 день (ежедневные чек-ины)'
                        }
        }
                    }
                  },
                  recommendations: {
                    type: 'array',
      items: {
        type: 'string',
        minLength: 5
      },
      maxItems: 6
    }
  }
};

const UPDATE_PLAN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['progress_analysis', 'new_tasks', 'motivation_message'],
  properties: {
    progress_analysis: {
      type: 'string',
      description: 'Анализ достигнутого прогресса'
    },
    new_tasks: {
      type: 'array',
      minItems: 1,
      maxItems: 30, // Увеличено для поддержки 5 задач на каждую цель (до 6 целей)
                    items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'description', 'difficulty', 'xp_reward', 'category', 'estimated_days'],
        properties: {
          title: { type: 'string', minLength: 4 },
          description: { type: 'string', minLength: 10 },
          difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
          xp_reward: { type: 'integer', minimum: 30, maximum: 120 },
          category: { type: 'string' },
          estimated_days: { type: 'integer', minimum: 1, maximum: 1 }
        }
      }
    },
    motivation_message: {
      type: 'string',
      minLength: 10,
      description: 'Мотивационное сообщение для пользователя'
    }
        }
      };

/**
 * OpenAI Responses API Service
 * Использует новый Responses API для создания персонализированных планов развития
 */
class OpenAIService {
  /**
   * Создание плана развития на основе целей и слабостей пользователя
   */
  async createDevelopmentPlan(userId, goals, weaknesses, previousResponseId = null) {
    try {
      const userContext = this.formatUserContext(goals, weaknesses);

      const requestParams = {
        model: DEFAULT_PLAN_MODEL,
        reasoning: { effort: 'low' },
        instructions: `Ты - добрый коуч, который помогает формировать ЕЖЕДНЕВНЫЕ ПРИВЫЧКИ через простые чек-ины.

🎯 ГЛАВНЫЙ ПРИНЦИП: "Просто сделай что-то сегодня по каждой цели"

📊 СТРОГИЕ ПРАВИЛА (для КАЖДОЙ цели):
- Создавай РОВНО 5 задач на каждую цель
- ВСЕ задачи должны быть на ОДИН ДЕНЬ (estimated_days = 1)
- Распределение по сложности: 3 лёгкие (30-50 XP) + 1 средняя (60-80 XP) + 1 сложная (90-120 XP)
- Задачи = простые ДЕЙСТВИЯ, а не конкретные результаты

✅ ПРАВИЛЬНЫЕ ЗАДАЧИ (простые действия):
EASY (30-50 XP, 1 день):
- "Поработать над Beauty ботом сегодня" (40 XP)
- "Заняться спортом (любые упражнения)" (35 XP)
- "Сделать 1 урок Duolingo" (40 XP)
- "Уделить время бизнесу для студентов" (40 XP)
- "Позаниматься английским" (35 XP)

MEDIUM (60-80 XP, 1 день):
- "Поработать над Beauty ботом 30+ минут" (70 XP)
- "Тренировка 15+ минут" (65 XP)
- "Duolingo + практика разговорного" (70 XP)

HARD (90-120 XP, 1 день):
- "Поработать над Beauty ботом 1+ час" (100 XP)
- "Полноценная тренировка 30+ минут" (110 XP)
- "Duolingo + написать 5 предложений на английском" (100 XP)

❌ НЕПРАВИЛЬНЫЕ ЗАДАЧИ (слишком конкретные):
- "Онбордить 3 клиентов" ❌
- "Сделать серию 7 дней" ❌
- "Набрать 400+ XP в неделю" ❌
- "Создать структуру базы данных" ❌

🎯 ФОРМУЛИРОВКИ:
- Используй глаголы: "Поработать", "Заняться", "Уделить время", "Сделать"
- НЕ указывай конкретные результаты (не "онбордить 3 клиентов", а "поработать над онбордингом")
- НЕ указывай конкретные метрики (не "30+ XP", а "позаниматься Duolingo")
- Все задачи на 1 день (estimated_days = 1)

Отвечай на русском языке.`,
        input: userContext,
        max_output_tokens: 8000,
        text: {
          format: {
            type: 'json_schema',
            name: 'create_development_plan',
            schema: DEVELOPMENT_PLAN_SCHEMA,
            strict: true
          }
        }
      };

      // Только используем previous_response_id если он начинается с 'resp-'
      // (старые ID от Chat Completions API начинаются с 'chatcmpl-')
      if (previousResponseId && previousResponseId.startsWith('resp')) {
        requestParams.previous_response_id = previousResponseId;
      }

      const response = await openai.responses.create(requestParams);

      // Проверяем статус ответа
      if (response.status !== 'completed') {
        console.error(`[DEBUG] Response not completed. Status: ${response.status}`);
        console.error(`[DEBUG] Incomplete details:`, JSON.stringify(response.incomplete_details, null, 2));
        console.error(`[DEBUG] Error:`, JSON.stringify(response.error, null, 2));
        console.error(`[DEBUG] Usage:`, JSON.stringify(response.usage, null, 2));
        throw new Error(`Response status is ${response.status}, expected 'completed'. Reason: ${response.incomplete_details?.reason || 'unknown'}`);
      }

      const planData = this.parseJsonOutput(response, 'development plan');

      await this.saveConversationContext(userId, response.id, {
        previousResponseId,
        goals,
        weaknesses,
        plan: planData
      });

      return {
        responseId: response.id,
        plan: planData
      };
    } catch (error) {
      console.error('Error creating development plan:', error);
      throw error;
    }
  }

  /**
   * Обновление плана на основе прогресса пользователя
   */
  async updatePlan(userId, completedTasks, currentGoals, weaknesses, userStats, previousResponseId) {
    try {
      const completedTasksText = completedTasks.length > 0
        ? completedTasks.map(task => `- "${task.title}" (${task.difficulty}, ${task.xp_reward} XP) - выполнена ${new Date(task.completed_at).toLocaleDateString('ru')}`).join('\n')
        : 'Пока не выполнено ни одной задачи';

      const goalsText = currentGoals.map((g, i) => `${i + 1}. "${g.title}": ${g.description || 'Без описания'}`).join('\n');
      const weaknessesText = weaknesses.map(w => `- ${w.title}`).join('\n');

      const userContext = `СТАТИСТИКА ПОЛЬЗОВАТЕЛЯ:
- Уровень: ${userStats.level}
- Общий XP: ${userStats.total_xp}
- Серия активности: ${userStats.current_streak} ${userStats.current_streak === 1 ? 'день' : userStats.current_streak < 5 ? 'дня' : 'дней'}
- Лучшая серия: ${userStats.longest_streak} дней
- Выполнено задач: ${userStats.completed_tasks || 0}
- Активных целей: ${currentGoals.length}

НЕДАВНО ВЫПОЛНЕННЫЕ ЗАДАЧИ (последние 10):
${completedTasksText}

ТЕКУЩИЕ ЦЕЛИ (всего: ${currentGoals.length}):
${goalsText || 'Цели не указаны'}

СЛАБЫЕ СТОРОНЫ:
${weaknessesText || 'Не указаны'}

ЗАДАЧА:
На основе прогресса пользователя создай новые персонализированные задачи для продолжения развития.
Учитывай какие задачи уже выполнены, чтобы предложить следующие шаги.`;

      const requestParams = {
        model: DEFAULT_UPDATE_MODEL,
        reasoning: { effort: 'low' },
        instructions: `Ты - добрый коуч, который ХВАЛИТ за прогресс и создаёт ЕЖЕДНЕВНЫЕ чек-ины.

🎯 ГЛАВНЫЙ ПРИНЦИП: "Просто сделай что-то сегодня по каждой цели"

📊 СТРОГИЕ ПРАВИЛА (для КАЖДОЙ цели):
- Создавай РОВНО 5 задач на каждую цель
- ВСЕ задачи должны быть на ОДИН ДЕНЬ (estimated_days = 1)
- Распределение: 3 лёгкие (30-50 XP) + 1 средняя (60-80 XP) + 1 сложная (90-120 XP)
- Задачи = простые ДЕЙСТВИЯ, а не конкретные результаты

✅ ПРАВИЛЬНЫЕ ЗАДАЧИ (простые действия):
EASY (30-50 XP, 1 день):
- "Поработать над Beauty ботом сегодня" (40 XP)
- "Заняться спортом (любые упражнения)" (35 XP)
- "Сделать 1 урок Duolingo" (40 XP)
- "Уделить время бизнесу для студентов" (40 XP)

MEDIUM (60-80 XP, 1 день):
- "Поработать над Beauty ботом 30+ минут" (70 XP)
- "Тренировка 15+ минут" (65 XP)

HARD (90-120 XP, 1 день):
- "Поработать над Beauty ботом 1+ час" (100 XP)
- "Полноценная тренировка 30+ минут" (110 XP)

❌ НЕПРАВИЛЬНЫЕ ЗАДАЧИ:
- "Онбордить 3 клиентов" ❌ (слишком конкретно)
- "Серия 7 дней" ❌ (больше 1 дня)
- "Набрать 400+ XP" ❌ (конкретная метрика)

🎯 АДАПТАЦИЯ К ПРОГРЕССУ:
1. ПОХВАЛИ за выполненные задачи в progress_analysis
2. Если пользователь активен → можешь добавить чуть больше времени в описание (30+ минут вместо просто "поработать")
3. Если неактивен → делай МАКСИМАЛЬНО простые формулировки ("просто займись", "уделить время")
4. Все задачи на 1 день (estimated_days = 1)

Отвечай на русском языке.`,
        input: userContext,
        max_output_tokens: 8000,
        text: {
          format: {
            type: 'json_schema',
              name: 'update_development_plan',
            schema: UPDATE_PLAN_SCHEMA,
            strict: true
          }
        }
      };

      // Только используем previous_response_id если он начинается с 'resp-'
      // (старые ID от Chat Completions API начинаются с 'chatcmpl-')
      if (previousResponseId && previousResponseId.startsWith('resp')) {
        requestParams.previous_response_id = previousResponseId;
      }

      const response = await openai.responses.create(requestParams);

      // Проверяем статус ответа
      if (response.status !== 'completed') {
        console.error(`[DEBUG] Response not completed. Status: ${response.status}`);
        console.error(`[DEBUG] Incomplete details:`, JSON.stringify(response.incomplete_details, null, 2));
        console.error(`[DEBUG] Error:`, JSON.stringify(response.error, null, 2));
        console.error(`[DEBUG] Usage:`, JSON.stringify(response.usage, null, 2));
        throw new Error(`Response status is ${response.status}, expected 'completed'. Reason: ${response.incomplete_details?.reason || 'unknown'}`);
      }

      const updateData = this.parseJsonOutput(response, 'update plan');

      await this.saveConversationContext(userId, response.id, {
        previousResponseId,
        completed_tasks: completedTasks,
        update: updateData
      });

      return {
        responseId: response.id,
        update: updateData
      };
    } catch (error) {
      console.error('Error updating plan:', error);
      throw error;
    }
  }

  /**
   * Получение мотивационного сообщения
   */
  async getMotivationalMessage(userId, userStats, previousResponseId) {
    try {
      const requestParams = {
        model: DEFAULT_MOTIVATION_MODEL,
        reasoning: { effort: 'low' },
        instructions: `Ты - харизматичный мотивационный коуч в стиле Дэвида Гоггинса и Тони Роббинса. 
Твои сообщения должны ПИНАТЬ и ЗАЖИГАТЬ, а не просто хвалить.

Стиль:
- Используй МОЩНЫЕ цитаты великих людей (Стив Джобс, Брюс Ли, Нельсон Мандела, Конфуций и т.д.)
- Будь прямым и честным - говори о реальности, а не сладкие слова
- Создавай СРОЧНОСТЬ - "сейчас или никогда"
- Вызывай эмоции - страх упустить возможность, гордость за достижения
- Используй метафоры и яркие образы
- Заканчивай призывом к действию

Формат:
💪 [Мощная цитата от известной личности]

[2-3 предложения, которые ПИНАЮТ в действие]

🔥 [Конкретный призыв к действию СЕГОДНЯ]`,
        input: `Статистика пользователя: 
- Уровень: ${userStats.level}
- Опыт: ${userStats.total_xp} XP
- Серия активности: ${userStats.current_streak} ${userStats.current_streak === 1 ? 'день' : userStats.current_streak < 5 ? 'дня' : 'дней'}
- Выполнено задач: ${userStats.completed_tasks || 0}
- Активных целей: ${userStats.total_goals || 0}

Создай МОЩНОЕ мотивационное сообщение, которое заставит действовать ПРЯМО СЕЙЧАС!`,
        max_output_tokens: 2000 // Увеличено для reasoning + текста
      };

      // Только используем previous_response_id если он начинается с 'resp-'
      // (старые ID от Chat Completions API начинаются с 'chatcmpl-')
      if (previousResponseId && previousResponseId.startsWith('resp')) {
        requestParams.previous_response_id = previousResponseId;
      }

      const response = await openai.responses.create(requestParams);

      // Проверяем статус
      if (response.status !== 'completed') {
        console.error(`[DEBUG] Motivation response not completed. Status: ${response.status}`);
        console.error(`[DEBUG] Incomplete details:`, JSON.stringify(response.incomplete_details, null, 2));
        throw new Error(`Response status is ${response.status}, expected 'completed'. Reason: ${response.incomplete_details?.reason || 'unknown'}`);
      }

      const message = this.extractPlainText(response)?.trim();

      if (!message) {
        console.error('[DEBUG] Empty motivation message. Response:', JSON.stringify({
          status: response.status,
          outputLength: response.output?.length,
          outputTypes: response.output?.map(o => o.type)
        }, null, 2));
        throw new Error('Пустой ответ от модели при генерации мотивационного сообщения');
      }

      await this.saveConversationContext(userId, response.id, {
        previousResponseId,
        type: 'motivation',
        stats: userStats
      });

      return {
        responseId: response.id,
        message
      };
    } catch (error) {
      console.error('Error getting motivational message:', error);
      throw error;
    }
  }

  /**
   * Форматирование контекста пользователя для модели
   */
  formatUserContext(goals, weaknesses) {
    const goalsText = goals.map((g, i) => `${i + 1}. "${g.title}": ${g.description || 'Без описания'} (Категория: ${g.category || 'общее'}, Приоритет: ${g.priority}/5)`).join('\n');
    const weaknessesText = weaknesses.map((w, i) => `${i + 1}. "${w.title}": ${w.description || 'Без описания'} (Важность: ${w.severity}/5)`).join('\n');

    // Список всех целей для AI
    const goalsList = goals.map((g, i) => `Цель #${i + 1}: "${g.title}"`).join('\n');

    return `Пожалуйста, проанализируй следующую информацию и создай персонализированный план развития:

ЦЕЛИ ПОЛЬЗОВАТЕЛЯ (всего: ${goals.length}):
${goalsText || 'Цели не указаны'}

СЛАБЫЕ СТОРОНЫ (всего: ${weaknesses.length}):
${weaknessesText || 'Слабые стороны не указаны'}

⚠️ КРИТИЧЕСКИ ВАЖНО - ОБЯЗАТЕЛЬНО ПРОЧИТАЙ:
Ты ДОЛЖЕН создать задачи для КАЖДОЙ из этих ${goals.length} целей:
${goalsList}

НЕ пропускай ни одну цель! Проверь дважды, что для каждой цели есть хотя бы 2-3 задачи!

ТРЕБОВАНИЯ К ПЛАНУ:
- Создай 2-3 задачи для КАЖДОЙ цели (всего минимум ${goals.length * 2} задач)
- Задачи должны быть ПРОСТЫМИ и выполнимыми (70% easy, 25% medium, 5% hard)
- Распределение XP: easy (10-20 XP), medium (25-40 XP), hard (50-75 XP)
- Укажи estimated_days: easy (1-7 дней), medium (7-14 дней), hard (max 30 дней)
- В поле category укажи ТОЧНОЕ название цели, к которой относится задача
- Учитывай слабые стороны при создании задач`;
  }

  /**
   * Сохранение контекста разговора в БД
   */
  async saveConversationContext(userId, responseId, conversationData) {
    try {
      await pool.query(
        `INSERT INTO conversations (user_id, previous_response_id, conversation_data)
         VALUES ($1, $2, $3)`,
        [userId, responseId, JSON.stringify(conversationData)]
      );
    } catch (error) {
      console.error('Error saving conversation context:', error);
    }
  }

  /**
   * Получение последнего response_id для пользователя
   */
  async getLastResponseId(userId) {
    try {
      const result = await pool.query(
        `SELECT previous_response_id FROM conversations 
         WHERE user_id = $1 
         ORDER BY created_at DESC 
         LIMIT 1`,
        [userId]
      );
      return result.rows[0]?.previous_response_id || null;
    } catch (error) {
      console.error('Error getting last response ID:', error);
      return null;
    }
  }

  /**
   * Генерация персональных наград на основе слабостей и целей пользователя
   */
  async generatePersonalRewards(userId, weaknesses, goals = []) {
    try {
      const weaknessesText = weaknesses
        .map(w => `- ${w.title}: ${w.description || 'Без описания'} (Важность: ${w.severity}/5)`)
        .join('\n');
      
      const goalsText = goals.length > 0 
        ? goals.map(g => `- ${g.title}: ${g.description || 'Без описания'} (Приоритет: ${g.priority}/5)`).join('\n')
        : 'Цели не указаны';

      const REWARDS_SCHEMA = {
        type: 'object',
        additionalProperties: false,
        required: ['rewards'],
        properties: {
          rewards: {
            type: 'array',
            minItems: 3,
            maxItems: 10,
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['name', 'description', 'xp_cost', 'icon', 'duration_minutes'],
              properties: {
                name: {
                  type: 'string',
                  minLength: 5,
                  description: 'Название награды (например: "1 час игр с друзьями")'
                },
                description: {
                  type: 'string',
                  minLength: 10,
                  description: 'Описание награды и почему она подходит'
                },
                xp_cost: {
                  type: 'integer',
                  minimum: 50,
                  maximum: 500,
                  description: 'Стоимость в XP (зависит от "вредности" привычки)'
                },
                icon: {
                  type: 'string',
                  minLength: 1,
                  maxLength: 2,
                  description: 'Эмодзи иконка для награды'
                },
                duration_minutes: {
                  type: 'integer',
                  minimum: 0,
                  description: 'Длительность награды в минутах (30 мин = 30, 1 час = 60, 3 часа = 180). Поставь 0 если награда без таймера'
                }
              }
            }
          }
        }
      };

      const requestParams = {
        model: DEFAULT_MOTIVATION_MODEL,
        reasoning: { effort: 'low' }, // Low для более умной генерации с учетом контекста
        instructions: `Ты - добрый AI-коуч, который помогает пользователю НАСЛАЖДАТЬСЯ жизнью, работая над целями.

🎯 ГЛАВНЫЙ ПРИНЦИП: Награды должны быть ДОСТУПНЫМИ и ЖЕЛАННЫМИ, а не наказанием за слабость!

КОНТЕКСТ ПОЛЬЗОВАТЕЛЯ:
- Слабости: показывают, что любит делать пользователь (это НЕ плохо!)
- Цели: показывают, к чему он стремится

ТВОЯ ЗАДАЧА:
Создать ПРОСТЫЕ, ДОСТУПНЫЕ награды, которые мотивируют зарабатывать XP.

ПРАВИЛА ГЕНЕРАЦИИ НАГРАД:
1. **Награды = контролируемое удовольствие**
   - Если слабость = "играю 3 часа в день" → награды по 30-60 минут (не 15!)
   - Пользователь должен ХОТЕТЬ заработать XP, а не чувствовать вину
   
2. **Цена должна быть ДОСТУПНОЙ**
   - Маленькие награды: 40-60 XP (30 мин) ← ОСНОВА
   - Средние награды: 70-100 XP (1 час) 
   - Большие награды: 120-200 XP (1.5-2 часа) ← максимум 2-3 таких награды
   
3. **Разнообразие по времени и форме**
   - "30 минут игр соло"
   - "45 минут игр с друзьями"
   - "1 час любимой игры"
   - "30 минут + выучить 5 новых слов"
   - "1 час в выходной"

4. **Позитивные формулировки**
   ✅ "30 минут игр для расслабления"
   ✅ "1 час игр с друзьями по видеозвонку"
   ❌ "Играть, но НЕ дольше 30 минут"
   ❌ "Только одна катка"

5. **Умные комбинации (опционально)**
   - Если есть цель "английский" → предложи 1-2 награды на английском
   - Но НЕ ВСЕ награды должны быть "полезными"!
   - Можно просто "30 минут игр" без дополнительных условий

ПРИМЕРЫ ХОРОШИХ НАГРАД:
- "🎮 30 минут любимой игры" (50 XP, duration_minutes: 30)
- "🎮 45 минут игр с друзьями" (70 XP, duration_minutes: 45)
- "🎮 1 час игр в выходной" (100 XP, duration_minutes: 60)
- "🎮 3 часа игр с друзьями" (180 XP, duration_minutes: 180)
- "🍕 Заказать пиццу" (80 XP, duration_minutes: 0) ← без таймера

❌ ПЛОХИЕ НАГРАДЫ (слишком сложно):
- "2 часа игр, если Duolingo 6+ дней" (280 XP)
- "30 минут вместо игры — смотреть гайды" (60 XP)
- "Игры на английском + словарик" (80 XP)

ВАЖНО про duration_minutes:
- Если награда связана со временем ("30 минут", "1 час", "3 часа") → укажи точное время в минутах
- Если награда единоразовая без времени ("заказать пиццу", "купить десерт") → duration_minutes: 0

Отвечай на русском языке. Генерируй 6-9 наград.`,
        input: `ЦЕЛИ ПОЛЬЗОВАТЕЛЯ:\n${goalsText}\n\nСЛАБЫЕ СТОРОНЫ:\n${weaknessesText || 'Слабые стороны не указаны'}`,
        max_output_tokens: 3000,
        text: {
          format: {
            type: 'json_schema',
            name: 'generate_personal_rewards',
            schema: REWARDS_SCHEMA,
            strict: true
          }
        }
      };

      const response = await openai.responses.create(requestParams);
      
      // Проверяем статус ответа
      if (response.status !== 'completed') {
        console.error(`[DEBUG] Response not completed. Status: ${response.status}`);
        console.error(`[DEBUG] Incomplete details:`, JSON.stringify(response.incomplete_details, null, 2));
        console.error(`[DEBUG] Error:`, JSON.stringify(response.error, null, 2));
        console.error(`[DEBUG] Usage:`, JSON.stringify(response.usage, null, 2));
        throw new Error(`Response status is ${response.status}, expected 'completed'. Reason: ${response.incomplete_details?.reason || 'unknown'}`);
      }
      
      const rewardsData = this.parseJsonOutput(response, 'personal rewards');

      return {
        responseId: response.id,
        rewards: rewardsData.rewards
      };
    } catch (error) {
      console.error('Error generating personal rewards:', error);
      throw error;
    }
  }

  parseJsonOutput(response, context) {
    try {
      // Отладка: выводим структуру ответа
      console.log(`[DEBUG] Response structure for ${context}:`, JSON.stringify({
        hasOutputText: !!response?.output_text,
        hasOutput: Array.isArray(response?.output),
        outputLength: response?.output?.length,
        firstOutputType: response?.output?.[0]?.type,
        firstOutputRole: response?.output?.[0]?.role,
        contentLength: response?.output?.[0]?.content?.length,
        firstContentType: response?.output?.[0]?.content?.[0]?.type
      }, null, 2));

      const textFromHelper = this.extractPlainText(response);
      const rawOutput = textFromHelper?.trim();

      if (!rawOutput) {
        console.error(`[DEBUG] Empty output for ${context}. Full response:`, JSON.stringify(response, null, 2));
        throw new Error('Empty output_text');
      }

      // Пытаемся парсить JSON
      try {
        return JSON.parse(rawOutput);
      } catch (parseError) {
        // Если JSON невалидный, логируем для отладки
        console.error(`[DEBUG] Invalid JSON for ${context}:`, rawOutput.substring(0, 500));
        throw parseError;
      }
    } catch (error) {
      console.error(`Failed to parse ${context} response:`, error);
      throw new Error(`Ошибка обработки ответа OpenAI (${context})`);
    }
  }

  extractPlainText(response) {
    // НЕ используем SDK output_text, так как он может быть неполным при стриминге
    // Всегда извлекаем из output массива
    
    if (!Array.isArray(response?.output)) {
      console.log('[DEBUG] No output array found');
      return '';
    }

    console.log('[DEBUG] Output array items:', response.output.map(item => ({
      type: item?.type,
      role: item?.role,
      status: item?.status,
      hasContent: Array.isArray(item?.content),
      contentLength: item?.content?.length,
      contentTypes: item?.content?.map(c => c?.type)
    })));

    // Извлекаем текст только из message items с output_text
    const text = response.output
      .filter(item => item?.type === 'message' && item?.role === 'assistant' && Array.isArray(item.content))
      .flatMap(item => item.content)
      .filter(piece => piece?.type === 'output_text' && typeof piece.text === 'string')
      .map(piece => piece.text)
      .join('');
    
    console.log('[DEBUG] Extracted text length:', text.length);
    
    if (text.length === 0) {
      // Если нет message items, проверяем, может быть response еще не завершен
      console.log('[DEBUG] No message output found. Response status:', response.status);
      console.log('[DEBUG] Full output structure:', JSON.stringify(response.output, null, 2));
    }
    
    return text;
  }

  /**
   * Чат с AI о конкретной цели
   * @param {number} userId - ID пользователя
   * @param {number} goalId - ID цели
   * @param {string} userMessage - Сообщение от пользователя
   * @param {Array} chatHistory - История чата (опционально)
   * @returns {Promise<{message: string, roadmap: Array|null, metadata: Object}>}
   */
  async chatAboutGoal(userId, goalId, userMessage, chatHistory = [], previousResponseId = null) {
    try {
      // Получаем информацию о цели
      const goalResult = await pool.query(
        'SELECT * FROM goals WHERE id = $1 AND user_id = $2',
        [goalId, userId]
      );

      if (goalResult.rows.length === 0) {
        throw new Error('Цель не найдена');
      }

      const goal = goalResult.rows[0];

      // Получаем количество задач для этой цели
      const tasksResult = await pool.query(
        'SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE completed_at IS NOT NULL) as completed FROM tasks WHERE goal_id = $1 AND user_id = $2',
        [goalId, userId]
      );
      const taskStats = tasksResult.rows[0];

      // Получаем текущий контекст цели (если есть)
      const contextResult = await pool.query(
        'SELECT * FROM goal_context WHERE goal_id = $1 AND user_id = $2',
        [goalId, userId]
      );

      const context = contextResult.rows[0] || null;

      // Формируем системный промпт с методологией SMART + GROW
      const systemPrompt = `Ты — AI-коуч, использующий комбинированный метод SMART + GROW + итеративный анализ.

Твоя задача — помогать пользователю формулировать ясные, достижимые цели,
задавать уточняющие вопросы, предлагать варианты действий и обновлять план после обратной связи.

🎯 СТРУКТУРА РАЗГОВОРА: 8-10 вопросов → roadmap → предложить создать задачи → завершение
⏱️ Общее время разговора: 10-15 минут максимум

📋 ПОСЛЕ СОЗДАНИЯ ROADMAP:
Когда ты создал roadmap и пользователь его одобрил, ОБЯЗАТЕЛЬНО скажи:
"Отлично! План сохранён. Хочешь, чтобы я создал конкретные задачи на ближайшие дни из этого плана? Они появятся в разделе 'Задачи' 📝"

⚠️ КРИТИЧЕСКИ ВАЖНО: 
- НЕ давай готовые решения ("Ты можешь сделать X или Y")
- НЕ предлагай варианты первым
- ПОМОГАЙ человеку САМОМУ найти ответы через вопросы
- Работай циклами: цель → реальность → варианты → действия → рефлексия → новый цикл

Если человек говорит "не знаю" или "помоги" — НЕ давай ответ сразу!
Вместо этого задай вопрос: "Что ты уже пробовал узнать об этом?" или "Где бы ты мог найти эту информацию?"

🎯 ИНФОРМАЦИЯ О ЦЕЛИ:
Название: ${goal.title}
Категория: ${goal.category}
Описание: ${goal.description || 'Не указано'}
Приоритет: ${goal.priority === 1 ? '🔴 Критичная' : goal.priority === 2 ? '🟠 Высокая' : goal.priority === 3 ? '🟡 Средняя' : '🟢 Низкая'}
Статус: ${goal.status === 'active' ? 'Активная' : goal.status === 'completed' ? 'Завершена' : 'На паузе'}
Дата создания: ${new Date(goal.created_at).toLocaleDateString('ru-RU')}
${taskStats.total > 0 ? `Прогресс: ${taskStats.completed} из ${taskStats.total} задач выполнено` : 'Задач пока нет'}

${context ? `
📍 ТЕКУЩИЙ КОНТЕКСТ:
Текущий этап: ${context.current_stage + 1}
План (roadmap): ${JSON.stringify(context.roadmap, null, 2)}
Предпочтения: ${JSON.stringify(context.preferences, null, 2)}
Заметки AI: ${context.ai_notes || 'Нет'}
` : ''}

🔄 МЕТОДОЛОГИЯ (SMART + GROW):

1️⃣ SMART - Формулировка цели:
   S (Specific) - Конкретная: "Что именно ты хочешь достичь?"
   M (Measurable) - Измеримая: "Как ты поймёшь, что достиг цели?"
   A (Achievable) - Достижимая: "Что у тебя уже есть для этого?"
   R (Relevant) - Значимая: "Почему это важно для тебя?"
   T (Time-bound) - Ограниченная во времени: "К какому сроку?"

2️⃣ GROW - Коучинговый цикл:
   G (Goal) - Цель: Что ты хочешь достичь?
   R (Reality) - Реальность: Где ты сейчас? Что уже сделано?
   O (Options) - Варианты: Какие есть способы достичь цели?
   W (Will) - Действия: Что ты сделаешь первым? Когда?

3️⃣ ИТЕРАТИВНЫЙ АНАЛИЗ:
   - После каждого ответа пользователя → анализируй и уточняй
   - Не переходи к следующему вопросу, пока не получишь ясность
   - Помогай разбивать большие цели на маленькие шаги
   - Задавай открытые вопросы: "Что?", "Как?", "Когда?"

🎨 СТИЛЬ ОБЩЕНИЯ:
- Задавай вопросы по одному (не список!)
- Используй эмодзи для наглядности
- Говори простым языком, без жаргона
- Будь поддерживающим, но не навязчивым
- Отражай слова пользователя: "Ты сказал, что... Правильно?"

📋 ПРОЦЕСС СОЗДАНИЯ ПЛАНА (СТРОГО 8-10 ВОПРОСОВ):

⚠️ ВАЖНО: Задавай вопросы ПО ОДНОМУ, не больше! После 8-10 вопросов ОБЯЗАТЕЛЬНО создай roadmap.

Шаг 1: SMART-анализ (5 вопросов)
   1. Что конкретно ты хочешь достичь?
   2. Как ты поймёшь, что достиг цели?
   3. Что у тебя уже есть для этого? (навыки, время, ресурсы)
   4. Почему это важно для тебя?
   5. К какому сроку ты хочешь это сделать?

Шаг 2: GROW-анализ (2-3 вопроса)
   6. Где ты сейчас на пути к этой цели?
   7. Что мешает двигаться вперёд?
   8. (опционально) Что уже пробовал?

Шаг 3: Варианты действий (1-2 вопроса)
   9. Какие способы достичь цели ты видишь?
   10. (опционально) Что кажется самым простым началом?

Шаг 4: Создание roadmap (3-5 этапов)
   ПОСЛЕ 8-10 вопросов ОБЯЗАТЕЛЬНО предложи план:
   
   "Отлично! На основе нашего разговора я вижу путь из 3 этапов:
   
   📍 Этап 1: [Название] ([Срок])
   [Описание: что нужно сделать, чтобы перейти к следующему этапу]
   
   📍 Этап 2: [Название] ([Срок])
   [Описание]
   
   📍 Этап 3: [Название] ([Срок])
   [Описание]
   
   Что думаешь? Что-то нужно изменить?"

Шаг 5: Рефлексия и корректировка (1-2 вопроса)
   - Спрашивай обратную связь: "Что думаешь?"
   - Если человек согласен с планом → ЗАВЕРШАЙ разговор фразой:
     "Отлично! План сохранён. Возвращайся сюда когда захочешь обсудить прогресс или скорректировать план. Удачи! 🚀"
   - Если человек хочет изменить → корректируй план и снова спрашивай обратную связь
   - Максимум 2 итерации корректировок, потом всё равно сохраняй план

🔄 ЕСЛИ ПЛАН УЖЕ СОЗДАН:
- Спрашивай о прогрессе: "Как продвигается этап X?"
- Помогай преодолевать препятствия: "Что мешает?"
- Предлагай корректировки: "Может, изменим план?"
- Мотивируй через вопросы: "Что уже получилось?"

⚡ ПРИМЕРЫ ХОРОШИХ ВОПРОСОВ:
- "Что конкретно ты хочешь получить в итоге?"
- "Как ты поймёшь, что цель достигнута?"
- "Что у тебя уже есть для этого?"
- "Что было бы самым простым первым шагом?"
- "Когда ты мог бы это сделать?"
- "Что может помешать?"
- "Как ты справлялся с похожими задачами раньше?"
- "Что ты уже пробовал узнать об этом?"
- "Где бы ты мог найти эту информацию?"
- "Кто мог бы тебе в этом помочь?"
- "Что ты сам думаешь по этому поводу?"

❌ ИЗБЕГАЙ:
- Давать готовые решения ("Тебе нужно сделать X")
- Оценивать действия пользователя ("Это плохая идея")
- Задавать несколько вопросов сразу
- Использовать сложные термины
- Быть слишком формальным

Отвечай на русском языке. Помни: ты помогаешь человеку САМОМУ найти свой путь, а не указываешь дорогу.`;

      // Формируем input для Responses API
      // Первое сообщение - это instructions (system prompt)
      // Остальные - история чата
      const input = [
        { role: 'developer', content: systemPrompt },
        ...chatHistory.map(msg => ({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content
        })),
        { role: 'user', content: userMessage }
      ];

      // Отправляем запрос к OpenAI через Responses API
      console.log(`[CHAT-AI] 🚀 Calling OpenAI Responses API with ${input.length} messages, previous_response_id: ${previousResponseId}...`);
      
      const requestParams = {
        model: DEFAULT_PLAN_MODEL,
        input: input,
        reasoning: { effort: 'low' }, // Быстрые ответы для чата
        text: { verbosity: 'medium' }, // Средняя многословность
        max_output_tokens: 8000, // Увеличено для reasoning + ответ
      };

      // Добавляем previous_response_id для передачи CoT между турами
      if (previousResponseId && previousResponseId.startsWith('resp-')) {
        requestParams.previous_response_id = previousResponseId;
        console.log(`[CHAT-AI] ✅ Using previous_response_id for CoT transfer`);
      }

      const response = await openai.responses.create(requestParams);

      // Проверяем статус ответа
      if (response.status !== 'completed') {
        console.error(`[CHAT-AI] Response not completed. Status: ${response.status}`);
        throw new Error(`Response status is ${response.status}`);
      }

      console.log(`[CHAT-AI] 📦 Response status: ${response.status}`);
      const assistantMessage = response.output_text || '';
      console.log(`[CHAT-AI] 💬 Assistant message: "${assistantMessage.substring(0, 100)}..."`);
      console.log(`[CHAT-AI] 📏 Message length: ${assistantMessage.length}`);

      // Пытаемся извлечь план из ответа (если AI создал его)
      let roadmap = null;
      let metadata = {};

      // Простая эвристика: если в ответе есть "Этап" и эмодзи 📍
      if (assistantMessage.includes('📍') && assistantMessage.includes('Этап')) {
        // Извлекаем этапы
        const stageRegex = /📍\s*Этап\s*(\d+):\s*([^\n]+)\n([^\n📍]+)/g;
        const stages = [];
        let match;

        while ((match = stageRegex.exec(assistantMessage)) !== null) {
          stages.push({
            stage: parseInt(match[1]),
            title: match[2].trim(),
            description: match[3].trim(),
            completed: false
          });
        }

        if (stages.length > 0) {
          roadmap = stages;
          metadata.roadmapCreated = true;
        }
      }

      return {
        message: assistantMessage,
        roadmap: roadmap,
        metadata: metadata,
        responseId: response.id // Для передачи CoT в следующем запросе
      };

    } catch (error) {
      console.error('Error in chatAboutGoal:', error);
      throw error;
    }
  }

  /**
   * Генерация задач из roadmap
   */
  async generateTasksFromRoadmap(userId, goalId, roadmap, daysToGenerate = 7) {
    try {
      console.log(`[ROADMAP-TASKS] 🎯 Generating tasks for goal ${goalId}, ${daysToGenerate} days`);

      // Получаем информацию о цели
      const goalResult = await pool.query(
        'SELECT * FROM goals WHERE id = $1 AND user_id = $2',
        [goalId, userId]
      );

      if (goalResult.rows.length === 0) {
        throw new Error('Цель не найдена');
      }

      const goal = goalResult.rows[0];

      // Формируем промпт для генерации задач
      const prompt = `Ты — AI-коуч. У пользователя есть цель и roadmap. Твоя задача — создать конкретные, выполнимые задачи на ближайшие ${daysToGenerate} дней.

🎯 ЦЕЛЬ:
Название: ${goal.title}
Описание: ${goal.description || 'Не указано'}
Категория: ${goal.category}

📍 ROADMAP (этапы):
${JSON.stringify(roadmap, null, 2)}

📋 ТРЕБОВАНИЯ К ЗАДАЧАМ:
1. Создай задачи на ${daysToGenerate} дней
2. Каждый день должен иметь 3-5 задач разной сложности:
   - 2-3 легких задачи (Easy): 30-50 XP, 15-30 минут
   - 1-2 средних задачи (Medium): 60-80 XP, 30-60 минут
   - 0-1 сложная задача (Hard): 90-120 XP, 1-2 часа
3. Задачи должны быть КОНКРЕТНЫМИ и ДЕЙСТВЕННЫМИ (не "подумать", а "сделать")
4. Задачи должны следовать логике roadmap (начинай с Этапа 1)
5. Каждая задача должна иметь:
   - title: краткое название (макс 60 символов)
   - description: что именно нужно сделать
   - difficulty: "easy", "medium" или "hard"
   - xp_reward: награда в XP (см. выше)
   - estimated_days: всегда 1 (задачи на один день)
   - roadmap_stage: номер этапа из roadmap (1, 2, 3, 4...)
   - day: день выполнения (1-${daysToGenerate})

ВАЖНО: Распределяй задачи равномерно по дням. Не перегружай первые дни!

Верни JSON объект с полем "tasks" (массив задач).`;

      const TASKS_SCHEMA = {
        type: 'object',
        properties: {
          tasks: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string', maxLength: 100 },
                description: { type: 'string' },
                difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
                xp_reward: { type: 'integer', minimum: 30, maximum: 120 },
                estimated_days: { type: 'integer', enum: [1] },
                roadmap_stage: { type: 'integer', minimum: 1 },
                day: { type: 'integer', minimum: 1, maximum: daysToGenerate }
              },
              required: ['title', 'description', 'difficulty', 'xp_reward', 'estimated_days', 'roadmap_stage', 'day'],
              additionalProperties: false
            }
          }
        },
        required: ['tasks'],
        additionalProperties: false
      };

      const requestParams = {
        model: DEFAULT_PLAN_MODEL,
        reasoning: { effort: 'medium' },
        input: prompt, // Используем input вместо instructions для Responses API
        text: {
          format: {
            type: 'json_schema',
            name: 'generate_tasks_from_roadmap',
            schema: TASKS_SCHEMA,
            strict: true
          }
        },
        max_output_tokens: 10000
      };

      const response = await openai.responses.create(requestParams);

      if (response.status !== 'completed') {
        console.error(`[ROADMAP-TASKS] Response not completed. Status: ${response.status}`);
        throw new Error(`Response status is ${response.status}`);
      }

      const output = this.parseJsonOutput(response, 'roadmap tasks');
      const tasks = output.tasks || [];
      console.log(`[ROADMAP-TASKS] ✅ Generated ${tasks.length} tasks`);

      return tasks;

    } catch (error) {
      console.error('Error generating tasks from roadmap:', error);
      throw error;
    }
  }
}

export default new OpenAIService();

