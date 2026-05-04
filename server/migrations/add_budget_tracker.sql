-- Таблица доходов
CREATE TABLE IF NOT EXISTS budget_incomes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    category VARCHAR(100),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    is_recurring BOOLEAN DEFAULT FALSE,
    recurring_period VARCHAR(50), -- 'weekly', 'monthly', 'yearly'
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица расходов
CREATE TABLE IF NOT EXISTS budget_expenses (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    category VARCHAR(100),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    is_recurring BOOLEAN DEFAULT FALSE,
    recurring_period VARCHAR(50), -- 'weekly', 'monthly', 'yearly'
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица подписок
CREATE TABLE IF NOT EXISTS budget_subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    service_name VARCHAR(255) NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    billing_period VARCHAR(50) NOT NULL, -- 'monthly', 'yearly', 'quarterly'
    next_billing_date DATE NOT NULL,
    category VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Индексы для оптимизации
CREATE INDEX IF NOT EXISTS idx_budget_incomes_user_id ON budget_incomes(user_id);
CREATE INDEX IF NOT EXISTS idx_budget_incomes_date ON budget_incomes(date);
CREATE INDEX IF NOT EXISTS idx_budget_expenses_user_id ON budget_expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_budget_expenses_date ON budget_expenses(date);
CREATE INDEX IF NOT EXISTS idx_budget_subscriptions_user_id ON budget_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_budget_subscriptions_active ON budget_subscriptions(is_active);

COMMENT ON TABLE budget_incomes IS 'Доходы пользователей';
COMMENT ON TABLE budget_expenses IS 'Расходы пользователей';
COMMENT ON TABLE budget_subscriptions IS 'Подписки и регулярные платежи';


