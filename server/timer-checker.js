import pool from './database.js';
import bot from './bot.js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Фоновый процесс для проверки истёкших таймеров наград
 * Каждую минуту проверяет, не истекли ли таймеры, и отправляет уведомления
 */

class TimerChecker {
  constructor() {
    this.checkInterval = 60 * 1000; // Проверяем каждую минуту
    this.isRunning = false;
  }

  /**
   * Запустить проверку таймеров
   */
  start() {
    if (this.isRunning) {
      console.log('⚠️ Timer checker already running');
      return;
    }

    this.isRunning = true;
    console.log('⏱️ Timer checker started');

    // Первая проверка сразу
    this.checkExpiredTimers();

    // Затем проверяем каждую минуту
    this.intervalId = setInterval(() => {
      this.checkExpiredTimers();
    }, this.checkInterval);
  }

  /**
   * Остановить проверку таймеров
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('⏱️ Timer checker stopped');
  }

  /**
   * Проверить истёкшие таймеры и отправить уведомления
   */
  async checkExpiredTimers() {
    try {
      // Находим все истёкшие таймеры, по которым ещё не отправлено уведомление
      const result = await pool.query(
        `SELECT 
          up.id as purchase_id,
          up.user_id,
          up.expires_at,
          si.name as reward_name,
          si.icon,
          si.duration_minutes,
          u.telegram_id
         FROM user_purchases up
         JOIN shop_items si ON si.id = up.item_id
         JOIN users u ON u.id = up.user_id
         WHERE up.activated_at IS NOT NULL
           AND up.expires_at <= NOW()
           AND up.notification_sent = FALSE
           AND up.is_used = FALSE`
      );

      if (result.rows.length === 0) {
        return; // Нет истёкших таймеров
      }

      console.log(`⏰ Found ${result.rows.length} expired timer(s)`);

      for (const timer of result.rows) {
        try {
          await this.sendNotification(timer);
          await this.markTimerAsCompleted(timer.purchase_id);
        } catch (error) {
          console.error(`Error processing timer ${timer.purchase_id}:`, error);
        }
      }
    } catch (error) {
      console.error('Error checking expired timers:', error);
    }
  }

  /**
   * Отправить уведомление пользователю об истёкшем таймере
   */
  async sendNotification(timer) {
    try {
      const message = `
⏰ **Время вышло!**

${timer.icon} ${timer.reward_name}

Ты использовал свою награду (${timer.duration_minutes} мин).
Надеюсь, тебе понравилось! 🎉

Продолжай выполнять задачи и зарабатывать XP! 💪
      `;

      await bot.sendMessage(timer.telegram_id, message, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🎮 Открыть приложение', web_app: { url: process.env.WEBAPP_URL } }]
          ]
        }
      });

      console.log(`✅ Notification sent to user ${timer.user_id} (${timer.reward_name})`);
    } catch (error) {
      console.error(`Error sending notification to user ${timer.user_id}:`, error);
      throw error;
    }
  }

  /**
   * Пометить таймер как завершённый
   */
  async markTimerAsCompleted(purchaseId) {
    try {
      await pool.query(
        `UPDATE user_purchases
         SET is_used = TRUE,
             used_at = NOW(),
             notification_sent = TRUE
         WHERE id = $1`,
        [purchaseId]
      );

      console.log(`✓ Timer ${purchaseId} marked as completed`);
    } catch (error) {
      console.error(`Error marking timer ${purchaseId} as completed:`, error);
      throw error;
    }
  }
}

const timerChecker = new TimerChecker();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down timer checker...');
  timerChecker.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down timer checker...');
  timerChecker.stop();
  process.exit(0);
});

export default timerChecker;

