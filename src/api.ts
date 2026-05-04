import axios from 'axios';

const API_BASE_URL = import.meta.env.PROD 
  ? 'https://my-bots.uz/xpgame/api' 
  : 'http://localhost:3007/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Добавляем Telegram initData к каждому запросу
api.interceptors.request.use((config) => {
  const initData = window.Telegram?.WebApp?.initData;
  if (initData) {
    config.headers['x-telegram-init-data'] = initData;
  }
  return config;
});

// Types
export interface User {
  id: number;
  telegram_id: number;
  username?: string;
  first_name: string;
  level: number;
  total_xp: number;
  available_xp: number;
  current_streak: number;
  longest_streak: number;
  photo_url?: string;
}

export interface Goal {
  id: number;
  user_id: number;
  title: string;
  description?: string;
  category?: string;
  status: 'active' | 'completed' | 'paused';
  priority: number;
  task_count?: number;
  auto_generate_tasks?: boolean;
  created_at: string;
}

export interface Weakness {
  id: number;
  user_id: number;
  title: string;
  description?: string;
  severity: number;
}

export interface Task {
  id: number;
  user_id: number;
  goal_id?: number;
  title: string;
  description?: string;
  xp_reward: number;
  difficulty: 'easy' | 'medium' | 'hard';
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  goal_title?: string;
  category?: string;
  due_date?: string;
  created_at: string;
  completed_at?: string;
  from_chat?: boolean;
  roadmap_stage?: number;
}

export interface Achievement {
  id: number;
  name: string;
  description?: string;
  icon: string;
  xp_value: number;
  unlocked_at?: string;
}

export interface GameStats {
  user: User;
  stats: {
    total_goals: number;
    completed_tasks: number;
    pending_tasks: number;
    achievements_unlocked: number;
  };
  levelProgress: {
    current: number;
    needed: number;
    percentage: number;
  };
  achievements: {
    unlocked: Achievement[];
    all: Achievement[];
    unlockedCount: number;
    totalCount: number;
  };
}

// API Methods
export const userApi = {
  getUser: (telegramId: number) => 
    api.get<GameStats>(`/user/${telegramId}`),
  
  createOrUpdateUser: (data: { 
    telegram_id: number; 
    username?: string; 
    first_name: string; 
    last_name?: string;
    photo_url?: string;
  }) => 
    api.post<User>('/user', data),
};

export const goalsApi = {
  getGoals: (userId: number) => 
    api.get<Goal[]>(`/goals/${userId}`),
  
  createGoal: (data: { 
    user_id: number; 
    title: string; 
    description?: string; 
    category?: string;
    priority?: number;
  }) => 
    api.post<{ goal: Goal; unlockedAchievements: Achievement[] }>('/goals', data),
  
  updateGoal: (goalId: number, updates: Partial<Goal>) => 
    api.put<Goal>(`/goals/${goalId}`, updates),
  
  deleteGoal: (goalId: number) => 
    api.delete(`/goals/${goalId}`),
};

export const weaknessesApi = {
  getWeaknesses: (userId: number) => 
    api.get<Weakness[]>(`/weaknesses/${userId}`),
  
  createWeakness: (data: { 
    user_id: number; 
    title: string; 
    description?: string;
    severity?: number;
  }) => 
    api.post<Weakness>('/weaknesses', data),
  
  updateWeakness: (weaknessId: number, updates: Partial<Weakness>) => 
    api.put<Weakness>(`/weaknesses/${weaknessId}`, updates),
  
  deleteWeakness: (weaknessId: number) => 
    api.delete(`/weaknesses/${weaknessId}`),
};

export const tasksApi = {
  getTasks: (userId: number, status?: string) => 
    api.get<Task[]>(`/tasks/${userId}`, { params: { status } }),
  
  completeTask: (taskId: number, userId: number) => 
    api.post<{
      success: boolean;
      xpGained: number;
      newXP: number;
      newLevel: number;
      leveledUp: boolean;
      newStreak: number;
      unlockedAchievements: Achievement[];
    }>(`/tasks/${taskId}/complete`, { user_id: userId }),
  
  updateTaskStatus: (taskId: number, status: string) => 
    api.put<Task>(`/tasks/${taskId}/status`, { status }),
  
  deleteTask: (taskId: number) => 
    api.delete(`/tasks/${taskId}`),
  
  submitFeedback: (taskId: number, feedback: string) =>
    api.post(`/tasks/${taskId}/feedback`, { feedback }),

  getRefreshStatus: (userId: number) =>
    api.get<{
      canRefresh: boolean;
      lastRefreshAt: string;
      nextRefreshAt: string;
      secondsUntilNext: number;
    }>(`/tasks/refresh-status/${userId}`),
  
  autoRefresh: (userId: number, force = false) =>
    api.post<{
      success: boolean;
      responseId: string;
      progress_analysis: string;
      tasks: Task[];
      motivation_message: string;
      nextRefreshAt: string;
      secondsUntilNext: number;
    }>('/tasks/auto-refresh', { user_id: userId, force }),
};

export const aiApi = {
  generatePlan: (userId: number) => 
    api.post<{
      success: boolean;
      responseId: string;
      analysis: string;
      tasks: Task[];
      recommendations: string[];
    }>('/generate-plan', { user_id: userId }),
  
  updatePlan: (userId: number) => 
    api.post<{
      success: boolean;
      responseId: string;
      progress_analysis: string;
      tasks: Task[];
      motivation_message: string;
    }>('/update-plan', { user_id: userId }),
  
  getMotivation: (userId: number, force = false) => 
    api.post<{ message: string; cached?: boolean; secondsUntilExpiry?: number }>('/motivation', { user_id: userId, force }),
};

export const gamificationApi = {
  getDailyBonus: (userId: number) => 
    api.post<{
      success: boolean;
      secondsUntilNext?: number;
      xpGained?: number;
      baseBonus?: number;
      streakBonus?: number;
      currentStreak?: number;
      message?: string;
      hoursUntilNext?: number;
    }>('/daily-bonus', { user_id: userId }),
  
  getLeaderboard: (limit = 10) => 
    api.get<User[]>('/leaderboard', { params: { limit } }),
};

// Shop API
export const shopApi = {
  getItems: (type?: string) =>
    api.get('/shop/items', { params: { type } }),
  
  getPersonalRewards: (userId: number, force = false) =>
    api.get(`/shop/personal-rewards/${userId}`, force ? { params: { force: true } } : {}),
  
  getActiveBoosters: (userId: number) =>
    api.get(`/shop/boosters/${userId}`),
  
  purchaseItem: (userId: number, itemId: number) =>
    api.post('/shop/purchase', { userId, itemId }),
  
  addPersonalReward: (userId: number, reward: any) =>
    api.post('/shop/add-personal-reward', { userId, reward }),
  
  getPurchases: (userId: number, limit = 20) =>
    api.get(`/shop/purchases/${userId}`, { params: { limit } }),
  
  useReward: (userId: number, purchaseId: number) =>
    api.post('/shop/use-reward', { userId, purchaseId }),
};

// Auth API
export const authApi = {
  checkPassword: (userId: number, password: string) =>
    api.post('/auth/check-password', { userId, password }),
  
  getStatus: (userId: number) =>
    api.get(`/auth/status/${userId}`),
  
  updateOnboarding: (userId: number, step: string | null, completed: boolean = false) =>
    api.post('/auth/update-onboarding', { userId, step, completed }),
};

// Budget API
export const budgetApi = {
  // Incomes
  getIncomes: (userId: number, startDate?: string, endDate?: string) =>
    api.get(`/budget/incomes/${userId}`, { params: { startDate, endDate } }),
  
  createIncome: (data: any) =>
    api.post('/budget/incomes', data),
  
  updateIncome: (id: number, data: any) =>
    api.put(`/budget/incomes/${id}`, data),
  
  deleteIncome: (id: number) =>
    api.delete(`/budget/incomes/${id}`),
  
  // Expenses
  getExpenses: (userId: number, startDate?: string, endDate?: string) =>
    api.get(`/budget/expenses/${userId}`, { params: { startDate, endDate } }),
  
  createExpense: (data: any) =>
    api.post('/budget/expenses', data),
  
  updateExpense: (id: number, data: any) =>
    api.put(`/budget/expenses/${id}`, data),
  
  deleteExpense: (id: number) =>
    api.delete(`/budget/expenses/${id}`),
  
  // Subscriptions
  getSubscriptions: (userId: number, active?: boolean) =>
    api.get(`/budget/subscriptions/${userId}`, { params: { active } }),
  
  createSubscription: (data: any) =>
    api.post('/budget/subscriptions', data),
  
  updateSubscription: (id: number, data: any) =>
    api.put(`/budget/subscriptions/${id}`, data),
  
  deleteSubscription: (id: number) =>
    api.delete(`/budget/subscriptions/${id}`),
  
  // Stats
  getStats: (userId: number, startDate?: string, endDate?: string) =>
    api.get(`/budget/stats/${userId}`, { params: { startDate, endDate } }),
};

// Leaderboard API
export const leaderboardApi = {
  getLeaderboard: (limit = 50, userId?: number) =>
    api.get('/leaderboard', { params: { limit, userId } }),
};

// Goal Chat Types
export interface ChatMessage {
  id: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: any;
  created_at: string;
}

export interface GoalContext {
  roadmap: Array<{
    stage: number;
    title: string;
    description: string;
    completed: boolean;
  }>;
  current_stage: number;
  preferences: any;
  ai_notes?: string;
  updated_at: string;
  roadmap_generated?: boolean;
  tasks_generated?: boolean;
  completed_stages?: number[];
}

// Goal Chat API
export const goalChatApi = {
  // Получить историю сообщений
  getMessages: (goalId: number) =>
    api.get(`/goal-chat/${goalId}/messages`).then(res => res.data),
  
  // Отправить сообщение
  sendMessage: (goalId: number, message: string) =>
    api.post(`/goal-chat/${goalId}/message`, { message }).then(res => res.data),
  
  // Получить контекст цели (roadmap)
  getContext: (goalId: number) =>
    api.get(`/goal-chat/${goalId}/context`).then(res => res.data),
  
  // Обновить контекст
  updateContext: (goalId: number, data: Partial<GoalContext>) =>
    api.put(`/goal-chat/${goalId}/context`, data).then(res => res.data),
  
  // Очистить историю чата
  clearMessages: (goalId: number) =>
    api.delete(`/goal-chat/${goalId}/messages`).then(res => res.data),
  
  // Генерировать задачи из roadmap
  generateTasks: (goalId: number, daysToGenerate: number = 7) =>
    api.post(`/goal-chat/${goalId}/generate-tasks`, { daysToGenerate }).then(res => res.data),
};

export default api;

