-- Таблица товаров магазина
CREATE TABLE IF NOT EXISTS shop_items (
  id SERIAL PRIMARY KEY,
  type VARCHAR(50) NOT NULL, -- 'booster' или 'reward'
  name VARCHAR(255) NOT NULL,
  description TEXT,
  xp_cost INTEGER NOT NULL,
  icon VARCHAR(10),
  effect_type VARCHAR(50), -- 'xp_multiplier', 'custom_reward'
  effect_value TEXT, -- JSON с параметрами эффекта
  duration_hours INTEGER, -- для бустеров
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица покупок пользователей
CREATE TABLE IF NOT EXISTS user_purchases (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  item_id INTEGER REFERENCES shop_items(id) ON DELETE CASCADE,
  xp_spent INTEGER NOT NULL,
  purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP, -- для бустеров
  is_used BOOLEAN DEFAULT false,
  used_at TIMESTAMP
);

-- Таблица активных бустеров пользователя
CREATE TABLE IF NOT EXISTS user_active_boosters (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  purchase_id INTEGER REFERENCES user_purchases(id) ON DELETE CASCADE,
  booster_type VARCHAR(50) NOT NULL,
  multiplier DECIMAL(3,2) DEFAULT 1.0,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, booster_type)
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_shop_items_type ON shop_items(type);
CREATE INDEX IF NOT EXISTS idx_shop_items_active ON shop_items(is_active);
CREATE INDEX IF NOT EXISTS idx_user_purchases_user ON user_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_user_active_boosters_user ON user_active_boosters(user_id);
CREATE INDEX IF NOT EXISTS idx_user_active_boosters_expires ON user_active_boosters(expires_at);

-- Вставка базовых бустеров
INSERT INTO shop_items (type, name, description, xp_cost, icon, effect_type, effect_value, duration_hours) VALUES
('booster', 'Удвоение XP (1 час)', 'Получай в 2 раза больше XP за задачи в течение 1 часа', 50, '⚡', 'xp_multiplier', '{"multiplier": 2.0}', 1),
('booster', 'Удвоение XP (24 часа)', 'Получай в 2 раза больше XP за задачи в течение дня', 300, '🔥', 'xp_multiplier', '{"multiplier": 2.0}', 24),
('booster', 'Тройное XP (1 час)', 'Получай в 3 раза больше XP за задачи в течение 1 часа', 150, '💫', 'xp_multiplier', '{"multiplier": 3.0}', 1)
ON CONFLICT DO NOTHING;

-- Функция для очистки истекших бустеров
CREATE OR REPLACE FUNCTION cleanup_expired_boosters()
RETURNS void AS $$
BEGIN
  DELETE FROM user_active_boosters WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;



