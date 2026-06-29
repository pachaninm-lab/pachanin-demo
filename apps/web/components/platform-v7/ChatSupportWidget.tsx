'use client';

import { useState, useRef, useEffect } from 'react';

interface ChatMessage {
  id: string;
  from: 'user' | 'support' | 'bot';
  text: string;
  ts: Date;
}

const BOT_REPLIES: Record<string, string> = {
  default: 'Получили ваш запрос. Оператор ответит в течение 5–15 минут. Для срочных вопросов: +7 (800) 555-35-35',
  спор: 'По спорам обращайтесь в раздел /disputes → «Открыть апелляцию». Срок рассмотрения — 3 рабочих дня.',
  выплата: 'Статус выплаты можно отследить в карточке сделки → вкладка «Деньги». Если выплата заблокирована — проверьте блокеры в «Следующее действие».',
  документ: 'Для загрузки документов перейдите в карточку сделки → «Документы» или в /documents. Поддерживаемые форматы: PDF, DOCX, XML (СБИС).',
  лаборатория: 'Результаты анализа лаборатории отображаются в разделе /lab. Вопросы по протоколу — обратитесь к оператору площадки.',
};

function getBotReply(text: string): string {
  const lower = text.toLowerCase();
  for (const key of Object.keys(BOT_REPLIES)) {
    if (key !== 'default' && lower.includes(key)) return BOT_REPLIES[key];
  }
  return BOT_REPLIES.default;
}

const QUICK_PROMPTS = [
  'Как разблокировать выплату?',
  'Статус спора',
  'Не могу загрузить документ',
  'Вопрос по лаборатории',
];

export function ChatSupportWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'init',
      from: 'bot',
      text: 'Добрый день! Я помощник GrainFlow. Выберите тему или напишите свой вопрос.',
      ts: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  function sendMessage(text: string) {
    if (!text.trim()) return;
    const userMsg: ChatMessage = { id: `u-${Date.now()}`, from: 'user', text: text.trim(), ts: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setTyping(true);
    setTimeout(() => {
      const reply = getBotReply(text);
      setMessages((prev) => [...prev, { id: `b-${Date.now()}`, from: 'bot', text: reply, ts: new Date() }]);
      setTyping(false);
    }, 900 + Math.random() * 600);
  }

  function formatTime(ts: Date) {
    return ts.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Чат поддержки"
        style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 900,
          width: 56, height: 56, borderRadius: '50%', border: 'none', cursor: 'pointer',
          background: '#0A7A5F', color: '#fff',
          boxShadow: '0 8px 24px rgba(10,122,95,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 24, transition: 'transform 200ms',
          transform: open ? 'rotate(45deg)' : 'none',
        }}
      >
        {open ? '×' : '💬'}
      </button>

      {/* Chat window */}
      {open && (
        <div style={{
          position: 'fixed', bottom: 92, right: 24, zIndex: 900,
          width: 340, maxHeight: 480,
          borderRadius: 20, background: '#fff',
          boxShadow: '0 20px 60px rgba(15,23,42,0.18)',
          border: '1px solid #E4E6EA',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{ background: '#0A7A5F', padding: '12px 16px', display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🌾</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>Поддержка GrainFlow</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.75)' }}>Онлайн · обычно отвечаем за 10 мин</div>
            </div>
            <div style={{ marginLeft: 'auto', fontSize: 9, color: 'rgba(255,255,255,0.6)' }}>
              Telegram / Jivo
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
            {messages.map((msg) => (
              <div key={msg.id} style={{ display: 'flex', flexDirection: msg.from === 'user' ? 'row-reverse' : 'row', gap: 8, alignItems: 'flex-end' }}>
                {msg.from !== 'user' && (
                  <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#0A7A5F', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#fff', flexShrink: 0 }}>🌾</div>
                )}
                <div style={{
                  maxWidth: '75%', padding: '8px 10px', borderRadius: msg.from === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                  background: msg.from === 'user' ? '#0A7A5F' : '#F1F5F9',
                  color: msg.from === 'user' ? '#fff' : '#0F1419',
                  fontSize: 12, lineHeight: 1.55,
                }}>
                  {msg.text}
                  <div style={{ fontSize: 9, color: msg.from === 'user' ? 'rgba(255,255,255,0.6)' : '#94A3B8', marginTop: 3, textAlign: 'right' }}>
                    {formatTime(msg.ts)}
                  </div>
                </div>
              </div>
            ))}
            {typing && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#0A7A5F', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#fff' }}>🌾</div>
                <div style={{ padding: '8px 12px', borderRadius: '12px 12px 12px 2px', background: '#F1F5F9', display: 'flex', gap: 4 }}>
                  {[0, 1, 2].map((i) => (
                    <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: '#94A3B8', animation: `bounce 1.2s ${i * 0.2}s infinite` }} />
                  ))}
                  <style>{`@keyframes bounce { 0%,80%,100% { transform: translateY(0); } 40% { transform: translateY(-4px); } }`}</style>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Quick prompts */}
          {messages.length <= 2 && (
            <div style={{ padding: '0 12px 8px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {QUICK_PROMPTS.map((q) => (
                <button key={q} onClick={() => sendMessage(q)} style={{ fontSize: 10, fontWeight: 700, padding: '4px 8px', borderRadius: 8, cursor: 'pointer', border: '1px solid rgba(10,122,95,0.3)', background: 'rgba(10,122,95,0.06)', color: '#0A7A5F' }}>
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div style={{ padding: '8px 12px', borderTop: '1px solid #E4E6EA', display: 'flex', gap: 8 }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
              placeholder="Ваш вопрос..."
              style={{ flex: 1, fontSize: 12, padding: '8px 10px', borderRadius: 10, border: '1px solid #E4E6EA', outline: 'none', minWidth: 0 }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || typing}
              style={{ width: 36, height: 36, borderRadius: 10, border: 'none', cursor: input.trim() ? 'pointer' : 'default', background: input.trim() ? '#0A7A5F' : '#E4E6EA', color: input.trim() ? '#fff' : '#94A3B8', flexShrink: 0, fontSize: 14 }}
            >
              →
            </button>
          </div>
        </div>
      )}
    </>
  );
}
