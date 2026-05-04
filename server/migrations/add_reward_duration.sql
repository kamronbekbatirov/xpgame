-- Добавляем поле duration_minutes в shop_items (сколько минут длится награда)
ALTER TABLE shop_items 
ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT NULL;

COMMENT ON COLUMN shop_items.duration_minutes IS 'Длительность награды в минутах (например, 180 = 3 часа). NULL если награда без таймера';

-- Добавляем поля для отслеживания активации наград с таймером
ALTER TABLE user_purchases 
ADD COLUMN IF NOT EXISTS activated_at TIMESTAMP DEFAULT NULL,
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP DEFAULT NULL,
ADD COLUMN IF NOT EXISTS notification_sent BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN user_purchases.activated_at IS 'Время активации награды';
COMMENT ON COLUMN user_purchases.expires_at IS 'Время окончания действия награды';
COMMENT ON COLUMN user_purchases.notification_sent IS 'Отправлено ли уведомление об окончании';

-- Индекс для быстрого поиска истёкших таймеров
CREATE INDEX IF NOT EXISTS idx_user_purchases_expires_at 
ON user_purchases(expires_at) 
WHERE expires_at IS NOT NULL AND notification_sent = FALSE;

