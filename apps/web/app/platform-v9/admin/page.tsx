'use client';
import * as React from 'react';
import { Settings } from 'lucide-react';

export default function AdminPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0F1419', margin: 0 }}>Администрирование</h1>
      <div className="v9-card v9-empty">
        <Settings size={40} style={{ opacity: 0.25 }} />
        <p style={{ fontSize: 15, fontWeight: 600, color: '#495057' }}>Раздел в разработке</p>
        <p style={{ fontSize: 13, color: '#6B778C' }}>Управление пользователями, роли и настройки платформы</p>
      </div>
    </div>
  );
}
