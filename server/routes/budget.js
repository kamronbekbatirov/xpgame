import express from 'express';
import pool from '../database.js';

const router = express.Router();

// Middleware будет применён в index.js при подключении routes

// ============= ДОХОДЫ (INCOMES) =============

// Получить все доходы пользователя
router.get('/incomes/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { startDate, endDate } = req.query;
    
    let query = 'SELECT * FROM budget_incomes WHERE user_id = $1';
    const params = [userId];
    
    if (startDate && endDate) {
      query += ' AND date BETWEEN $2 AND $3';
      params.push(startDate, endDate);
    }
    
    query += ' ORDER BY date DESC, created_at DESC';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching incomes:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Создать доход
router.post('/incomes', async (req, res) => {
  try {
    const { user_id, title, amount, category, date, is_recurring, recurring_period, notes } = req.body;
    
    const result = await pool.query(
      `INSERT INTO budget_incomes (user_id, title, amount, category, date, is_recurring, recurring_period, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [user_id, title, amount, category || null, date || new Date(), is_recurring || false, recurring_period || null, notes || null]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating income:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Обновить доход
router.put('/incomes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, amount, category, date, is_recurring, recurring_period, notes } = req.body;
    
    const result = await pool.query(
      `UPDATE budget_incomes
       SET title = $1, amount = $2, category = $3, date = $4, is_recurring = $5, recurring_period = $6, notes = $7
       WHERE id = $8
       RETURNING *`,
      [title, amount, category, date, is_recurring, recurring_period, notes, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Income not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating income:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Удалить доход
router.delete('/incomes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query('DELETE FROM budget_incomes WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Income not found' });
    }
    
    res.json({ message: 'Income deleted successfully' });
  } catch (error) {
    console.error('Error deleting income:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============= РАСХОДЫ (EXPENSES) =============

// Получить все расходы пользователя
router.get('/expenses/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { startDate, endDate } = req.query;
    
    let query = 'SELECT * FROM budget_expenses WHERE user_id = $1';
    const params = [userId];
    
    if (startDate && endDate) {
      query += ' AND date BETWEEN $2 AND $3';
      params.push(startDate, endDate);
    }
    
    query += ' ORDER BY date DESC, created_at DESC';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching expenses:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Создать расход
router.post('/expenses', async (req, res) => {
  try {
    const { user_id, title, amount, category, date, is_recurring, recurring_period, notes } = req.body;
    
    const result = await pool.query(
      `INSERT INTO budget_expenses (user_id, title, amount, category, date, is_recurring, recurring_period, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [user_id, title, amount, category || null, date || new Date(), is_recurring || false, recurring_period || null, notes || null]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating expense:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Обновить расход
router.put('/expenses/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, amount, category, date, is_recurring, recurring_period, notes } = req.body;
    
    const result = await pool.query(
      `UPDATE budget_expenses
       SET title = $1, amount = $2, category = $3, date = $4, is_recurring = $5, recurring_period = $6, notes = $7
       WHERE id = $8
       RETURNING *`,
      [title, amount, category, date, is_recurring, recurring_period, notes, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Expense not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating expense:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Удалить расход
router.delete('/expenses/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query('DELETE FROM budget_expenses WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Expense not found' });
    }
    
    res.json({ message: 'Expense deleted successfully' });
  } catch (error) {
    console.error('Error deleting expense:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============= ПОДПИСКИ (SUBSCRIPTIONS) =============

// Получить все подписки пользователя
router.get('/subscriptions/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { active } = req.query;
    
    let query = 'SELECT * FROM budget_subscriptions WHERE user_id = $1';
    const params = [userId];
    
    if (active !== undefined) {
      query += ' AND is_active = $2';
      params.push(active === 'true');
    }
    
    query += ' ORDER BY next_billing_date ASC, created_at DESC';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching subscriptions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Создать подписку
router.post('/subscriptions', async (req, res) => {
  try {
    const { user_id, service_name, amount, billing_period, next_billing_date, category, is_active, notes } = req.body;
    
    const result = await pool.query(
      `INSERT INTO budget_subscriptions (user_id, service_name, amount, billing_period, next_billing_date, category, is_active, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [user_id, service_name, amount, billing_period, next_billing_date, category || null, is_active !== false, notes || null]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating subscription:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Обновить подписку
router.put('/subscriptions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { service_name, amount, billing_period, next_billing_date, category, is_active, notes } = req.body;
    
    const result = await pool.query(
      `UPDATE budget_subscriptions
       SET service_name = $1, amount = $2, billing_period = $3, next_billing_date = $4, category = $5, is_active = $6, notes = $7
       WHERE id = $8
       RETURNING *`,
      [service_name, amount, billing_period, next_billing_date, category, is_active, notes, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Subscription not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating subscription:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Удалить подписку
router.delete('/subscriptions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query('DELETE FROM budget_subscriptions WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Subscription not found' });
    }
    
    res.json({ message: 'Subscription deleted successfully' });
  } catch (error) {
    console.error('Error deleting subscription:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============= СТАТИСТИКА =============

// Получить статистику бюджета
router.get('/stats/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { startDate, endDate } = req.query;
    
    const params = [userId];
    let dateFilter = '';
    
    if (startDate && endDate) {
      dateFilter = ' AND date BETWEEN $2 AND $3';
      params.push(startDate, endDate);
    }
    
    // Суммы доходов и расходов
    const incomeResult = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) as total FROM budget_incomes WHERE user_id = $1${dateFilter}`,
      params
    );
    
    const expenseResult = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) as total FROM budget_expenses WHERE user_id = $1${dateFilter}`,
      params
    );
    
    // Активные подписки
    const subscriptionsResult = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count 
       FROM budget_subscriptions 
       WHERE user_id = $1 AND is_active = true`,
      [userId]
    );
    
    // Группировка по категориям
    const incomeByCategoryResult = await pool.query(
      `SELECT category, SUM(amount) as total 
       FROM budget_incomes 
       WHERE user_id = $1${dateFilter}
       GROUP BY category
       ORDER BY total DESC`,
      params
    );
    
    const expenseByCategoryResult = await pool.query(
      `SELECT category, SUM(amount) as total 
       FROM budget_expenses 
       WHERE user_id = $1${dateFilter}
       GROUP BY category
       ORDER BY total DESC`,
      params
    );
    
    res.json({
      totalIncome: parseFloat(incomeResult.rows[0].total),
      totalExpense: parseFloat(expenseResult.rows[0].total),
      balance: parseFloat(incomeResult.rows[0].total) - parseFloat(expenseResult.rows[0].total),
      subscriptions: {
        total: parseFloat(subscriptionsResult.rows[0].total),
        count: parseInt(subscriptionsResult.rows[0].count)
      },
      incomeByCategory: incomeByCategoryResult.rows.map(r => ({
        category: r.category || 'Без категории',
        total: parseFloat(r.total)
      })),
      expenseByCategory: expenseByCategoryResult.rows.map(r => ({
        category: r.category || 'Без категории',
        total: parseFloat(r.total)
      }))
    });
  } catch (error) {
    console.error('Error fetching budget stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

