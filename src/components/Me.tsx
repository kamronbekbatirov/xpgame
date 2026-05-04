import { useState, useEffect } from 'react';
import { 
  GameStats, 
  goalsApi, 
  shopApi, 
  leaderboardApi,
  Goal
} from '../api';
import UnifiedChat from './UnifiedChat';

interface MeProps {
  user: GameStats;
  onRefresh: () => void;
}

type Tab = 'goals' | 'rewards' | 'stats';

function Me({ user, onRefresh }: MeProps) {
  const [activeTab, setActiveTab] = useState<Tab>('goals');
  const [goals, setGoals] = useState<Goal[]>([]);
  const [personalRewards, setPersonalRewards] = useState<any[]>([]);
  const [myPurchases, setMyPurchases] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [userRank, setUserRank] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [showChat, setShowChat] = useState(false);
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [newGoalTitle, setNewGoalTitle] = useState('');
  const [purchasing, setPurchasing] = useState<string | null>(null);

  const { user: userData, stats, achievements, levelProgress } = user;

  useEffect(() => {
    loadData();
  }, [userData.id, activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'goals') {
        const goalsRes = await goalsApi.getGoals(userData.id);
        setGoals(goalsRes.data);
      } else if (activeTab === 'rewards') {
        const [personalRes, purchasesRes] = await Promise.all([
          shopApi.getPersonalRewards(userData.id),
          shopApi.getPurchases(userData.id, 20)
        ]);
        setPersonalRewards(personalRes.data.rewards || []);
        setMyPurchases((purchasesRes.data.purchases || []).filter((p: any) => p.type === 'reward' && !p.is_used));
      } else if (activeTab === 'stats') {
        const leaderRes = await leaderboardApi.getLeaderboard(20, userData.id);
        setLeaderboard(leaderRes.data.leaderboard || []);
        setUserRank(leaderRes.data.currentUserRank);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddGoal = async () => {
    if (!newGoalTitle.trim()) return;
    try {
      await goalsApi.createGoal({
        user_id: userData.id,
        title: newGoalTitle.trim()
      });
      setNewGoalTitle('');
      setShowAddGoal(false);
      loadData();
      onRefresh();
    } catch (error) {
      console.error('Error adding goal:', error);
      alert('Ошибка добавления цели');
    }
  };

  const handleDeleteGoal = async (goalId: number) => {
    if (!confirm('Удалить эту цель?')) return;
    try {
      await goalsApi.deleteGoal(goalId);
      loadData();
    } catch (error) {
      console.error('Error deleting goal:', error);
    }
  };

  const handleBuyReward = async (reward: any) => {
    if (userData.available_xp < reward.xp_cost) {
      alert(`Нужно ${reward.xp_cost} XP, у тебя ${userData.available_xp}`);
      return;
    }
    if (!confirm(`Купить "${reward.name}" за ${reward.xp_cost} XP?`)) return;
    
    try {
      setPurchasing(reward.name);
      const addRes = await shopApi.addPersonalReward(userData.id, reward);
      await shopApi.purchaseItem(userData.id, addRes.data.itemId);
      alert(`✅ Куплено: ${reward.name}!`);
      onRefresh();
      loadData();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Ошибка покупки');
    } finally {
      setPurchasing(null);
    }
  };

  const handleUseReward = async (purchaseId: number, name: string) => {
    if (!confirm(`Использовать "${name}"?`)) return;
    try {
      await shopApi.useReward(userData.id, purchaseId);
      alert('✅ Награда использована!');
      loadData();
    } catch (error) {
      console.error('Error using reward:', error);
    }
  };

  return (
    <div className="me-screen">
      {/* Профиль Header */}
      <div className="profile-header">
        <div className="profile-avatar">
          {userData.photo_url ? (
            <img src={userData.photo_url} alt="" />
          ) : (
            <span>👤</span>
          )}
        </div>
        <div className="profile-info">
          <div className="profile-name">{userData.first_name}</div>
          <div className="profile-level">
            Уровень {userData.level} • {userData.total_xp} XP
          </div>
          <div className="profile-progress">
            <div className="level-bar">
              <div 
                className="level-fill" 
                style={{ width: `${levelProgress.percentage}%` }}
              />
            </div>
            <span className="level-text">{levelProgress.current}/{levelProgress.needed}</span>
          </div>
        </div>
      </div>

      {/* XP Balance */}
      <div className="xp-balance-card">
        <div className="balance-label">Доступно для наград</div>
        <div className="balance-value">💎 {userData.available_xp} XP</div>
      </div>

      {/* Tabs */}
      <div className="me-tabs">
        <button 
          className={`tab-btn ${activeTab === 'goals' ? 'active' : ''}`}
          onClick={() => setActiveTab('goals')}
        >
          🎯 Цели
        </button>
        <button 
          className={`tab-btn ${activeTab === 'rewards' ? 'active' : ''}`}
          onClick={() => setActiveTab('rewards')}
        >
          🎁 Награды
        </button>
        <button 
          className={`tab-btn ${activeTab === 'stats' ? 'active' : ''}`}
          onClick={() => setActiveTab('stats')}
        >
          📊 Статы
        </button>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {loading ? (
          <div className="tab-loading">
            <div className="spinner"></div>
          </div>
        ) : (
          <>
            {/* Goals Tab */}
            {activeTab === 'goals' && (
              <div className="goals-tab">
                <button 
                  className="add-goal-btn"
                  onClick={() => setShowAddGoal(true)}
                >
                  + Добавить цель
                </button>

                {goals.length === 0 ? (
                  <div className="empty-tab">
                    <div className="empty-icon">🎯</div>
                    <p>Добавь свою первую цель!</p>
                  </div>
                ) : (
                  <div className="goals-list">
                    {goals.map(goal => (
                      <div key={goal.id} className="goal-card">
                        <div className="goal-info">
                          <div className="goal-title">{goal.title}</div>
                          {goal.task_count !== undefined && (
                            <div className="goal-tasks">{goal.task_count} задач</div>
                          )}
                        </div>
                        <div className="goal-actions">
                          <button 
                            className="delete-btn"
                            onClick={() => handleDeleteGoal(goal.id)}
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Кнопка AI чата */}
                <button 
                  className="ai-chat-btn"
                  onClick={() => setShowChat(true)}
                  style={{
                    width: '100%',
                    padding: '1rem',
                    marginTop: '1rem',
                    border: '2px solid var(--primary-color)',
                    borderRadius: '12px',
                    background: 'transparent',
                    color: 'var(--primary-color)',
                    fontSize: '1rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem'
                  }}
                >
                  🤖 Поговорить с AI коучем
                </button>
              </div>
            )}

            {/* Rewards Tab */}
            {activeTab === 'rewards' && (
              <div className="rewards-tab">
                {/* Мои купленные награды */}
                {myPurchases.length > 0 && (
                  <div className="rewards-section">
                    <h3 className="section-title">🎁 Мои награды</h3>
                    <div className="rewards-list">
                      {myPurchases.map(purchase => (
                        <div key={purchase.id} className="reward-card owned">
                          <div className="reward-info">
                            <div className="reward-name">{purchase.name}</div>
                            <div className="reward-desc">{purchase.description}</div>
                          </div>
                          <button 
                            className="use-btn"
                            onClick={() => handleUseReward(purchase.id, purchase.name)}
                          >
                            Использовать
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Персональные награды */}
                {personalRewards.length > 0 ? (
                  <div className="rewards-section">
                    <h3 className="section-title">🛒 Магазин</h3>
                    <div className="rewards-list">
                      {personalRewards.map((reward, idx) => (
                        <div key={idx} className="reward-card">
                          <div className="reward-info">
                            <div className="reward-name">{reward.name}</div>
                            <div className="reward-desc">{reward.description}</div>
                            <div className="reward-cost">{reward.xp_cost} XP</div>
                          </div>
                          <button 
                            className="buy-btn"
                            onClick={() => handleBuyReward(reward)}
                            disabled={purchasing === reward.name || userData.available_xp < reward.xp_cost}
                          >
                            {purchasing === reward.name ? '...' : 'Купить'}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="empty-rewards" style={{
                    textAlign: 'center',
                    padding: '2rem 1rem',
                    color: 'var(--text-secondary)'
                  }}>
                    <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🎁</div>
                    <p style={{ marginBottom: '1rem' }}>Награды появятся после того как AI узнает тебя лучше</p>
                    <button 
                      onClick={() => setShowChat(true)}
                      style={{
                        padding: '0.75rem 1.5rem',
                        background: 'var(--primary-color)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '0.9rem',
                        cursor: 'pointer'
                      }}
                    >
                      Поговорить с AI 💬
                    </button>
                  </div>
                )}

                {/* Достижения */}
                <div className="rewards-section">
                  <h3 className="section-title">🏆 Достижения ({achievements.unlockedCount}/{achievements.totalCount})</h3>
                  <div className="achievements-grid">
                    {achievements.all.map(ach => {
                      const unlocked = achievements.unlocked.some(u => u.id === ach.id);
                      return (
                        <div key={ach.id} className={`achievement-badge ${unlocked ? 'unlocked' : 'locked'}`}>
                          <span className="ach-icon">{ach.icon}</span>
                          <span className="ach-name">{ach.name}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Stats Tab */}
            {activeTab === 'stats' && (
              <div className="stats-tab">
                {/* User Rank */}
                {userRank && (
                  <div className="rank-card">
                    <div className="rank-label">Твоё место в рейтинге</div>
                    <div className="rank-value">#{userRank}</div>
                  </div>
                )}

                {/* Stats Grid */}
                <div className="stats-grid">
                  <div className="stat-card">
                    <div className="stat-value">{userData.current_streak}🔥</div>
                    <div className="stat-label">Текущая серия</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value">{userData.longest_streak}🏆</div>
                    <div className="stat-label">Лучшая серия</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value">{stats.completed_tasks}</div>
                    <div className="stat-label">Задач выполнено</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value">{stats.total_goals}</div>
                    <div className="stat-label">Целей</div>
                  </div>
                </div>

                {/* Leaderboard */}
                {leaderboard.length > 0 && (
                  <div className="leaderboard-section">
                    <h3 className="section-title">🏆 Топ игроки</h3>
                    <div className="leaderboard-list">
                      {leaderboard.slice(0, 10).map((player: any) => (
                        <div 
                          key={player.id} 
                          className={`leaderboard-item ${player.id === userData.id ? 'is-me' : ''}`}
                        >
                          <span className="lb-rank">
                            {player.rank <= 3 ? ['🥇', '🥈', '🥉'][player.rank - 1] : `#${player.rank}`}
                          </span>
                          <div className="lb-avatar">
                            {player.photo_url ? (
                              <img src={player.photo_url} alt="" />
                            ) : (
                              <span>👤</span>
                            )}
                          </div>
                          <span className="lb-name">{player.first_name}</span>
                          <span className="lb-xp">{player.total_xp} XP</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Add Goal Modal */}
      {showAddGoal && (
        <div className="modal-overlay" onClick={() => setShowAddGoal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3>Новая цель</h3>
            <input
              type="text"
              className="goal-input"
              placeholder="Например: Выучить английский"
              value={newGoalTitle}
              onChange={e => setNewGoalTitle(e.target.value)}
              autoFocus
            />
            <div className="modal-actions">
              <button className="cancel-btn" onClick={() => setShowAddGoal(false)}>
                Отмена
              </button>
              <button className="confirm-btn" onClick={handleAddGoal}>
                Добавить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unified Chat */}
      {showChat && (
        <UnifiedChat 
          user={user} 
          onClose={() => setShowChat(false)} 
          onRefresh={onRefresh}
        />
      )}
    </div>
  );
}

export default Me;

