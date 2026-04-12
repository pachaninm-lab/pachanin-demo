'use client';
import * as React from 'react';
import { Shield } from 'lucide-react';

export default function CompliancePage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0F1419', margin: 0 }}>Комплаенс</h1>
      <p style={{ fontSize: 13, color: '#6B778C' }}>Аудит-лог, верификация документов и регуляторная отчётность</p>
      <div className="v9-card v9-empty">
        <Shield size={40} style={{ opacity: 0.25 }} />
        <p style={{ fontSize: 15, fontWeight: 600, color: '#495057' }}>Раздел в разработке</p>
        <p style={{ fontSize: 13, color: '#6B778C' }}>Будет доступен в спринте 8 согласно плану §8 ТЗ v9.1</p>
      </div>
    </div>
  );
}
