import { GameStats } from '../api';

interface AchievementsProps {
  achievements: GameStats['achievements'];
}

function Achievements({ achievements }: AchievementsProps) {
  const { unlocked, all, unlockedCount, totalCount } = achievements;
  
  const unlockedIds = new Set(unlocked.map(a => a.id));
  
  const progress = totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0;

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1 className="page-title">🏆 Достижения</h1>
        <p className="page-subtitle">Твои награды за прогресс</p>
      </div>

      {/* Progress Card */}
      <div className="card" style={{ background: 'var(--text-primary)', color: 'var(--bg-color)', border: '2px solid var(--text-primary)' }}>
        <h3 style={{ marginBottom: '1rem', color: 'var(--bg-color)' }}>Прогресс</h3>
        <div style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--bg-color)' }}>
          {unlockedCount} / {totalCount}
        </div>
        <div className="progress-bar" style={{ marginBottom: '0.5rem', background: 'var(--bg-color)' }}>
          <div 
            className="progress-bar-fill" 
            style={{ 
              width: `${progress}%`,
              background: 'var(--bg-color)'
            }}
          />
        </div>
        <div style={{ fontSize: '0.875rem', opacity: 0.9 }}>
          {progress}% достижений разблокировано
        </div>
      </div>

      {/* Unlocked Achievements */}
      {unlocked.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3 style={{ color: 'var(--text-primary)' }}>✨ Разблокированные ({unlockedCount})</h3>
          </div>
          {unlocked.map((achievement, index) => (
            <div 
              key={achievement.id} 
              className="achievement-item slide-up"
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              <div className="achievement-icon">{achievement.icon}</div>
              <div className="achievement-info">
                <div className="achievement-name">{achievement.name}</div>
                {achievement.description && (
                  <div className="achievement-description">{achievement.description}</div>
                )}
                <div className="achievement-xp">+{achievement.xp_value} XP</div>
                {achievement.unlocked_at && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                    Получено: {new Date(achievement.unlocked_at).toLocaleDateString('ru-RU')}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Locked Achievements */}
      {all.filter(a => !unlockedIds.has(a.id)).length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3 style={{ color: 'var(--text-primary)' }}>🔒 Заблокированные ({totalCount - unlockedCount})</h3>
          </div>
          {all
            .filter(a => !unlockedIds.has(a.id))
            .map((achievement, index) => (
              <div 
                key={achievement.id} 
                className="achievement-item locked slide-up"
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <div className="achievement-icon" style={{ filter: 'grayscale(1)' }}>
                  {achievement.icon}
                </div>
                <div className="achievement-info">
                  <div className="achievement-name">{achievement.name}</div>
                  {achievement.description && (
                    <div className="achievement-description">{achievement.description}</div>
                  )}
                  <div className="achievement-xp">+{achievement.xp_value} XP</div>
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Empty State */}
      {totalCount === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">🏆</div>
          <h3>Нет доступных достижений</h3>
          <p>Начни выполнять задачи, чтобы получать награды!</p>
        </div>
      )}

      {/* Tips Card */}
      <div className="card" style={{ background: 'var(--card-bg)', border: '2px solid var(--border-color)' }}>
        <h4 style={{ marginBottom: '0.75rem', color: 'var(--text-primary)' }}>💡 Как получить достижения</h4>
        <ul style={{ 
          margin: 0, 
          paddingLeft: '1.25rem', 
          color: 'var(--text-primary)',
          fontSize: '0.875rem',
          lineHeight: 1.6
        }}>
          <li>Выполняй задачи каждый день для получения серий</li>
          <li>Достигай новых уровней через накопление XP</li>
          <li>Создавай цели и работай над их достижением</li>
          <li>Будь активным и последовательным</li>
        </ul>
      </div>
    </div>
  );
}

export default Achievements;

