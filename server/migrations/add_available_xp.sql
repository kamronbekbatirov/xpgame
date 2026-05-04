-- Добавляем поле available_xp для отслеживания доступного XP
-- total_xp будет только расти, available_xp может уменьшаться при покупках

ALTER TABLE users ADD COLUMN IF NOT EXISTS available_xp INTEGER DEFAULT 0;

-- Инициализируем available_xp текущим значением total_xp для существующих пользователей
UPDATE users SET available_xp = total_xp WHERE available_xp = 0;

-- Создаем индекс для быстрого поиска по available_xp
CREATE INDEX IF NOT EXISTS idx_users_available_xp ON users(available_xp);

-- Комментарий
COMMENT ON COLUMN users.available_xp IS 'Доступный XP для покупок (может уменьшаться)';
COMMENT ON COLUMN users.total_xp IS 'Общий заработанный XP за все время (только растет)';


