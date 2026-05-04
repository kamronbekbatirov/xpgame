import { useState } from 'react';
import { GameStats, aiApi } from '../api';

interface ProfileProps {
  user: GameStats;
  onRefresh: () => void;
}

function Profile({ user, onRefresh }: ProfileProps) {
  const [loadingUpdate, setLoadingUpdate] = useState(false);
  const { user: userData, stats, levelProgress } = user;

  const handleUpdatePlan = async () => {
    if (!confirm('Создать новые задачи на основе твоего прогресса?')) return;

    try {
      setLoadingUpdate(true);
      const response = await aiApi.updatePlan(userData.id);
      
      if (response.data.success) {
        alert(
          `🎯 Задачи созданы!\n\n${response.data.motivation_message}\n\nДобавлено ${response.data.tasks.length} новых задач`
        );
        onRefresh();
      }
    } catch (error: any) {
      console.error('Error updating plan:', error);
      alert('Ошибка создания задач: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoadingUpdate(false);
    }
  };

  const xpToNextLevel = levelProgress.needed - levelProgress.current;

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1 className="page-title">👤 Профиль</h1>
        <p className="page-subtitle">Твоя статистика и настройки</p>
      </div>

      {/* User Info Card */}
      <div className="card" style={{ 
        background: 'var(--text-primary)', 
        color: 'var(--bg-color)',
        textAlign: 'center',
        border: '2px solid var(--text-primary)'
      }}>
        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>
          {userData.photo_url ? (
            <img 
              src={userData.photo_url} 
              alt="Avatar" 
              style={{ 
                width: '100px', 
                height: '100px', 
                borderRadius: '50%',
                objectFit: 'cover',
                border: '3px solid var(--bg-color)'
              }} 
            />
          ) : (
            '👤'
          )}
        </div>
        <h2 style={{ marginBottom: '0.5rem' }}>{userData.first_name}</h2>
        {userData.username && (
          <div style={{ opacity: 0.9, marginBottom: '1rem' }}>@{userData.username}</div>
        )}
        <div className="level-badge" style={{ display: 'inline-block', marginBottom: '1rem' }}>
          Уровень {userData.level}
        </div>
        <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>
          {userData.total_xp} XP
        </div>
        <div style={{ fontSize: '0.875rem', opacity: 0.9, marginTop: '0.5rem' }}>
          До следующего уровня: {xpToNextLevel} XP
        </div>
      </div>

      {/* Stats Grid */}
      <div className="card">
        <h3 style={{ marginBottom: '1rem' }}>📊 Статистика</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
          <div style={{ textAlign: 'center', padding: '1rem', background: 'var(--card-bg)', borderRadius: '0.5rem', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--primary-color)' }}>
              {stats.total_goals}
            </div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Целей</div>
          </div>
          <div style={{ textAlign: 'center', padding: '1rem', background: 'var(--card-bg)', borderRadius: '0.5rem', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--success-color)' }}>
              {stats.completed_tasks}
            </div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Выполнено задач</div>
          </div>
          <div style={{ textAlign: 'center', padding: '1rem', background: 'var(--card-bg)', borderRadius: '0.5rem', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--warning-color)' }}>
              {stats.pending_tasks}
            </div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Активных задач</div>
          </div>
          <div style={{ textAlign: 'center', padding: '1rem', background: 'var(--card-bg)', borderRadius: '0.5rem', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--secondary-color)' }}>
              {stats.achievements_unlocked}
            </div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Достижений</div>
          </div>
        </div>
      </div>

      {/* Streaks */}
      <div className="card">
        <h3 style={{ marginBottom: '1rem' }}>🔥 Серии</h3>
        <div style={{ display: 'flex', justifyContent: 'space-around' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', fontWeight: 700 }}>
              {userData.current_streak}🔥
            </div>
            <div style={{ color: 'var(--text-secondary)' }}>Текущая серия</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--primary-color)' }}>
              {userData.longest_streak}🏆
            </div>
            <div style={{ color: 'var(--text-secondary)' }}>Лучшая серия</div>
          </div>
        </div>
        <div style={{ 
          marginTop: '1rem', 
          padding: '0.75rem', 
          background: 'var(--card-bg)', 
          borderRadius: '0.5rem',
          color: 'var(--text-primary)',
          border: '2px solid var(--border-color)',
          fontSize: '0.875rem',
          textAlign: 'center'
        }}>
          Выполняй задачи каждый день, чтобы поддерживать серию и получать бонусы!
        </div>
      </div>

      {/* Actions */}
      <div className="card">
        <h3 style={{ marginBottom: '1rem' }}>⚙️ Действия</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <button
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'flex-start' }}
            onClick={handleUpdatePlan}
            disabled={loadingUpdate}
          >
            <span>🤖</span>
            <span>{loadingUpdate ? 'Генерация...' : 'Создать новые задачи с AI'}</span>
          </button>
          <button
            className="btn btn-outline"
            style={{ width: '100%', justifyContent: 'flex-start' }}
            onClick={onRefresh}
          >
            <span>🔄</span>
            <span>Обновить данные</span>
          </button>
        </div>
      </div>

      {/* Level Progress Details */}
      <div className="card">
        <h3 style={{ marginBottom: '1rem' }}>📈 Прогресс уровня</h3>
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Текущий уровень</span>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Уровень {userData.level}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Прогресс</span>
            <span style={{ fontWeight: 600 }}>
              {levelProgress.current} / {levelProgress.needed} XP ({levelProgress.percentage}%)
            </span>
          </div>
          <div className="progress-bar">
            <div 
              className="progress-bar-fill" 
              style={{ width: `${levelProgress.percentage}%` }}
            />
          </div>
        </div>
        <div style={{ 
          padding: '0.75rem', 
          background: 'var(--card-bg)', 
          borderRadius: '0.5rem',
          color: 'var(--text-primary)',
          border: '1px solid var(--border-color)',
          fontSize: '0.875rem'
        }}>
          💡 Выполняй задачи, чтобы получать XP и повышать уровень!
        </div>
      </div>

      {/* About */}
      <div className="card" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>
        <h4 style={{ marginBottom: '0.75rem' }}>О XP Game</h4>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          XP Game - это твой личный коуч по развитию, использующий искусственный интеллект 
          для создания персонализированных планов роста. Ставь цели, выполняй задачи, 
          получай опыт и достижения на пути к успеху!
        </p>
        <div style={{ marginTop: '1rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
          Версия: 1.0.0 | Powered by OpenAI
        </div>
      </div>
    </div>
  );
}

export default Profile;

