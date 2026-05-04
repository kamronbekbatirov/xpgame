import { useState, useEffect } from 'react';
import { GameStats, gamificationApi, aiApi } from '../api';
import CountdownTimer from './CountdownTimer';

interface DashboardProps {
  user: GameStats;
  onRefresh: () => void;
  onNavigate?: (page: string) => void;
}

function Dashboard({ user, onRefresh, onNavigate }: DashboardProps) {
  const [motivationMessage, setMotivationMessage] = useState<string>('');
  const [loadingBonus, setLoadingBonus] = useState(false);
  const [bonusMessage, setBonusMessage] = useState<string>('');
  const [loadingMotivation, setLoadingMotivation] = useState(false);
  const [motivationSecondsLeft, setMotivationSecondsLeft] = useState<number | null>(null);
  const [bonusSecondsLeft, setBonusSecondsLeft] = useState<number | null>(null);

  const { user: userData, stats, levelProgress} = user;

  const handleDailyBonus = async () => {
    setLoadingBonus(true);
    setBonusMessage('');
    
    try {
      const response = await gamificationApi.getDailyBonus(userData.id);
      
      if (response.data.success) {
        setBonusMessage(
          `🎉 Получено ${response.data.xpGained} XP! 
          (Базовый: ${response.data.baseBonus}, Бонус за серию: ${response.data.streakBonus})`
        );
        setBonusSecondsLeft(null);
        setTimeout(() => {
          onRefresh();
        }, 1000);
      } else {
        setBonusMessage(response.data.message || 'Бонус уже получен');
        if (response.data.secondsUntilNext) {
          setBonusSecondsLeft(response.data.secondsUntilNext);
        }
      }
    } catch (error) {
      console.error('Error getting bonus:', error);
      setBonusMessage('Ошибка получения бонуса');
    } finally {
      setLoadingBonus(false);
    }
  };

  const getMotivation = async (force = false) => {
    setLoadingMotivation(true);
    try {
      const response = await aiApi.getMotivation(userData.id, force);
      setMotivationMessage(response.data.message);
      setMotivationSecondsLeft(response.data.secondsUntilExpiry || null);
      // Прокрутка к мотивации после загрузки
      setTimeout(() => {
        const motivationElement = document.getElementById('motivation-section');
        if (motivationElement) {
          motivationElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    } catch (error) {
      console.error('Error getting motivation:', error);
      alert('Ошибка получения мотивации от AI. Попробуйте ещё раз.');
    } finally {
      setLoadingMotivation(false);
    }
  };

  useEffect(() => {
    getMotivation();
  }, []);

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">👋 Привет, {userData.first_name}!</h1>
        <p className="page-subtitle">Продолжай двигаться к своим целям</p>
      </div>

      {/* Level Progress */}
      <div className="level-progress slide-up">
        <div className="level-header">
          <div>
            <div className="level-badge">
              Уровень {userData.level}
            </div>
          </div>
          <div className="xp-info">
            <div style={{ fontWeight: 600, fontSize: '1.125rem', color: 'var(--text-primary)' }}>
              {levelProgress.current} / {levelProgress.needed} XP
            </div>
            <div>{levelProgress.percentage}%</div>
          </div>
        </div>
        <div className="progress-bar">
          <div 
            className="progress-bar-fill" 
            style={{ width: `${levelProgress.percentage}%` }}
          />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{userData.total_xp} XP</div>
          <div className="stat-label">Всего заработано</div>
        </div>
        <div className="stat-card" style={{border: '2px solid var(--success-color)'}}>
          <div className="stat-value" style={{color: 'var(--success-color)'}}>{userData.available_xp} XP</div>
          <div className="stat-label">Доступно для покупок</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{userData.current_streak}🔥</div>
          <div className="stat-label">Серия дней</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.completed_tasks}</div>
          <div className="stat-label">Задач выполнено</div>
        </div>
      </div>

      {/* Daily Bonus */}
      <div className="card">
        <div className="card-header">
          <h3 style={{ color: 'var(--text-primary)' }}>🎁 Ежедневный бонус</h3>
        </div>
        <div style={{ 
          padding: '0.75rem', 
          background: 'var(--secondary-bg-color)', 
          borderRadius: '0.5rem',
          marginBottom: '1rem',
          border: '1px solid var(--border-color)'
        }}>
          <p style={{ color: 'var(--text-primary)', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.875rem' }}>
            ℹ️ Как работает бонус?
          </p>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem', fontSize: '0.875rem', lineHeight: 1.5 }}>
            • Получай <strong style={{color: 'var(--primary-color)'}}>10 XP базовый бонус</strong> каждые 24 часа<br/>
            • Бонус за серию: <strong style={{color: 'var(--success-color)'}}>+2 XP за каждый день</strong> непрерывной активности (макс. +50 XP)<br/>
            • Твоя текущая серия: <strong style={{color: 'var(--warning-color)'}}>{userData.current_streak} 🔥</strong> дней
            {bonusSecondsLeft && bonusSecondsLeft > 0 && (
              <>
                <br/>
                • ⏱️ Следующий бонус через: <strong style={{color: 'var(--primary-color)'}}>
                  <CountdownTimer seconds={bonusSecondsLeft} onExpire={() => setBonusSecondsLeft(null)} />
                </strong>
              </>
            )}
          </p>
        </div>
        <button
          className="btn btn-primary btn-large"
          style={{ width: '100%' }}
          onClick={handleDailyBonus}
          disabled={loadingBonus}
        >
          {loadingBonus ? 'Загрузка...' : 'Получить бонус'}
        </button>
        {bonusMessage && (
          <div 
            className="mt-2" 
            style={{ 
              padding: '0.75rem', 
              background: bonusMessage.includes('✨') || bonusMessage.includes('🎉') 
                ? 'linear-gradient(135deg, var(--success-color), #28a745)' 
                : 'var(--bg-color)', 
              borderRadius: '0.5rem',
              color: bonusMessage.includes('✨') || bonusMessage.includes('🎉')
                ? 'white'
                : 'var(--text-primary)',
              fontSize: '0.875rem',
              whiteSpace: 'pre-line',
              border: bonusMessage.includes('✨') || bonusMessage.includes('🎉')
                ? 'none'
                : '2px solid var(--border-color)',
              fontWeight: bonusMessage.includes('✨') || bonusMessage.includes('🎉')
                ? 600
                : 'normal'
            }}
          >
            {bonusMessage}
          </div>
        )}
      </div>

      {/* Motivation */}
      {motivationMessage && (
        <div 
          id="motivation-section"
          className="card" 
          style={{ 
            background: 'var(--text-primary)', 
            color: 'var(--bg-color)', 
            border: '2px solid var(--text-primary)',
            animation: 'fadeIn 0.5s ease-in-out'
          }}
        >
          <div className="card-header" style={{ borderColor: 'rgba(255, 255, 255, 0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ color: 'var(--bg-color)', margin: 0 }}>💪 Мотивация дня</h3>
              {motivationSecondsLeft && motivationSecondsLeft > 0 && (
                <small style={{ opacity: 0.7, fontSize: '0.75rem' }}>
                  ⏱️ Обновится через <CountdownTimer seconds={motivationSecondsLeft} onExpire={() => setMotivationSecondsLeft(null)} />
                </small>
              )}
            </div>
            <button
              className="btn btn-outline"
              style={{ 
                fontSize: '0.875rem', 
                padding: '0.5rem 1rem',
                background: 'rgba(255,255,255,0.2)',
                color: 'var(--bg-color)',
                border: '1px solid rgba(255,255,255,0.3)'
              }}
              onClick={(e) => { e.preventDefault(); getMotivation(true); }}
              disabled={loadingMotivation}
              title="Получить новую мотивацию"
            >
              {loadingMotivation ? '⏳' : '🔄'}
            </button>
          </div>
          <p style={{ lineHeight: 1.6, color: 'var(--bg-color)' }}>{motivationMessage}</p>
        </div>
      )}

      {/* Quick Actions */}
      <div className="card">
        <div className="card-header">
          <h3 style={{ color: 'var(--text-primary)' }}>🚀 Быстрые действия</h3>
        </div>
        <div className="flex flex-col gap-2">
          <button 
            className="btn btn-outline" 
            style={{ width: '100%', justifyContent: 'flex-start', color: 'var(--text-primary)' }}
            onClick={() => onNavigate?.('goals')}
          >
            <span>🎯</span>
            <span>Добавить новую цель</span>
          </button>
          <button 
            className="btn btn-outline" 
            style={{ width: '100%', justifyContent: 'flex-start', color: 'var(--text-primary)' }}
            onClick={() => onNavigate?.('tasks')}
          >
            <span>✅</span>
            <span>Посмотреть задачи</span>
          </button>
          <button 
            className="btn btn-outline" 
            style={{ width: '100%', justifyContent: 'flex-start', color: 'var(--text-primary)' }}
            onClick={() => getMotivation(false)}
            disabled={loadingMotivation}
          >
            <span>{loadingMotivation ? '⏳' : '💬'}</span>
            <span>{loadingMotivation ? 'Получение мотивации...' : 'Получить мотивацию от AI'}</span>
          </button>
        </div>
      </div>

      {/* Progress Summary */}
      <div className="card">
        <div className="card-header">
          <h3 style={{ color: 'var(--text-primary)' }}>📊 Твой прогресс</h3>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <div className="flex justify-between mb-1">
              <span style={{ color: 'var(--text-secondary)' }}>Цели</span>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                {stats.total_goals}
              </span>
            </div>
          </div>
          <div>
            <div className="flex justify-between mb-1">
              <span style={{ color: 'var(--text-secondary)' }}>Активные задачи</span>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                {stats.pending_tasks}
              </span>
            </div>
          </div>
          <div>
            <div className="flex justify-between mb-1">
              <span style={{ color: 'var(--text-secondary)' }}>Лучшая серия</span>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                {userData.longest_streak} дней 🔥
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;

