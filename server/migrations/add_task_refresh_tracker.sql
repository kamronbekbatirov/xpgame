-- Таблица для отслеживания последнего обновления задач
CREATE TABLE IF NOT EXISTS user_task_refresh (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    last_refresh_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    next_refresh_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours')
);

CREATE INDEX IF NOT EXISTS idx_user_task_refresh_next ON user_task_refresh(next_refresh_at);

