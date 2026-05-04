import { useState, useEffect } from 'react';
import { shopApi } from '../api';

interface ShopProps {
  userId: number;
  userXP: number;
  onRefresh: () => void;
}

function Shop({ userId, userXP, onRefresh }: ShopProps) {
  const [boosters, setBoosters] = useState<any[]>([]);
  const [personalRewards, setPersonalRewards] = useState<any[]>([]);
  const [activeBoosters, setActiveBoosters] = useState<any[]>([]);
  const [myPurchases, setMyPurchases] = useState<any[]>([]);
  const [currentMultiplier, setCurrentMultiplier] = useState(1.0);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<number | null>(null);
  const [usingReward, setUsingReward] = useState<number | null>(null);
  const [refreshingRewards, setRefreshingRewards] = useState(false);

  useEffect(() => {
    loadShopData();
  }, [userId]);

  const loadShopData = async () => {
    const startTime = Date.now();
    console.log('[SHOP_UI] Loading shop data...');
    
    try {
      setLoading(true);
      
      // 🚀 ОПТИМИЗАЦИЯ: Загружаем ВСЕ запросы параллельно
      const [
        boostersResult,
        activeBoostersResult,
        personalResult,
        purchasesResult
      ] = await Promise.allSettled([
        shopApi.getItems('booster'),
        shopApi.getActiveBoosters(userId),
        shopApi.getPersonalRewards(userId),
        shopApi.getPurchases(userId, 10)
      ]);

      // Обработка результатов с проверкой ошибок
      const boostersData = boostersResult.status === 'fulfilled' 
        ? boostersResult.value.data.items || [] 
        : [];
      
      let activeBoostersData = [];
      let multiplier = 1.0;
      if (activeBoostersResult.status === 'fulfilled') {
        activeBoostersData = activeBoostersResult.value.data.boosters || [];
        const rawMultiplier = activeBoostersResult.value.data.currentMultiplier;
        multiplier = typeof rawMultiplier === 'number' ? rawMultiplier : parseFloat(rawMultiplier) || 1.0;
      }
      
      let personalRewardsData = [];
      let cached = false;
      if (personalResult.status === 'fulfilled') {
        personalRewardsData = personalResult.value.data.rewards || [];
        cached = personalResult.value.data.cached || false;
      } else {
        console.error('Error loading personal rewards:', personalResult.reason);
      }
      
      const purchasesData = purchasesResult.status === 'fulfilled'
        ? (purchasesResult.value.data.purchases || []).filter((p: any) => p.type === 'reward' && !p.is_used)
        : [];

      // Обновляем состояние
      setBoosters(boostersData);
      setActiveBoosters(activeBoostersData);
      setCurrentMultiplier(multiplier);
      setPersonalRewards(personalRewardsData);
      setMyPurchases(purchasesData);
      
      const elapsed = Date.now() - startTime;
      console.log(`[SHOP_UI] ✓ Shop loaded in ${elapsed}ms (cached: ${cached})`);
    } catch (error) {
      console.error('[SHOP_UI] Error loading shop:', error);
      alert('Ошибка загрузки магазина. Попробуйте ещё раз.');
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (itemId: number, itemName: string, cost: number) => {
    if (userXP < cost) {
      alert(`Недостаточно XP! Нужно: ${cost}, есть: ${userXP}`);
      return;
    }

    if (!confirm(`Купить "${itemName}" за ${cost} XP?`)) {
      return;
    }

    try {
      setPurchasing(itemId);
      await shopApi.purchaseItem(userId, itemId);
      alert(`✅ Куплено: ${itemName}!`);
      onRefresh(); // Сначала обновляем баланс
      await loadShopData(); // Потом перезагружаем магазин
    } catch (error: any) {
      alert(`Ошибка: ${error.response?.data?.error || error.message}`);
    } finally {
      setPurchasing(null);
    }
  };

  const handleRefreshRewards = async () => {
    if (!confirm('Обновить персональные награды? (займет 3-5 секунд)')) return;

    try {
      setRefreshingRewards(true);
      const personalRes = await shopApi.getPersonalRewards(userId, true); // force=true
      setPersonalRewards(personalRes.data.rewards || []);
      alert('✅ Награды обновлены!');
    } catch (error) {
      console.error('Error refreshing rewards:', error);
      alert('Ошибка обновления наград');
    } finally {
      setRefreshingRewards(false);
    }
  };

  const handleBuyPersonalReward = async (reward: any) => {
    // Проверка баланса
    if (userXP < reward.xp_cost) {
      alert(`Недостаточно XP! Нужно: ${reward.xp_cost}, есть: ${userXP}`);
      return;
    }

    if (!confirm(`Купить "${reward.name}" за ${reward.xp_cost} XP?`)) {
      return;
    }

    try {
      setPurchasing(reward.name); // Используем name как ID для персональных наград
      // Сначала добавляем награду в БД
      const addResponse = await shopApi.addPersonalReward(userId, reward);
      const itemId = addResponse.data.itemId;
      
      // Затем покупаем её
      await shopApi.purchaseItem(userId, itemId);
      
      alert(`✅ Куплено: ${reward.name}!`);
      onRefresh(); // Обновляем баланс
      await loadShopData(); // Перезагружаем магазин
    } catch (error: any) {
      console.error('Error buying personal reward:', error);
      alert(`Ошибка: ${error.response?.data?.error || error.message}`);
    } finally {
      setPurchasing(null);
    }
  };

  const handleUseReward = async (purchaseId: number, rewardName: string) => {
    if (!confirm(`Отметить "${rewardName}" как использованную?`)) {
      return;
    }

    try {
      setUsingReward(purchaseId);
      const response = await shopApi.useReward(userId, purchaseId);
      alert(response.data.message || '✅ Награда использована!');
      await loadShopData();
    } catch (error: any) {
      alert(`Ошибка: ${error.response?.data?.error || error.message}`);
    } finally {
      setUsingReward(null);
    }
  };

  if (loading) {
    return (
      <div className="fade-in" style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1rem',
        zIndex: 1000
      }}>
        <div style={{
          width: '48px',
          height: '48px',
          border: '4px solid var(--border-color)',
          borderTop: '4px solid var(--primary-color)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1 className="page-title">🛒 Магазин</h1>
        <p className="page-subtitle" style={{color: 'var(--text-secondary)'}}>
          Твой баланс: <strong style={{color: 'var(--primary-color)'}}>{userXP} XP</strong>
        </p>
      </div>

      {/* Активные бустеры */}
      {activeBoosters.length > 0 && (
        <div className="card" style={{
          marginBottom: '1rem', 
          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', 
          color: 'white',
          boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)'
        }}>
          <h3 style={{marginBottom: '0.75rem', color: 'white', textShadow: '0 2px 4px rgba(0,0,0,0.2)'}}>⚡ Активные бустеры</h3>
          <p style={{
            fontSize: '1.25rem', 
            fontWeight: 'bold', 
            marginBottom: '0.5rem',
            color: 'white',
            textShadow: '0 2px 4px rgba(0,0,0,0.3)'
          }}>
            Множитель XP: x{typeof currentMultiplier === 'number' ? currentMultiplier.toFixed(1) : '1.0'}
          </p>
          {activeBoosters.map(booster => (
            <div key={booster.id} style={{
              fontSize: '0.875rem', 
              color: 'rgba(255, 255, 255, 0.95)',
              background: 'rgba(255, 255, 255, 0.1)',
              padding: '0.5rem',
              borderRadius: '6px',
              marginTop: '0.5rem',
              textShadow: '0 1px 2px rgba(0,0,0,0.2)'
            }}>
              {booster.icon} {booster.name} - до {new Date(booster.expires_at).toLocaleString('ru-RU')}
            </div>
          ))}
        </div>
      )}

      {/* Бустеры */}
      <div className="card" style={{marginBottom: '1rem'}}>
        <h3 style={{marginBottom: '1rem', color: 'var(--text-primary)'}}>⚡ Бустеры XP</h3>
        {boosters.length === 0 ? (
          <div style={{
            padding: '1rem',
            textAlign: 'center',
            color: 'var(--text-secondary)',
            background: 'var(--secondary-bg-color)',
            borderRadius: '8px',
            border: '1px solid var(--border-color)'
          }}>
            <p>⚠️ Бустеры не загружены. Попробуйте обновить страницу.</p>
          </div>
        ) : (
          <div style={{display: 'grid', gap: '0.75rem'}}>
            {boosters.map(item => (
            <div key={item.id} className="card" style={{padding: '1rem', border: '2px solid var(--border-color)'}}>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <div style={{flex: 1}}>
                  <div style={{fontWeight: 600, marginBottom: '0.25rem', color: 'var(--text-primary)'}}>{item.name}</div>
                  <div style={{fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem'}}>{item.description}</div>
                  <div style={{color: 'var(--primary-color)', fontWeight: 'bold'}}>{item.xp_cost} XP</div>
                </div>
                <button
                  className="btn btn-primary"
                  onClick={() => handlePurchase(item.id, item.name, item.xp_cost)}
                  disabled={purchasing === item.id || userXP < item.xp_cost}
                  style={{marginLeft: '1rem'}}
                >
                  {purchasing === item.id ? '...' : 'Купить'}
                </button>
              </div>
            </div>
          ))}
          </div>
        )}
      </div>

      {/* Мои купленные награды */}
      {myPurchases.length > 0 && (
        <div className="card" style={{
          marginBottom: '1rem', 
          border: '2px solid var(--success-color)',
          background: 'var(--card-bg)'
        }}>
          <h3 style={{marginBottom: '0.75rem', color: 'var(--text-primary)'}}>🎁 Мои награды</h3>
          <p style={{fontSize: '0.875rem', marginBottom: '1rem', color: 'var(--text-secondary)'}}>
            Ты заработал эти награды! Отметь их как использованные после того, как насладишься ими.
          </p>
          <div style={{display: 'grid', gap: '0.75rem'}}>
            {myPurchases.map(purchase => (
              <div key={purchase.id} style={{
                background: 'var(--secondary-bg-color)', 
                borderRadius: '8px', 
                padding: '1rem',
                border: '1px solid var(--border-color)'
              }}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                  <div style={{flex: 1}}>
                    <div style={{fontWeight: 600, marginBottom: '0.25rem', color: 'var(--text-primary)'}}>{purchase.name}</div>
                    <div style={{fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem'}}>{purchase.description}</div>
                    <div style={{fontSize: '0.75rem', color: 'var(--text-secondary)'}}>
                      Куплено: {new Date(purchase.purchased_at).toLocaleDateString('ru-RU')}
                    </div>
                  </div>
                  <button
                    className="btn btn-primary"
                    onClick={() => handleUseReward(purchase.id, purchase.name)}
                    disabled={usingReward === purchase.id}
                    style={{
                      marginLeft: '1rem',
                      fontSize: '0.875rem',
                      padding: '0.5rem 1rem'
                    }}
                  >
                    {usingReward === purchase.id ? '⏳' : '✓ Использовал'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Персональные награды */}
      {personalRewards.length > 0 && (
        <div className="card" style={{marginBottom: '1rem'}}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem'}}>
            <h3 style={{color: 'var(--text-primary)', margin: 0}}>🎁 Твои персональные награды</h3>
            <button
              className="btn btn-outline"
              style={{fontSize: '0.875rem', padding: '0.5rem 1rem'}}
              onClick={handleRefreshRewards}
              disabled={refreshingRewards}
            >
              {refreshingRewards ? '⏳' : '🔄'}
            </button>
          </div>
          <p style={{fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1rem'}}>
            Награды на основе твоих слабостей. Заработай XP и побалуй себя!
          </p>
          <div style={{display: 'grid', gap: '0.75rem'}}>
            {personalRewards.map((reward, idx) => (
              <div key={idx} className="card" style={{padding: '1rem', border: '2px solid var(--border-color)'}}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                  <div style={{flex: 1}}>
                    <div style={{fontWeight: 600, marginBottom: '0.25rem', color: 'var(--text-primary)'}}>{reward.name}</div>
                    <div style={{fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem'}}>{reward.description}</div>
                    <div style={{color: 'var(--primary-color)', fontWeight: 'bold'}}>{reward.xp_cost} XP</div>
                  </div>
                  <button
                    className="btn btn-primary"
                    onClick={() => handleBuyPersonalReward(reward)}
                    disabled={purchasing === reward.name || userXP < reward.xp_cost}
                    style={{marginLeft: '1rem'}}
                  >
                    {purchasing === reward.name ? '⏳' : 'Купить'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}

export default Shop;

