import { Bot, Keyboard, InlineKeyboard } from 'grammy';
import dotenv from 'dotenv';
import { Users } from './models.js';

dotenv.config();

const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN);
const WEBAPP_URL = process.env.WEBAPP_URL;

/**
 * Telegram Bot для XP Game (grammy version)
 */

// Команда /start
bot.command('start', async (ctx) => {
  const telegramId = ctx.from.id;
  const username = ctx.from.username;
  const firstName = ctx.from.first_name;
  const lastName = ctx.from.last_name;

  try {
    // Создаем или находим пользователя
    const user = await Users.findOrCreate(telegramId, username, firstName, lastName);

    const welcomeMessage = `
👋 Привет, ${firstName}!

Добро пожаловать в **XP Game** - твоего личного коуча по развитию!

🎯 Что я умею:
• Помогаю ставить и достигать цели
• Создаю персонализированный план развития
• Отслеживаю твой прогресс
• Начисляю XP и награды за выполнение задач
• Мотивирую тебя двигаться вперед

🚀 Начни свое путешествие к успеху прямо сейчас!
    `;

    // Создаем клавиатуру с веб-приложением
    const keyboard = new Keyboard()
      .webApp('🎮 Открыть XP Game', WEBAPP_URL)
      .row()
      .text('📊 Моя статистика').text('🏆 Достижения')
      .row()
      .text('🎁 Ежедневный бонус').text('❓ Помощь')
      .resized();

    await ctx.reply(welcomeMessage, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  } catch (error) {
    console.error('Error in /start command:', error);
    await ctx.reply('Произошла ошибка. Попробуйте позже.');
  }
});

// Команда /stats
bot.command('stats', async (ctx) => {
  const telegramId = ctx.from.id;

  try {
    const user = await Users.findByTelegramId(telegramId);
    if (!user) {
      return ctx.reply('Сначала используйте /start');
    }

    const stats = await Users.getStats(user.id);
    
    const statsMessage = `
📊 **Твоя статистика**

👤 Уровень: **${stats.level}**
⭐ Всего XP: **${stats.total_xp}**
💰 Доступно XP: **${stats.available_xp}**
🔥 Текущая серия: **${stats.current_streak} дней**
📈 Лучшая серия: **${stats.longest_streak} дней**

🎯 Целей: **${stats.total_goals}**
✅ Выполнено задач: **${stats.completed_tasks}**
⏳ Активных задач: **${stats.pending_tasks}**
🏆 Достижений: **${stats.achievements_unlocked}**
    `;

    const inlineKeyboard = new InlineKeyboard()
      .webApp('🎮 Открыть приложение', WEBAPP_URL);

    await ctx.reply(statsMessage, {
      parse_mode: 'Markdown',
      reply_markup: inlineKeyboard
    });
  } catch (error) {
    console.error('Error in /stats command:', error);
    await ctx.reply('Ошибка получения статистики.');
  }
});

// Команда /help
bot.command('help', async (ctx) => {
  const helpMessage = `
❓ **Помощь по XP Game**

**Как это работает:**
1️⃣ Укажи свои цели и слабые стороны
2️⃣ Получи персонализированный план от AI
3️⃣ Выполняй задачи и получай XP
4️⃣ Повышай уровень и открывай достижения

**Система XP:**
🟢 Легкие задачи: 30-50 XP ⚡
🟡 Средние задачи: 60-80 XP 💪
🔴 Сложные задачи: 90-120 XP 🔥

**За 2-3 задачи = награда в магазине!** 🛒

**Магазин:**
🎁 Покупай награды за заработанный XP
⚡ Используй бустеры для ускорения прогресса

**Серии:**
Выполняй задачи каждый день, чтобы поддерживать серию и получать бонусы!

**Команды:**
/start - Начать работу
/stats - Твоя статистика
/help - Эта справка

🎮 Используй кнопку "Открыть XP Game" для полного доступа ко всем функциям!
  `;

  const inlineKeyboard = new InlineKeyboard()
    .webApp('🎮 Открыть приложение', WEBAPP_URL);

  await ctx.reply(helpMessage, {
    parse_mode: 'Markdown',
    reply_markup: inlineKeyboard
  });
});

// Обработчик кнопок клавиатуры
bot.hears('📊 Моя статистика', async (ctx) => {
  const telegramId = ctx.from.id;

  try {
    const user = await Users.findByTelegramId(telegramId);
    if (!user) return;

    const stats = await Users.getStats(user.id);
    const statsMessage = `
📊 **Твоя статистика**

👤 Уровень: **${stats.level}**
⭐ Всего XP: **${stats.total_xp}**
💰 Доступно XP: **${stats.available_xp}**
🔥 Текущая серия: **${stats.current_streak} дней**
📈 Лучшая серия: **${stats.longest_streak} дней**

🎯 Целей: **${stats.total_goals}**
✅ Выполнено задач: **${stats.completed_tasks}**
⏳ Активных задач: **${stats.pending_tasks}**
🏆 Достижений: **${stats.achievements_unlocked}**
    `;

    const inlineKeyboard = new InlineKeyboard()
      .webApp('🎮 Открыть приложение', WEBAPP_URL);

    await ctx.reply(statsMessage, {
      parse_mode: 'Markdown',
      reply_markup: inlineKeyboard
    });
  } catch (error) {
    console.error('Error handling stats message:', error);
  }
});

bot.hears('🏆 Достижения', async (ctx) => {
  const inlineKeyboard = new InlineKeyboard()
    .webApp('🏆 Посмотреть достижения', WEBAPP_URL);

  await ctx.reply('🏆 Открываю твои достижения...', {
    reply_markup: inlineKeyboard
  });
});

bot.hears('🎁 Ежедневный бонус', async (ctx) => {
  const inlineKeyboard = new InlineKeyboard()
    .webApp('🎁 Получить бонус', WEBAPP_URL);

  await ctx.reply('🎁 Открываю приложение для получения бонуса...', {
    reply_markup: inlineKeyboard
  });
});

bot.hears('❓ Помощь', async (ctx) => {
  const helpMessage = `
❓ **Помощь по XP Game**

**Как это работает:**
1️⃣ Укажи свои цели и слабые стороны
2️⃣ Получи персонализированный план от AI
3️⃣ Выполняй задачи и получай XP
4️⃣ Повышай уровень и открывай достижения

**Система XP:**
🟢 Легкие задачи: 30-50 XP ⚡
🟡 Средние задачи: 60-80 XP 💪
🔴 Сложные задачи: 90-120 XP 🔥

**За 2-3 задачи = награда в магазине!** 🛒

**Магазин:**
🎁 Покупай награды за заработанный XP
⚡ Используй бустеры для ускорения прогресса

**Серии:**
Выполняй задачи каждый день, чтобы поддерживать серию и получать бонусы!

**Команды:**
/start - Начать работу
/stats - Твоя статистика
/help - Эта справка

🎮 Используй кнопку "Открыть XP Game" для полного доступа ко всем функциям!
  `;

  await ctx.reply(helpMessage, { parse_mode: 'Markdown' });
});

// Обработка данных из Web App
bot.on('message:web_app_data', async (ctx) => {
  const data = JSON.parse(ctx.message.web_app_data.data);

  console.log('Received web app data:', data);

  // Можно обработать различные события из веб-приложения
  switch (data.type) {
    case 'task_completed':
      await ctx.reply(`✅ Отлично! Ты выполнил задачу и получил ${data.xp} XP!`);
      break;
    
    case 'level_up':
      await ctx.reply(`🎉 Поздравляем! Ты достиг ${data.level} уровня!`);
      break;

    case 'achievement_unlocked':
      await ctx.reply(`🏆 Новое достижение разблокировано: ${data.achievement}!`);
      break;
  }
});

// Обработка ошибок
bot.catch((err) => {
  console.error('Bot error:', err);
});

// Запуск бота
bot.start();
console.log('✓ Telegram bot started (grammy)');

export default bot;
