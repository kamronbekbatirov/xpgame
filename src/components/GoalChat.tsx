import { useState, useEffect, useRef } from 'react';
import { goalChatApi, ChatMessage, GoalContext, Goal } from '../api';

interface GoalChatProps {
  goal: Goal;
  onClose: () => void;
}

function GoalChat({ goal, onClose }: GoalChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [context, setContext] = useState<GoalContext | null>(null);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const [showRoadmap, setShowRoadmap] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Загрузка сообщений и контекста при открытии
  useEffect(() => {
    loadChatData();
  }, [goal.id]);

  // Автоскролл к последнему сообщению
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Закрытие меню при клике вне его
  useEffect(() => {
    const handleClickOutside = () => {
      if (showMenu) {
        setShowMenu(false);
      }
    };
    
    if (showMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showMenu]);

  const loadChatData = async () => {
    try {
      setLoadingMessages(true);
      const [messagesData, contextData] = await Promise.all([
        goalChatApi.getMessages(goal.id),
        goalChatApi.getContext(goal.id)
      ]);
      setMessages(messagesData.messages || []);
      setContext(contextData.context);
    } catch (error) {
      console.error('Error loading chat data:', error);
    } finally {
      setLoadingMessages(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || loading) return;

    const userMessage = inputMessage.trim();
    setInputMessage('');
    setLoading(true);

    // Добавляем сообщение пользователя сразу в UI
    const tempUserMessage: ChatMessage = {
      id: Date.now(),
      role: 'user',
      content: userMessage,
      created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, tempUserMessage]);

    try {
      const response = await goalChatApi.sendMessage(goal.id, userMessage);
      
      // Добавляем ответ AI
      const aiMessage: ChatMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: response.message,
        created_at: new Date().toISOString()
      };
      setMessages(prev => [...prev, aiMessage]);

      // Если AI создал roadmap, обновляем контекст
      if (response.roadmapCreated) {
        const contextData = await goalChatApi.getContext(goal.id);
        setContext(contextData.context);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      // Показываем ошибку
      const errorMessage: ChatMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: '❌ Ошибка при отправке сообщения. Попробуй ещё раз.',
        created_at: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleClearChat = async () => {
    if (!confirm('Вы уверены, что хотите очистить всю историю чата и план? Это действие нельзя отменить.')) {
      return;
    }

    try {
      setLoading(true);
      await goalChatApi.clearMessages(goal.id);
      setMessages([]);
      setContext(null);
      setShowMenu(false);
      alert('✅ Чат успешно очищен!');
    } catch (error) {
      console.error('Error clearing chat:', error);
      alert('❌ Ошибка при очистке чата');
    } finally {
      setLoading(false);
    }
  };

  const handleExportChat = async () => {
    try {
      const chatText = messages.map(msg => 
        `${msg.role === 'user' ? 'Ты' : 'AI'}: ${msg.content}`
      ).join('\n\n');
      
      const fileName = `chat-${goal.title.replace(/[^a-zA-Z0-9]/g, '_')}-${new Date().toISOString().split('T')[0]}.txt`;
      
      // Проверяем доступность Telegram API
      const tgWebApp = window.Telegram?.WebApp as any;
      const hasTelegramDownload = tgWebApp?.downloadFile && typeof tgWebApp.downloadFile === 'function';
      
      if (hasTelegramDownload) {
        // Отправляем текст на сервер для создания временного файла
        const response = await fetch('/xpgame/api/goal-chat/export-temp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ content: chatText, fileName })
        });
        
        if (!response.ok) throw new Error('Failed to create temp file');
        
        const { url: downloadUrl } = await response.json();
        
        console.log('Download URL:', downloadUrl);
        
        // Используем Telegram API для скачивания
        tgWebApp.downloadFile({
          url: downloadUrl,
          file_name: fileName
        }, (success: boolean) => {
          if (success) {
            console.log('✅ Файл успешно скачан');
            alert('✅ Чат экспортирован!');
          } else {
            console.log('❌ Скачивание отменено пользователем');
          }
        });
      } else {
        // Fallback для браузера
        const blob = new Blob([chatText], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
      }
      
      setShowMenu(false);
    } catch (error) {
      console.error('Error exporting chat:', error);
      alert('❌ Ошибка при экспорте чата');
    }
  };

  const handleImportChat = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt';
    input.onchange = async (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        
        // Парсим текст чата
        const lines = text.split('\n\n');
        const importedMessages: Array<{ role: 'user' | 'assistant', content: string }> = [];
        
        for (const line of lines) {
          if (line.startsWith('Ты: ')) {
            importedMessages.push({
              role: 'user',
              content: line.substring(4)
            });
          } else if (line.startsWith('AI: ')) {
            importedMessages.push({
              role: 'assistant',
              content: line.substring(4)
            });
          }
        }

        if (importedMessages.length === 0) {
          alert('❌ Не удалось распознать формат файла');
          return;
        }

        // Подтверждение импорта
        if (!confirm(`Импортировать ${importedMessages.length} сообщений? Это заменит текущую историю чата.`)) {
          return;
        }

        // Очищаем текущий чат
        setLoading(true);
        await goalChatApi.clearMessages(goal.id);

        // Отправляем импортированные сообщения
        for (const msg of importedMessages) {
          if (msg.role === 'user') {
            await goalChatApi.sendMessage(goal.id, msg.content);
          }
        }

        // Перезагружаем чат
        await loadChatData();
        alert('✅ Чат успешно импортирован!');
      } catch (error) {
        console.error('Error importing chat:', error);
        alert('❌ Ошибка при импорте чата');
      } finally {
        setLoading(false);
        setShowMenu(false);
      }
    };
    input.click();
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'var(--tg-theme-bg-color, #ffffff)',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header */}
      <div style={{
        padding: '16px',
        borderBottom: '1px solid var(--tg-theme-hint-color, #e0e0e0)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        background: 'var(--tg-theme-secondary-bg-color, #f5f5f5)',
        position: 'relative'
      }}>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '24px',
            cursor: 'pointer',
            padding: '4px 8px',
            color: 'var(--tg-theme-text-color, #000000)'
          }}
        >
          ←
        </button>
        <div style={{ flex: 1 }}>
          <div style={{
            fontWeight: 'bold',
            fontSize: '16px',
            color: 'var(--tg-theme-text-color, #000000)'
          }}>
            💬 Обсудить цель с AI
          </div>
          <div style={{
            fontSize: '14px',
            color: 'var(--tg-theme-hint-color, #999999)',
            marginTop: '2px'
          }}>
            {goal.title}
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu(!showMenu);
          }}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '24px',
            cursor: 'pointer',
            padding: '4px 8px',
            color: 'var(--tg-theme-text-color, #000000)'
          }}
        >
          ⋮
        </button>

        {/* Dropdown Menu */}
        {showMenu && (
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'absolute',
              top: '60px',
              right: '16px',
              background: 'var(--tg-theme-bg-color, #ffffff)',
              border: '1px solid var(--tg-theme-hint-color, #e0e0e0)',
              borderRadius: '12px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              zIndex: 1001,
              minWidth: '200px',
              overflow: 'hidden'
            }}>
            <button
              onClick={handleExportChat}
              disabled={messages.length === 0}
              style={{
                width: '100%',
                padding: '12px 16px',
                border: 'none',
                background: 'none',
                textAlign: 'left',
                cursor: messages.length === 0 ? 'not-allowed' : 'pointer',
                color: messages.length === 0 
                  ? 'var(--tg-theme-hint-color, #999999)'
                  : 'var(--tg-theme-text-color, #000000)',
                fontSize: '15px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              📥 Экспортировать чат
            </button>
            <div style={{
              height: '1px',
              background: 'var(--tg-theme-hint-color, #e0e0e0)'
            }} />
            <button
              onClick={handleImportChat}
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px 16px',
                border: 'none',
                background: 'none',
                textAlign: 'left',
                cursor: loading ? 'not-allowed' : 'pointer',
                color: loading
                  ? 'var(--tg-theme-hint-color, #999999)'
                  : 'var(--tg-theme-text-color, #000000)',
                fontSize: '15px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              📤 Импортировать чат
            </button>
            <div style={{
              height: '1px',
              background: 'var(--tg-theme-hint-color, #e0e0e0)'
            }} />
            <button
              onClick={handleClearChat}
              disabled={messages.length === 0 || loading}
              style={{
                width: '100%',
                padding: '12px 16px',
                border: 'none',
                background: 'none',
                textAlign: 'left',
                cursor: messages.length === 0 || loading ? 'not-allowed' : 'pointer',
                color: messages.length === 0 || loading
                  ? 'var(--tg-theme-hint-color, #999999)'
                  : '#ff4444',
                fontSize: '15px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              🗑️ Очистить чат
            </button>
          </div>
        )}
      </div>

      {/* Roadmap (если создан) */}
      {context && context.roadmap && context.roadmap.length > 0 && (
        <div style={{
          padding: '12px',
          background: 'var(--tg-theme-secondary-bg-color, #f5f5f5)',
          borderBottom: '1px solid var(--tg-theme-hint-color, #e0e0e0)'
        }}>
          <div 
            onClick={() => setShowRoadmap(!showRoadmap)}
            style={{
              fontWeight: 'bold',
              fontSize: '14px',
              marginBottom: showRoadmap ? '12px' : '0',
              color: 'var(--tg-theme-text-color, #000000)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <span>📍 План развития ({context.roadmap.length} этапов)</span>
            <span style={{ fontSize: '18px' }}>{showRoadmap ? '▼' : '▶'}</span>
          </div>
          {showRoadmap && (
            <>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                maxHeight: '300px',
                overflowY: 'auto'
              }}>
                {context.roadmap.map((stage, index) => (
                  <div
                    key={index}
                    style={{
                      padding: '8px',
                      background: index === context.current_stage
                        ? 'var(--tg-theme-button-color, #3390ec)'
                        : 'var(--tg-theme-bg-color, #ffffff)',
                      borderRadius: '6px',
                      border: '1px solid var(--tg-theme-hint-color, #e0e0e0)',
                      color: index === context.current_stage
                        ? 'var(--tg-theme-button-text-color, #ffffff)'
                        : 'var(--tg-theme-text-color, #000000)',
                      fontSize: '13px'
                    }}
                  >
                    <div style={{ fontWeight: 'bold', marginBottom: '2px' }}>
                      {stage.completed ? '✅' : index === context.current_stage ? '📍' : '⭕'} Этап {stage.stage}: {stage.title}
                    </div>
                  </div>
                ))}
              </div>
          {/* Кнопка создания задач */}
          {!context.tasks_generated && (
            <button
              onClick={async () => {
                if (loading) return;
                try {
                  setLoading(true);
                  await goalChatApi.generateTasks(goal.id, 7);
                  alert('✅ Задачи созданы! Проверьте раздел "Задачи"');
                  // Обновляем контекст
                  await loadChatData();
                } catch (error) {
                  console.error('Error generating tasks:', error);
                  alert('❌ Ошибка при создании задач');
                } finally {
                  setLoading(false);
                }
              }}
              disabled={loading}
              style={{
                marginTop: '12px',
                width: '100%',
                padding: '12px',
                background: 'var(--tg-theme-button-color, #3390ec)',
                color: 'var(--tg-theme-button-text-color, #ffffff)',
                border: 'none',
                borderRadius: '8px',
                fontSize: '15px',
                fontWeight: 'bold',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1
              }}
            >
              {loading ? '⏳ Создаю задачи...' : '📝 Создать задачи из плана'}
            </button>
          )}
            </>
          )}
        </div>
      )}

      {/* Messages */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
      }}>
        {loadingMessages ? (
          <div style={{
            textAlign: 'center',
            padding: '40px 20px',
            color: 'var(--tg-theme-hint-color, #999999)'
          }}>
            Загрузка...
          </div>
        ) : messages.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '40px 20px',
            color: 'var(--tg-theme-hint-color, #999999)'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>💬</div>
            <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '8px' }}>
              Начни разговор с AI!
            </div>
            <div style={{ fontSize: '14px' }}>
              Расскажи подробнее о своей цели, и AI поможет создать план действий
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              style={{
                display: 'flex',
                justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start'
              }}
            >
              <div style={{
                maxWidth: '80%',
                padding: '12px 16px',
                borderRadius: '16px',
                background: message.role === 'user'
                  ? 'var(--tg-theme-button-color, #3390ec)'
                  : 'var(--tg-theme-secondary-bg-color, #f5f5f5)',
                color: message.role === 'user'
                  ? 'var(--tg-theme-button-text-color, #ffffff)'
                  : 'var(--tg-theme-text-color, #000000)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}>
                {message.content}
              </div>
            </div>
          ))
        )}
        {loading && (
          <div style={{
            display: 'flex',
            justifyContent: 'flex-start'
          }}>
            <div style={{
              padding: '12px 16px',
              borderRadius: '16px',
              background: 'var(--tg-theme-secondary-bg-color, #f5f5f5)',
              color: 'var(--tg-theme-hint-color, #999999)'
            }}>
              AI печатает...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: '16px',
        borderTop: '1px solid var(--tg-theme-hint-color, #e0e0e0)',
        background: 'var(--tg-theme-bg-color, #ffffff)',
        display: 'flex',
        gap: '12px',
        alignItems: 'flex-end'
      }}>
        <textarea
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Напиши сообщение..."
          disabled={loading}
          style={{
            flex: 1,
            padding: '12px',
            borderRadius: '12px',
            border: '1px solid var(--tg-theme-hint-color, #e0e0e0)',
            background: 'var(--tg-theme-bg-color, #ffffff)',
            color: 'var(--tg-theme-text-color, #000000)',
            fontSize: '16px',
            fontFamily: 'inherit',
            resize: 'none',
            minHeight: '44px',
            maxHeight: '120px',
            outline: 'none'
          }}
          rows={1}
        />
        <button
          onClick={handleSendMessage}
          disabled={!inputMessage.trim() || loading}
          style={{
            padding: '12px 20px',
            borderRadius: '12px',
            border: 'none',
            background: !inputMessage.trim() || loading
              ? 'var(--tg-theme-hint-color, #cccccc)'
              : 'var(--tg-theme-button-color, #3390ec)',
            color: 'var(--tg-theme-button-text-color, #ffffff)',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: !inputMessage.trim() || loading ? 'not-allowed' : 'pointer',
            height: '44px',
            minWidth: '60px'
          }}
        >
          {loading ? '...' : '➤'}
        </button>
      </div>
    </div>
  );
}

export default GoalChat;

