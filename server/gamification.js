import { Users, Tasks, Achievements, XPHistory } from './models.js';
import pool from './database.js';

/**
 * Gamification Service
 * Управление системой баллов, уровней и достижений
 */
class GamificationService {
  /**
   * Расчет XP в зависимости от сложности задачи
   */
  calculateXP(difficulty) {
    const xpMap = {
      easy: 15,
      medium: 35,
      hard: 75
    };
    return xpMap[difficulty] || 25;
  }

  /**
   * Расчет уровня по общему XP
   */
  calculateLevel(totalXP) {
    // Формула: level = floor(sqrt(totalXP / 100)) + 1
    return Math.floor(Math.sqrt(totalXP / 100)) + 1;
  }

  /**
   * Сколько XP нужно для следующего уровня
   */
  getXPForNextLevel(currentLevel) {
    // XP для достижения уровня = (level - 1)^2 * 100
    return Math.pow(currentLevel, 2) * 100;
  }

  /**
   * Получение прогресса до следующего уровня (в процентах)
   */
  getLevelProgress(totalXP, currentLevel) {
    const currentLevelXP = Math.pow(currentLevel - 1, 2) * 100;
    const nextLevelXP = Math.pow(currentLevel, 2) * 100;
    const xpInCurrentLevel = Math.max(0, totalXP - currentLevelXP); // Не может быть отрицательным
    const xpNeededForLevel = nextLevelXP - currentLevelXP;
    
    // Вычисляем процент, но не даём ему быть отрицательным
    const percentage = Math.max(0, Math.min(Math.round((xpInCurrentLevel / xpNeededForLevel) * 100), 100));
    
    return {
      current: xpInCurrentLevel,
      needed: xpNeededForLevel,
      percentage
    };
  }

  /**
   * Завершение задачи и начисление XP
   */
  async completeTask(userId, taskId) {
    try {
      // Получаем задачу
      const task = await Tasks.getById(taskId);
      if (!task || task.status === 'completed') {
        throw new Error('Task not found or already completed');
      }

      // Получаем множитель XP от активных бустеров
      const { default: shopService } = await import('./shop.js');
      const xpMultiplier = await shopService.getUserXPMultiplier(userId);
      
      // Применяем множитель к награде
      const baseXP = task.xp_reward;
      const bonusXP = Math.floor(baseXP * (xpMultiplier - 1));
      const totalXP = baseXP + bonusXP;

      // Обновляем статус задачи
      await Tasks.updateStatus(taskId, 'completed');

      // Начисляем XP (с учётом множителя)
      const userBefore = await Users.getStats(userId);
      await Users.updateXP(userId, totalXP);
      
      // Записываем в историю
      const historyDescription = bonusXP > 0 
        ? `Выполнена задача: ${task.title} (${baseXP} XP + ${bonusXP} бонус от бустера x${xpMultiplier})`
        : `Выполнена задача: ${task.title}`;
      await XPHistory.add(userId, totalXP, historyDescription, taskId);
      
      const userAfter = await Users.getStats(userId);

      // Обновляем серию
      const streakInfo = await Users.updateStreak(userId);

      // Проверяем достижения
      const unlockedAchievements = await this.checkAllAchievements(userId, {
        ...userAfter,
        current_streak: streakInfo.current_streak,
        longest_streak: streakInfo.longest_streak
      });

      // Проверка повышения уровня
      const leveledUp = userAfter.level > userBefore.level;

      return {
        success: true,
        xpGained: totalXP,
        baseXP,
        bonusXP,
        multiplier: xpMultiplier,
        newXP: userAfter.total_xp,
        newLevel: userAfter.level,
        leveledUp,
        currentStreak: streakInfo.current_streak,
        longestStreak: streakInfo.longest_streak,
        unlockedAchievements,
        levelProgress: this.getLevelProgress(userAfter.total_xp, userAfter.level)
      };
    } catch (error) {
      console.error('Error completing task:', error);
      throw error;
    }
  }

  /**
   * Проверка всех возможных достижений
   */
  async checkAllAchievements(userId, userStats) {
    const unlockedAchievements = [];

    // Проверка достижений по количеству выполненных задач
    const taskAchievements = await Achievements.checkAndUnlock(
      userId, 
      'tasks_completed', 
      parseInt(userStats.completed_tasks)
    );
    unlockedAchievements.push(...taskAchievements);

    // Проверка достижений по серии
    const streakAchievements = await Achievements.checkAndUnlock(
      userId, 
      'streak', 
      userStats.current_streak
    );
    unlockedAchievements.push(...streakAchievements);

    // Проверка достижений по уровню
    const levelAchievements = await Achievements.checkAndUnlock(
      userId, 
      'level_reached', 
      userStats.level
    );
    unlockedAchievements.push(...levelAchievements);

    // Проверка достижений по созданным целям
    const goalAchievements = await Achievements.checkAndUnlock(
      userId, 
      'goals_created', 
      parseInt(userStats.total_goals)
    );
    unlockedAchievements.push(...goalAchievements);

    return unlockedAchievements;
  }

  /**
   * Получение полной статистики пользователя для отображения
   */
  async getUserGameStats(userId) {
    const stats = await Users.getStats(userId);
    const levelProgress = this.getLevelProgress(stats.total_xp, stats.level);
    const userAchievements = await Achievements.getUserAchievements(userId);
    const allAchievements = await Achievements.getAll();
    const recentXP = await XPHistory.getByUserId(userId, 10);

    return {
      user: {
        id: stats.id,
        telegram_id: stats.telegram_id,
        username: stats.username,
        first_name: stats.first_name,
        level: stats.level,
        total_xp: stats.total_xp,
        available_xp: stats.available_xp,
        current_streak: stats.current_streak,
        longest_streak: stats.longest_streak,
        photo_url: stats.photo_url
      },
      stats: {
        total_goals: parseInt(stats.total_goals),
        completed_tasks: parseInt(stats.completed_tasks),
        pending_tasks: parseInt(stats.pending_tasks),
        achievements_unlocked: parseInt(stats.achievements_unlocked)
      },
      levelProgress,
      achievements: {
        unlocked: userAchievements,
        all: allAchievements,
        unlockedCount: userAchievements.length,
        totalCount: allAchievements.length
      },
      recentXP
    };
  }

  /**
   * Получение рейтинга пользователей (топ-10)
   */
  async getLeaderboard(limit = 10) {
    const result = await pool.query(
      `SELECT 
        id, telegram_id, username, first_name, 
        total_xp, level, current_streak
       FROM users
       ORDER BY total_xp DESC, level DESC
       LIMIT $1`,
      [limit]
    );
    return result.rows;
  }

  /**
   * Бонус за ежедневную активность
   */
  async dailyBonus(userId) {
    const user = await Users.getStats(userId);
    const lastActivity = new Date(user.last_activity);
    const now = new Date();
    const hoursSinceLastActivity = (now - lastActivity) / (1000 * 60 * 60);

    // Бонус можно получить раз в 24 часа
    if (hoursSinceLastActivity < 24) {
      const secondsUntilNext = Math.ceil((24 * 60 * 60) - ((now - lastActivity) / 1000));
      return {
        success: false,
        message: 'Бонус уже получен сегодня',
        secondsUntilNext: secondsUntilNext
      };
    }

    // Базовый бонус + бонус за серию
    const baseBonus = 10;
    const streakBonus = Math.min(user.current_streak * 2, 50);
    const totalBonus = baseBonus + streakBonus;

    await Users.updateXP(userId, totalBonus);
    await XPHistory.add(userId, totalBonus, `Ежедневный бонус (серия: ${user.current_streak} дней)`);
    const streakInfo = await Users.updateStreak(userId);

    return {
      success: true,
      xpGained: totalBonus,
      baseBonus,
      streakBonus,
      currentStreak: streakInfo.current_streak,
      longestStreak: streakInfo.longest_streak
    };
  }

  /**
   * Получить таблицу лидеров
   */
  async getLeaderboard(limit = 50, currentUserId = null) {
    const result = await pool.query(
      `SELECT 
        u.id,
        u.telegram_id,
        u.username,
        u.first_name,
        u.last_name,
        u.photo_url,
        u.total_xp,
        u.level,
        u.current_streak,
        u.longest_streak,
        ROW_NUMBER() OVER (ORDER BY u.total_xp DESC) as rank
       FROM users u
       ORDER BY u.total_xp DESC
       LIMIT $1`,
      [limit]
    );

    const leaderboard = result.rows;

    // Если указан текущий пользователь, найдём его позицию
    let currentUserRank = null;
    if (currentUserId) {
      const userRankResult = await pool.query(
        `SELECT 
          rank 
         FROM (
           SELECT 
             id,
             ROW_NUMBER() OVER (ORDER BY total_xp DESC) as rank
           FROM users
         ) ranked
         WHERE id = $1`,
        [currentUserId]
      );
      
      if (userRankResult.rows.length > 0) {
        currentUserRank = parseInt(userRankResult.rows[0].rank);
      }
    }

    return {
      leaderboard,
      currentUserRank,
      totalUsers: leaderboard.length
    };
  }
}

export default new GamificationService();

