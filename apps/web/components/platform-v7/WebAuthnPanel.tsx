'use client';

import { useState } from 'react';

type KeyStatus = 'active' | 'revoked';

interface PasskeyDevice {
  id: string;
  name: string;
  type: 'platform' | 'roaming';
  platform: string;
  createdAt: string;
  lastUsed: string;
  status: KeyStatus;
}

const DEVICE_ICON: Record<PasskeyDevice['type'], string> = {
  platform: '💻',
  roaming:  '🔑',
};

const DEMO_KEYS: PasskeyDevice[] = [
  { id: 'wak-001', name: 'MacBook Pro (Touch ID)', type: 'platform', platform: 'macOS', createdAt: '2024-01-15', lastUsed: '2024-03-20', status: 'active' },
  { id: 'wak-002', name: 'iPhone 15 Pro',          type: 'platform', platform: 'iOS',   createdAt: '2024-02-01', lastUsed: '2024-03-19', status: 'active' },
  { id: 'wak-003', name: 'YubiKey 5 NFC',          type: 'roaming',  platform: 'FIDO2', createdAt: '2023-11-10', lastUsed: '2024-03-01', status: 'active' },
  { id: 'wak-004', name: 'Windows Hello',           type: 'platform', platform: 'Win11', createdAt: '2024-01-22', lastUsed: '2024-02-10', status: 'revoked'},
];

const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' };

export function WebAuthnPanel() {
  const [keys, setKeys] = useState<PasskeyDevice[]>(DEMO_KEYS);
  const [registering, setRegistering] = useState(false);
  const [newName, setNewName] = useState('');
  const [done, setDone] = useState(false);

  const active = keys.filter((k) => k.status === 'active').length;

  const revoke = (id: string) => {
    setKeys((prev) => prev.map((k) => k.id === id ? { ...k, status: 'revoked' as const } : k));
  };

  const register = () => {
    if (!newName.trim()) return;
    setRegistering(true);
    setTimeout(() => {
      const newKey: PasskeyDevice = {
        id: `wak-${Date.now()}`,
        name: newName.trim(),
        type: 'platform',
        platform: 'Browser',
        createdAt: new Date().toISOString().split('T')[0],
        lastUsed: new Date().toISOString().split('T')[0],
        status: 'active',
      };
      setKeys((prev) => [newKey, ...prev]);
      setRegistering(false);
      setNewName('');
      setDone(true);
      setTimeout(() => setDone(false), 3000);
    }, 2200);
  };

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 8 }}>
        {[
          { label: 'Ключей зарег.', value: keys.length, color: '#0F1419' },
          { label: 'Активных', value: active, color: active > 0 ? '#0A7A5F' : '#DC2626' },
          { label: 'Platform keys', value: keys.filter(k => k.type === 'platform' && k.status === 'active').length, color: '#0F1419' },
          { label: 'Roaming (HW)', value: keys.filter(k => k.type === 'roaming' && k.status === 'active').length, color: '#0F1419' },
        ].map((s) => (
          <div key={s.label} style={{ padding: '10px 12px', borderRadius: 10, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
            <div style={lbl}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: s.color, marginTop: 4 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Info block */}
      <div style={{ padding: '10px 14px', borderRadius: 10, background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#1E40AF', marginBottom: 4 }}>WebAuthn / FIDO2 — беспарольная аутентификация</div>
        <div style={{ fontSize: 10, color: '#3B82F6', lineHeight: 1.5 }}>
          Passkey хранится в защищённом чипе устройства (TPM / Secure Enclave). Никакой секрет не передаётся серверу — только публичный ключ. Поддерживаются: Touch ID, Face ID, Windows Hello, YubiKey 5 (FIDO2/NFC), TOTP — как резерв.
        </div>
      </div>

      {/* Register new */}
      <div style={{ padding: '12px 14px', borderRadius: 12, background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
        <div style={{ ...lbl, marginBottom: 8 }}>Зарегистрировать новый ключ</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Название устройства (напр. «MacBook Work»)"
            style={{ flex: 1, padding: '7px 10px', borderRadius: 8, border: '1px solid #BBF7D0', fontSize: 11, outline: 'none', background: '#fff' }}
          />
          <button
            onClick={register}
            disabled={registering || !newName.trim()}
            style={{ padding: '7px 14px', borderRadius: 8, background: registering ? '#94A3B8' : '#0A7A5F', color: '#fff', fontWeight: 700, fontSize: 11, border: 'none', cursor: registering ? 'wait' : 'pointer' }}
          >
            {registering ? 'Регистрация...' : 'Добавить'}
          </button>
        </div>
        {registering && (
          <div style={{ marginTop: 8, fontSize: 10, color: '#0A7A5F' }}>
            Подтвердите биометрию на устройстве... (симуляция WebAuthn create())
          </div>
        )}
        {done && (
          <div style={{ marginTop: 8, fontSize: 10, color: '#0A7A5F', fontWeight: 700 }}>✓ Ключ успешно зарегистрирован</div>
        )}
      </div>

      {/* Key list */}
      <div>
        <div style={{ ...lbl, marginBottom: 6 }}>Зарегистрированные ключи</div>
        <div style={{ display: 'grid', gap: 6 }}>
          {keys.map((k) => (
            <div key={k.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 12px', borderRadius: 10, background: k.status === 'revoked' ? '#F1F5F9' : '#fff', border: `1px solid ${k.status === 'revoked' ? '#CBD5E1' : '#E4E6EA'}`, opacity: k.status === 'revoked' ? 0.6 : 1 }}>
              <span style={{ fontSize: 20, flexShrink: 0 }}>{DEVICE_ICON[k.type]}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#0F1419' }}>{k.name}</div>
                <div style={{ fontSize: 9, color: '#94A3B8', marginTop: 1 }}>
                  {k.type === 'platform' ? 'Platform key' : 'Roaming key'} · {k.platform} · создан {k.createdAt} · последний вход {k.lastUsed}
                </div>
              </div>
              <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 999, background: k.status === 'active' ? '#D1FAE5' : '#F1F5F9', color: k.status === 'active' ? '#065F46' : '#64748B' }}>
                {k.status === 'active' ? 'Активен' : 'Отозван'}
              </span>
              {k.status === 'active' && (
                <button onClick={() => revoke(k.id)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #FECACA', background: '#FEF2F2', color: '#DC2626', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
                  Отозвать
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Supported authenticators */}
      <div>
        <div style={{ ...lbl, marginBottom: 6 }}>Поддерживаемые аутентификаторы</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 6 }}>
          {[
            { name: 'Touch ID / Face ID', note: 'iOS 16+, macOS 13+', ok: true },
            { name: 'Windows Hello',       note: 'Win 10/11, TPM 2.0',  ok: true },
            { name: 'YubiKey 5 (FIDO2)',   note: 'NFC / USB-A / USB-C', ok: true },
            { name: 'Android Fingerprint', note: 'Android 9+, FIDO2',   ok: true },
            { name: 'TOTP (резерв)',        note: 'RFC 6238, 30 сек',    ok: true },
            { name: 'SMS OTP (резерв)',     note: 'только РФ номера',    ok: true },
          ].map((a) => (
            <div key={a.name} style={{ padding: '8px 10px', borderRadius: 8, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 2 }}>
                <span style={{ color: '#0A7A5F', fontWeight: 900, fontSize: 11 }}>✓</span>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#0F1419' }}>{a.name}</div>
              </div>
              <div style={{ fontSize: 9, color: '#94A3B8' }}>{a.note}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ fontSize: 9, color: '#94A3B8', padding: '4px 8px', borderRadius: 6, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
        WebAuthn W3C Level 2 · FIDO2 · CTAP2 · Обязательна для: Admin / Compliance / Arbitrator · Корпоративным клиентам рекомендовано · Демо-данные.
      </div>
    </div>
  );
}
