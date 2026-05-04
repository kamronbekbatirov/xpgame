import pool from './database.js';

/**
 * Database models for XP Game
 */

// ============= USERS =============
export const Users = {
  async findByTelegramId(telegramId) {
    const result = await pool.query(
      'SELECT * FROM users WHERE telegram_id = $1',
      [telegramId]
    );
    return result.rows[0];
  },

  async create(telegramId, username, firstName, lastName) {
    const result = await pool.query(
      `INSERT INTO users (telegram_id, username, first_name, last_name) 
       VALUES ($1, $2, $3, $4) 
       RETURNING *`,
      [telegramId, username, firstName, lastName]
    );
    return result.rows[0];
  },

  async findOrCreate(telegramId, username, firstName, lastName) {
    let user = await this.findByTelegramId(telegramId);
    if (!user) {
      user = await this.create(telegramId, username, firstName, lastName);
    }
    return user;
  },

  async updateXP(userId, xpAmount) {
    const result = await pool.query(
      `UPDATE users 
       SET total_xp = total_xp + $2,
           available_xp = available_xp + $2,
           level = FLOOR(POWER((total_xp + $2) / 100.0, 0.5)) + 1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [userId, xpAmount]
    );
    return result.rows[0];
  },

  async spendXP(userId, xpAmount) {
    const result = await pool.query(
      `UPDATE users 
       SET available_xp = available_xp - $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND available_xp >= $2
       RETURNING *`,
      [userId, xpAmount]
    );
    if (result.rows.length === 0) {
      throw new Error('Недостаточно доступного XP');
    }
    return result.rows[0];
  },

  async updateStreak(userId) {
    const user = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    const lastActivity = user.rows[0].last_activity;
    const now = new Date();
    
    // Получаем дату последней активности (только дата, без времени)
    const lastActivityDate = new Date(lastActivity);
    lastActivityDate.setHours(0, 0, 0, 0);
    
    const todayDate = new Date(now);
    todayDate.setHours(0, 0, 0, 0);
    
    const diffDays = Math.floor((todayDate - lastActivityDate) / (1000 * 60 * 60 * 24));

    let newStreak = user.rows[0].current_streak;
    
    if (diffDays === 0) {
      // Активность в тот же день - серия не меняется
      newStreak = user.rows[0].current_streak || 1;
    } else if (diffDays === 1) {
      // Активность на следующий день - продолжаем серию
      newStreak = (user.rows[0].current_streak || 0) + 1;
    } else if (diffDays > 1) {
      // Пропущены дни - серия сбрасывается
      newStreak = 1;
    }

    const longestStreak = Math.max(newStreak, user.rows[0].longest_streak);

    await pool.query(
      `UPDATE users 
       SET current_streak = $2, 
           longest_streak = $3,
           last_activity = CURRENT_TIMESTAMP 
       WHERE id = $1`,
      [userId, newStreak, longestStreak]
    );

    return { current_streak: newStreak, longest_streak: longestStreak };
  },

  async getStats(userId) {
    const result = await pool.query(
      `SELECT 
        u.*,
        COUNT(DISTINCT g.id) as total_goals,
        COUNT(DISTINCT CASE WHEN t.status = 'completed' THEN t.id END) as completed_tasks,
        COUNT(DISTINCT CASE WHEN t.status = 'pending' THEN t.id END) as pending_tasks,
        COUNT(DISTINCT ua.achievement_id) as achievements_unlocked
       FROM users u
       LEFT JOIN goals g ON u.id = g.user_id
       LEFT JOIN tasks t ON u.id = t.user_id
       LEFT JOIN user_achievements ua ON u.id = ua.user_id
       WHERE u.id = $1
       GROUP BY u.id`,
      [userId]
    );
    return result.rows[0];
  }
};

// ============= GOALS =============
export const Goals = {
  async create(userId, title, description, category, priority) {
    const result = await pool.query(
      `INSERT INTO goals (user_id, title, description, category, priority) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING *`,
      [userId, title, description, category, priority]
    );
    return result.rows[0];
  },

  async getByUserId(userId) {
    const result = await pool.query(
      `SELECT g.*, COUNT(t.id) as task_count
       FROM goals g
       LEFT JOIN tasks t ON g.id = t.goal_id
       WHERE g.user_id = $1
       GROUP BY g.id
       ORDER BY g.priority DESC, g.created_at DESC`,
      [userId]
    );
    return result.rows;
  },

  async getActive(userId) {
    const result = await pool.query(
      `SELECT * FROM goals 
       WHERE user_id = $1 AND status = 'active'
       ORDER BY priority DESC`,
      [userId]
    );
    return result.rows;
  },

  async update(goalId, updates) {
    const fields = Object.keys(updates)
      .map((key, idx) => `${key} = $${idx + 2}`)
      .join(', ');
    
    const values = [goalId, ...Object.values(updates)];
    
    const result = await pool.query(
      `UPDATE goals SET ${fields}, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1 RETURNING *`,
      values
    );
    return result.rows[0];
  },

  async delete(goalId) {
    await pool.query('DELETE FROM goals WHERE id = $1', [goalId]);
  }
};

// ============= WEAKNESSES =============
export const Weaknesses = {
  async create(userId, title, description, severity) {
    const result = await pool.query(
      `INSERT INTO weaknesses (user_id, title, description, severity) 
       VALUES ($1, $2, $3, $4) 
       RETURNING *`,
      [userId, title, description, severity]
    );
    return result.rows[0];
  },

  async getByUserId(userId) {
    const result = await pool.query(
      'SELECT * FROM weaknesses WHERE user_id = $1 ORDER BY severity DESC',
      [userId]
    );
    return result.rows;
  },

  async update(weaknessId, updates) {
    const { title, description, severity } = updates;
    const result = await pool.query(
      `UPDATE weaknesses 
       SET title = COALESCE($2, title),
           description = COALESCE($3, description),
           severity = COALESCE($4, severity)
       WHERE id = $1 
       RETURNING *`,
      [weaknessId, title, description, severity]
    );
    return result.rows[0];
  },

  async delete(weaknessId) {
    await pool.query('DELETE FROM weaknesses WHERE id = $1', [weaknessId]);
  }
};

// ============= TASKS =============
export const Tasks = {
  async create(userId, goalId, title, description, xpReward, difficulty, dueDate = null) {
    const result = await pool.query(
      `INSERT INTO tasks (user_id, goal_id, title, description, xp_reward, difficulty, due_date) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING *`,
      [userId, goalId, title, description, xpReward, difficulty, dueDate]
    );
    return result.rows[0];
  },

  async getByUserId(userId, status = null) {
    let query = `
      SELECT t.*, g.title as goal_title, g.category
      FROM tasks t
      LEFT JOIN goals g ON t.goal_id = g.id
      WHERE t.user_id = $1
    `;
    const params = [userId];

    if (status) {
      query += ' AND t.status = $2';
      params.push(status);
    }

    query += ' ORDER BY t.created_at DESC';

    const result = await pool.query(query, params);
    return result.rows;
  },

  async getById(taskId) {
    const result = await pool.query('SELECT * FROM tasks WHERE id = $1', [taskId]);
    return result.rows[0];
  },

  async updateStatus(taskId, status) {
    const updates = { status };
    if (status === 'completed') {
      updates.completed_at = new Date();
    }

    const fields = Object.keys(updates)
      .map((key, idx) => `${key} = $${idx + 2}`)
      .join(', ');
    
    const values = [taskId, ...Object.values(updates)];

    const result = await pool.query(
      `UPDATE tasks SET ${fields}, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1 RETURNING *`,
      values
    );
    return result.rows[0];
  },

  async delete(taskId) {
    await pool.query('DELETE FROM tasks WHERE id = $1', [taskId]);
  },

  async getCompletedByUserId(userId, limit = 10) {
    const result = await pool.query(
      `SELECT * FROM tasks 
       WHERE user_id = $1 AND status = 'completed'
       ORDER BY completed_at DESC
       LIMIT $2`,
      [userId, limit]
    );
    return result.rows;
  }
};

// ============= ACHIEVEMENTS =============
export const Achievements = {
  async getAll() {
    const result = await pool.query('SELECT * FROM achievements ORDER BY xp_value ASC');
    return result.rows;
  },

  async getUserAchievements(userId) {
    const result = await pool.query(
      `SELECT a.*, ua.unlocked_at
       FROM achievements a
       INNER JOIN user_achievements ua ON a.id = ua.achievement_id
       WHERE ua.user_id = $1
       ORDER BY ua.unlocked_at DESC`,
      [userId]
    );
    return result.rows;
  },

  async unlock(userId, achievementId) {
    try {
      const result = await pool.query(
        `INSERT INTO user_achievements (user_id, achievement_id) 
         VALUES ($1, $2) 
         ON CONFLICT (user_id, achievement_id) DO NOTHING
         RETURNING *`,
        [userId, achievementId]
      );
      return result.rows[0];
    } catch (error) {
      return null; // Already unlocked
    }
  },

  async checkAndUnlock(userId, conditionType, currentValue) {
    const achievements = await pool.query(
      `SELECT a.* FROM achievements a
       LEFT JOIN user_achievements ua ON a.id = ua.achievement_id AND ua.user_id = $1
       WHERE a.condition_type = $2 
         AND a.condition_value <= $3
         AND ua.id IS NULL`,
      [userId, conditionType, currentValue]
    );

    const unlockedAchievements = [];
    for (const achievement of achievements.rows) {
      const unlocked = await this.unlock(userId, achievement.id);
      if (unlocked) {
        // Add XP reward
        await Users.updateXP(userId, achievement.xp_value);
        unlockedAchievements.push(achievement);
      }
    }

    return unlockedAchievements;
  }
};

// ============= XP HISTORY =============
export const XPHistory = {
  async add(userId, amount, reason, taskId = null) {
    const result = await pool.query(
      `INSERT INTO xp_history (user_id, amount, reason, task_id) 
       VALUES ($1, $2, $3, $4) 
       RETURNING *`,
      [userId, amount, reason, taskId]
    );
    return result.rows[0];
  },

  async getByUserId(userId, limit = 50) {
    const result = await pool.query(
      `SELECT xh.*, t.title as task_title
       FROM xp_history xh
       LEFT JOIN tasks t ON xh.task_id = t.id
       WHERE xh.user_id = $1
       ORDER BY xh.created_at DESC
       LIMIT $2`,
      [userId, limit]
    );
    return result.rows;
  }
};

