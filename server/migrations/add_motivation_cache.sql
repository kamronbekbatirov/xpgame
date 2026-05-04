-- Таблица для кэширования мотивации дня
CREATE TABLE IF NOT EXISTS user_daily_motivation (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours'),
    UNIQUE(user_id)
);

-- Индекс для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_user_daily_motivation_user_id ON user_daily_motivation(user_id);
CREATE INDEX IF NOT EXISTS idx_user_daily_motivation_expires ON user_daily_motivation(expires_at);

-- Функция автоматической очистки устаревших записей
CREATE OR REPLACE FUNCTION cleanup_expired_motivations()
RETURNS void AS $$
BEGIN
    DELETE FROM user_daily_motivation WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE user_daily_motivation IS 'Кэш мотивационных сообщений на сутки';


