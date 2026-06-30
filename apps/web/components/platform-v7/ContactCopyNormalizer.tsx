'use client';

import { useEffect } from 'react';

const cardCopy = [
  ['Без входа в кабинет', 'Форма доступна без авторизации и выбора роли участника.'],
  ['Без доступа к рабочим данным', 'Отправка обращения не открывает сделки, документы и закрытые разделы платформы.'],
  ['Ответ по указанному контакту', 'Контакт используется только для рассмотрения обращения и направления ответа.'],
] as const;

function text(selector: string, value: string) {
  const node = document.querySelector<HTMLElement>(selector);
  if (node) node.textContent = value;
}

function applyCopy() {
  document.title = 'Обращение по платформе — Прозрачная Цена';
  text('.p7-contact-kicker', 'Официальный канал обращения');
  text('.p7-contact-copy h1', 'Обращение по платформе');
  text('.p7-contact-copy > p', 'Используйте форму для вопросов о демонстрационном доступе, пилотном проекте, подключении организации, банковском взаимодействии, региональном запуске или техническом подключении.');
  document.querySelectorAll<HTMLElement>('.p7-contact-info-card').forEach((card, index) => {
    const copy = cardCopy[index];
    if (!copy) return;
    const title = card.querySelector<HTMLElement>('strong');
    const body = card.querySelector<HTMLElement>('p');
    if (title) title.textContent = copy[0];
    if (body) body.textContent = copy[1];
  });
  text('.p7-contact-form h2', 'Форма обращения');
  text('.p7-contact-form > p', 'Заполните обязательные поля. Не указывайте пароли, ключи доступа, банковские реквизиты и копии документов.');
  const labels = Array.from(document.querySelectorAll<HTMLElement>('.p7-contact-form label > span'));
  ['Тема обращения', 'Имя', 'Организация', 'Телефон или электронная почта', 'Содержание обращения'].forEach((value, index) => {
    if (labels[index]) labels[index].textContent = value;
  });
  const options: Record<string, string> = {
    platform: 'Общий вопрос по платформе',
    pilot: 'Пилотный проект',
    bank_partner: 'Банк или партнёр',
    region: 'Региональный запуск',
    technical: 'Техническое подключение',
    other: 'Другое обращение',
  };
  document.querySelectorAll<HTMLOptionElement>('.p7-contact-form option').forEach((option) => {
    const value = options[option.value];
    if (value) option.textContent = value;
  });
  const message = document.querySelector<HTMLTextAreaElement>('.p7-contact-form textarea[name="message"]');
  if (message) message.placeholder = 'Кратко опишите вопрос, параметры пилотного проекта, роль организации или требуемый формат взаимодействия.';
  text('.p7-contact-consent span', 'Даю согласие на обработку указанных данных для рассмотрения обращения и направления ответа.');
  const button = document.querySelector<HTMLButtonElement>('.p7-contact-form button');
  if (button?.firstChild) button.firstChild.textContent = 'Отправить обращение';
  text('.p7-contact-success h2', 'Обращение принято');
  text('.p7-contact-success p', 'Ответ будет направлен по указанному телефону или адресу электронной почты после рассмотрения обращения.');
}

export function ContactCopyNormalizer() {
  useEffect(() => {
    applyCopy();
    const timer = window.setTimeout(applyCopy, 120);
    return () => window.clearTimeout(timer);
  }, []);

  return null;
}
