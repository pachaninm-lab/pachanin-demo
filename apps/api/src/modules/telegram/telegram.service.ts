import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import * as https from 'https';
import * as http from 'http';

@Injectable()
export class TelegramService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(TelegramService.name);
  private readonly token = process.env.TELEGRAM_BOT_TOKEN;
  private polling = false;
  private offset = 0;
  private readonly registeredChats = new Set<number>();

  onApplicationBootstrap() {
    if (!this.token) {
      this.logger.warn('TELEGRAM_BOT_TOKEN not set — Telegram notifications disabled');
      return;
    }
    this.logger.log('Telegram bot started (long polling)');
    this.polling = true;
    void this.poll();
  }

  onApplicationShutdown() {
    this.polling = false;
  }

  async sendMessage(chatId: string | number, text: string): Promise<void> {
    if (!this.token) return;
    try {
      await this.callApi('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML' });
    } catch (err) {
      this.logger.error(`Failed to send Telegram message to ${chatId}: ${err}`);
    }
  }

  async broadcast(text: string): Promise<void> {
    for (const chatId of this.registeredChats) {
      await this.sendMessage(chatId, text);
    }
  }

  handleUpdate(update: any): void {
    const msg = update?.message;
    if (!msg?.text) return;
    const chatId: number = msg.chat.id;
    const raw = (msg.text as string).trim();
    const [cmd, ...argParts] = raw.split(/\s+/);
    const arg = argParts.join(' ').toLowerCase();

    switch (cmd) {
      case '/start':   return void this.cmdStart(chatId);
      case '/help':    return void this.cmdHelp(chatId);
      case '/id':      return void this.cmdId(chatId);
      case '/about':   return void this.cmdAbout(chatId);
      case '/status':  return void this.cmdStatus(chatId);
      case '/ping':    return void this.cmdPing(chatId);
      case '/demo':    return void this.cmdDemo(chatId, arg);
      case '/features':return void this.cmdFeatures(chatId);
      case '/roadmap': return void this.cmdRoadmap(chatId);
      default:
        void this.sendMessage(chatId,
          `Не понимаю команду <code>${cmd}</code>.\n\nНапишите /help — список всех команд.`);
    }
  }

  // ── команды ────────────────────────────────────────────────

  private async cmdStart(chatId: number) {
    this.registeredChats.add(chatId);
    await this.sendMessage(chatId,
      `👋 Добро пожаловать в <b>Прозрачная Цена</b>!\n\n` +
      `Это бот платформы для прозрачной торговли зерном.\n\n` +
      `✅ Вы зарегистрированы — будете получать уведомления о сделках, лотах и документах.\n\n` +
      `Ваш Chat ID: <code>${chatId}</code>\n\n` +
      `Напишите /help — список всех команд.`
    );
  }

  private async cmdHelp(chatId: number) {
    await this.sendMessage(chatId,
      `<b>Все команды:</b>\n\n` +
      `<b>Основные</b>\n` +
      `/start — регистрация и приветствие\n` +
      `/help — этот список\n` +
      `/id — ваш Chat ID\n` +
      `/about — о платформе\n\n` +
      `<b>Мониторинг</b>\n` +
      `/status — статус всех сервисов\n` +
      `/ping — проверить скорость ответа API\n\n` +
      `<b>Демо</b>\n` +
      `/demo — запустить все демо-события\n` +
      `/demo deal — новая сделка\n` +
      `/demo lot — новый лот\n` +
      `/demo dispute — спор по сделке\n` +
      `/demo payment — платёж\n` +
      `/demo doc — новый документ\n\n` +
      `<b>Платформа</b>\n` +
      `/features — возможности платформы\n` +
      `/roadmap — что в планах`
    );
  }

  private async cmdId(chatId: number) {
    this.registeredChats.add(chatId);
    await this.sendMessage(chatId, `Ваш Chat ID: <code>${chatId}</code>`);
  }

  private async cmdAbout(chatId: number) {
    await this.sendMessage(chatId,
      `<b>Прозрачная Цена</b> — платформа для прозрачной торговли зерном.\n\n` +
      `<b>Для кого:</b>\n` +
      `• Продавцы зерна (фермеры, агрохолдинги)\n` +
      `• Покупатели зерна (трейдеры, переработчики)\n` +
      `• Банки (контроль расчётов)\n` +
      `• Логисты (отслеживание поставок)\n\n` +
      `<b>Что делает:</b>\n` +
      `Сводит стороны сделки, контролирует документы, расчёты и логистику в одном месте.\n\n` +
      `<b>Статус:</b> разработка 🚧`
    );
  }

  private async cmdStatus(chatId: number) {
    const start = Date.now();
    const apiOk = await this.pingApi();
    const ms = Date.now() - start;
    await this.sendMessage(chatId,
      `<b>Статус платформы</b>\n\n` +
      `API: ${apiOk ? '✅ работает' : '❌ недоступен'} ${apiOk ? `(${ms}мс)` : ''}\n` +
      `Telegram бот: ✅ работает\n` +
      `Режим: 🔧 разработка\n\n` +
      `Зарегистрировано чатов: ${this.registeredChats.size}`
    );
  }

  private async cmdPing(chatId: number) {
    const start = Date.now();
    const ok = await this.pingApi();
    const ms = Date.now() - start;
    if (ok) {
      await this.sendMessage(chatId, `🏓 Понг! API отвечает за <b>${ms}мс</b>`);
    } else {
      await this.sendMessage(chatId, `❌ API не отвечает`);
    }
  }

  private async cmdDemo(chatId: number, arg: string) {
    const all = !arg || arg === 'all';

    if (all || arg === 'deal') {
      await this.sendMessage(chatId,
        `🤝 <b>DEAL · Новая сделка</b>\n\n` +
        `Сделка <code>DL-9102</code> создана\n` +
        `Продавец: ООО Агро-Юг\n` +
        `Покупатель: ТД Зернотрейд\n` +
        `Культура: Пшеница 3 класс\n` +
        `Объём: 500 т · Цена: 18 500 ₽/т\n` +
        `Сумма: <b>9 250 000 ₽</b>\n` +
        `Статус: DRAFT → ожидает подтверждения`
      );
    }

    if (all || arg === 'lot') {
      await this.sendMessage(chatId,
        `📦 <b>LOT · Новый лот</b>\n\n` +
        `Лот <code>LT-0441</code> опубликован\n` +
        `Продавец: КФХ Иванов\n` +
        `Культура: Ячмень кормовой\n` +
        `Объём: 200 т\n` +
        `Цена: 14 200 ₽/т\n` +
        `Базис: EXW Краснодарский край\n` +
        `Действует до: 28.05.2026`
      );
    }

    if (all || arg === 'dispute') {
      await this.sendMessage(chatId,
        `⚖️ <b>DISPUTE · Открыт спор</b>\n\n` +
        `Спор <code>DS-0088</code> по сделке <code>DL-8901</code>\n` +
        `Инициатор: Покупатель\n` +
        `Причина: Несоответствие качества зерна\n` +
        `Заявленный ущерб: 320 000 ₽\n` +
        `Статус: ожидает рассмотрения ⏳`
      );
    }

    if (all || arg === 'payment') {
      await this.sendMessage(chatId,
        `💳 <b>PAYMENT · Платёж</b>\n\n` +
        `Платёж по сделке <code>DL-9102</code>\n` +
        `Сумма: <b>9 250 000 ₽</b>\n` +
        `Тип: Авансовый платёж (50%)\n` +
        `Банк: СберБизнес\n` +
        `Статус: CONFIRMED ✅`
      );
    }

    if (all || arg === 'doc') {
      await this.sendMessage(chatId,
        `📄 <b>DOCUMENT · Новый документ</b>\n\n` +
        `Документ по сделке <code>DL-9102</code>\n` +
        `Тип: Товарно-транспортная накладная\n` +
        `Номер: ТТН-2026-04412\n` +
        `Загружен: ООО Агро-Юг\n` +
        `Статус: ожидает подписания ✍️`
      );
    }

    if (arg && !['deal', 'lot', 'dispute', 'payment', 'doc', 'all'].includes(arg)) {
      await this.sendMessage(chatId,
        `Неизвестный тип демо: <code>${arg}</code>\n\n` +
        `Доступные: deal, lot, dispute, payment, doc\n` +
        `Или просто /demo — запустить все сразу`
      );
    }
  }

  private async cmdFeatures(chatId: number) {
    await this.sendMessage(chatId,
      `<b>Возможности платформы:</b>\n\n` +
      `📦 <b>Лоты</b> — публикация и поиск предложений на зерно\n` +
      `🤝 <b>Сделки</b> — заключение и ведение сделок\n` +
      `💳 <b>Расчёты</b> — безопасные платежи через банк\n` +
      `📄 <b>Документы</b> — ЭДО, накладные, договоры\n` +
      `🚛 <b>Логистика</b> — отслеживание поставок и GPS\n` +
      `🧪 <b>Лаборатория</b> — анализ качества зерна\n` +
      `⚖️ <b>Споры</b> — разбор конфликтов между сторонами\n` +
      `🏦 <b>Банк</b> — интеграция со СберБизнес\n` +
      `📊 <b>Аналитика</b> — отчёты и мониторинг`
    );
  }

  private async cmdRoadmap(chatId: number) {
    await this.sendMessage(chatId,
      `<b>Что в планах:</b>\n\n` +
      `✅ Telegram-уведомления (готово)\n` +
      `🔜 Мобильное приложение\n` +
      `🔜 Привязка аккаунта платформы к Telegram\n` +
      `🔜 Управление сделками через бота\n` +
      `🔜 Интеграция с ФГИС Зерно\n` +
      `🔜 Онлайн-торги в реальном времени\n` +
      `🔜 Электронная цифровая подпись\n` +
      `🔜 Мультиязычность (EN, KZ, UA)`
    );
  }

  // ── вспомогательные ────────────────────────────────────────

  private pingApi(): Promise<boolean> {
    return new Promise((resolve) => {
      const req = http.get('http://localhost:4000/health', (res) => {
        resolve(res.statusCode === 200);
      });
      req.on('error', () => resolve(false));
      req.setTimeout(3000, () => { req.destroy(); resolve(false); });
    });
  }

  private async poll(): Promise<void> {
    while (this.polling) {
      try {
        const result = await this.callApi('getUpdates', {
          offset: this.offset,
          timeout: 30,
          allowed_updates: ['message'],
        }) as { ok: boolean; result: any[] };

        if (result.ok && result.result.length > 0) {
          for (const update of result.result) {
            this.handleUpdate(update);
            this.offset = update.update_id + 1;
          }
        }
      } catch (err) {
        if (this.polling) {
          this.logger.error(`Polling error: ${err}`);
          await this.sleep(5000);
        }
      }
    }
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private callApi(method: string, params: Record<string, unknown>): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const body = JSON.stringify(params);
      const req = https.request(
        {
          hostname: 'api.telegram.org',
          path: `/bot${this.token}/${method}`,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
          },
          timeout: 35000,
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => {
            try { resolve(JSON.parse(data)); } catch { resolve(data); }
          });
        },
      );
      req.on('error', reject);
      req.on('timeout', () => req.destroy(new Error('Request timeout')));
      req.write(body);
      req.end();
    });
  }
}
