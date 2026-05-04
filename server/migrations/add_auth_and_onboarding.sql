-- Добавить поля для авторизации и onboarding

-- Добавить поле is_authorized (прошел ли пароль)
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_authorized BOOLEAN DEFAULT FALSE;

-- Добавить поле onboarding_completed (прошел ли onboarding)
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;

-- Добавить поле onboarding_step (текущий шаг onboarding: null, 'goals', 'weaknesses', 'generating')
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_step VARCHAR(50);

-- Добавить поле photo_url для аватарки из Telegram
ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Создать индекс для быстрого поиска неавторизованных пользователей
CREATE INDEX IF NOT EXISTS idx_users_is_authorized ON users(is_authorized);
CREATE INDEX IF NOT EXISTS idx_users_onboarding_completed ON users(onboarding_completed);

COMMENT ON COLUMN users.is_authorized IS 'Ввел ли пользователь пароль при первом входе';
COMMENT ON COLUMN users.onboarding_completed IS 'Прошел ли пользователь onboarding (цели + слабости + генерация плана)';
COMMENT ON COLUMN users.onboarding_step IS 'Текущий шаг onboarding процесса';
COMMENT ON COLUMN users.photo_url IS 'URL аватарки пользователя из Telegram';



