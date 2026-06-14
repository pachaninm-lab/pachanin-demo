import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import RegisterPage from '@/app/platform-v7/register/page';
import LoginPage from '@/app/platform-v7/login/page';

const registerSrc = readFileSync(resolve(__dirname, '../../app/platform-v7/register/page.tsx'), 'utf8');
const loginSrc = readFileSync(resolve(__dirname, '../../app/platform-v7/login/page.tsx'), 'utf8');

describe('M3-1 product entry: register', () => {
  it('renders premium register with fields and application statuses', () => {
    render(<RegisterPage />);
    expect(screen.getByText('Регистрация участника')).toBeInTheDocument();
    expect(screen.getByText('ИНН')).toBeInTheDocument();
    expect(screen.getByText('ОГРН / ОГРНИП')).toBeInTheDocument();
    expect(screen.getByText('Заявка создана')).toBeInTheDocument();
    expect(screen.getByText('Ожидает проверки')).toBeInTheDocument();
    expect(screen.getByText('Допущен')).toBeInTheDocument();
    expect(screen.getByText('Отклонён')).toBeInTheDocument();
    expect(screen.getByText('Заблокирован')).toBeInTheDocument();
  });
});

describe('M3-1 product entry: login', () => {
  it('renders premium login with entry methods', () => {
    render(<LoginPage />);
    expect(screen.getByText('Вход в платформу')).toBeInTheDocument();
    expect(screen.getByText('Вход через ЕСИА')).toBeInTheDocument();
    expect(screen.getByText('Вход через СберБизнес ID')).toBeInTheDocument();
  });
});

describe('M3-1 product entry: honest UI copy (§4)', () => {
  it('keeps register/login free of demo/pilot/mock/sandbox user-facing words', () => {
    for (const src of [registerSrc, loginSrc]) {
      expect(src).not.toMatch(/демо/i);
      expect(src).not.toMatch(/пилот/i);
      expect(src).not.toMatch(/\bmock\b/i);
      expect(src).not.toMatch(/sandbox/i);
      expect(src).not.toMatch(/тестовый режим/i);
      expect(src).not.toMatch(/production-ready/i);
      expect(src).not.toMatch(/fully live/i);
    }
  });
});
