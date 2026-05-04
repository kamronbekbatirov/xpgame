-- Кэш персональных наград для быстрой загрузки магазина

CREATE TABLE IF NOT EXISTS user_personal_rewards (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    xp_cost INTEGER NOT NULL,
    icon VARCHAR(10),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '7 days') -- Кэш на 7 дней
);

CREATE INDEX IF NOT EXISTS idx_user_personal_rewards_user_id ON user_personal_rewards(user_id);
CREATE INDEX IF NOT EXISTS idx_user_personal_rewards_expires_at ON user_personal_rewards(expires_at);

-- Функция для очистки устаревших наград
CREATE OR REPLACE FUNCTION cleanup_expired_personal_rewards() RETURNS void AS $$
BEGIN
    DELETE FROM user_personal_rewards WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;


