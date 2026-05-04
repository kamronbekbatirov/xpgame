import { useState, useEffect } from 'react';
import { leaderboardApi } from '../api';

interface LeaderboardProps {
  userId: number;
}

function Leaderboard({ userId }: LeaderboardProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLeaderboard();
  }, [userId]);

  const loadLeaderboard = async () => {
    setLoading(true);
    try {
      const response = await leaderboardApi.getLeaderboard(50, userId);
      setData(response.data);
    } catch (error) {
      console.error('Error loading leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <div style={{ fontSize: '2rem' }}>⏳ Загрузка...</div>
      </div>
    );
  }

  if (!data || data.leaderboard.length === 0) {
    return (
      <div className="fade-in">
        <div className="page-header">
          <h1 className="page-title">🏆 Таблица лидеров</h1>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
          Пока нет участников
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1 className="page-title">🏆 Таблица лидеров</h1>
        <p className="page-subtitle" style={{color: 'var(--text-secondary)'}}>
          Соревнуйся с друзьями!
        </p>
      </div>

      {/* Current user position */}
      {data.currentUserRank && (
        <div className="card" style={{
          marginBottom: '1.5rem',
          background: 'linear-gradient(135deg, var(--primary-color), var(--success-color))',
          color: 'white',
          textAlign: 'center',
          padding: '1.5rem'
        }}>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
            #{data.currentUserRank}
          </div>
          <div style={{ fontSize: '1rem', opacity: 0.9 }}>
            Твоя позиция в рейтинге
          </div>
        </div>
      )}

      {/* Leaderboard list */}
      <div style={{ display: 'grid', gap: '0.75rem' }}>
        {data.leaderboard.map((user: any) => {
          const isCurrentUser = user.id === userId;
          const rank = parseInt(user.rank);
          const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '';
          
          return (
            <div
              key={user.id}
              className="card"
              style={{
                padding: '1rem',
                border: isCurrentUser ? '3px solid var(--primary-color)' : '2px solid var(--border-color)',
                background: isCurrentUser 
                  ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(139, 92, 246, 0.15))' 
                  : 'var(--card-bg)',
                boxShadow: isCurrentUser ? '0 4px 12px rgba(99, 102, 241, 0.2)' : 'none',
                transition: 'all 0.2s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                {/* Rank */}
                <div style={{
                  minWidth: '50px',
                  textAlign: 'center',
                  fontSize: rank <= 3 ? '2rem' : '1.5rem',
                  fontWeight: 'bold',
                  color: rank <= 3 ? 'var(--warning-color)' : 'var(--text-secondary)'
                }}>
                  {medal || `#${rank}`}
                </div>

                {/* Avatar */}
                <div style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  background: user.photo_url ? 'transparent' : 'linear-gradient(135deg, var(--primary-color), var(--success-color))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.75rem',
                  overflow: 'hidden',
                  border: isCurrentUser ? '3px solid var(--primary-color)' : '3px solid var(--border-color)',
                  flexShrink: 0
                }}>
                  {user.photo_url ? (
                    <img src={user.photo_url} alt={user.first_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ color: 'white' }}>👤</span>
                  )}
                </div>

                {/* User info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ 
                    fontWeight: 700, 
                    color: 'var(--text-primary)', 
                    marginBottom: '0.25rem',
                    fontSize: '1.05rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    flexWrap: 'wrap'
                  }}>
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {user.first_name} {user.last_name}
                    </span>
                    {isCurrentUser && (
                      <span style={{ 
                        color: '#FFFFFF',
                        background: '#6366f1',
                        padding: '0.15rem 0.5rem',
                        borderRadius: '12px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        boxShadow: '0 2px 6px rgba(99, 102, 241, 0.5)',
                        border: '1px solid rgba(255, 255, 255, 0.3)'
                      }}>
                        Ты
                      </span>
                    )}
                  </div>
                  {user.username && (
                    <div style={{ 
                      fontSize: '0.875rem', 
                      color: 'var(--text-secondary)',
                      marginBottom: '0.5rem'
                    }}>
                      @{user.username}
                    </div>
                  )}
                  <div style={{ 
                    display: 'flex', 
                    gap: '1rem', 
                    fontSize: '0.875rem',
                    flexWrap: 'wrap'
                  }}>
                    <span style={{ 
                      color: 'var(--text-secondary)',
                      background: 'var(--secondary-bg-color)',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '6px'
                    }}>
                      🎯 Ур. {user.level}
                    </span>
                    {user.current_streak > 0 && (
                      <span style={{ 
                        color: 'var(--text-secondary)',
                        background: 'var(--secondary-bg-color)',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '6px'
                      }}>
                        🔥 {user.current_streak}д
                      </span>
                    )}
                  </div>
                </div>

                {/* XP */}
                <div style={{
                  textAlign: 'right',
                  minWidth: '80px',
                  flexShrink: 0
                }}>
                  <div style={{
                    fontSize: '1.5rem',
                    fontWeight: 'bold',
                    color: 'var(--success-color)',
                    lineHeight: 1.2
                  }}>
                    {user.total_xp.toLocaleString('ru-RU')}
                  </div>
                  <div style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-secondary)',
                    fontWeight: 500,
                    marginTop: '0.25rem'
                  }}>
                    XP
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Refresh button */}
      <button
        className="btn btn-outline"
        onClick={loadLeaderboard}
        style={{
          width: '100%',
          marginTop: '1.5rem',
          color: 'var(--text-primary)',
          borderColor: 'var(--border-color)'
        }}
      >
        🔄 Обновить
      </button>
    </div>
  );
}

export default Leaderboard;

