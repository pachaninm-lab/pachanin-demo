import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import * as https from 'https';
import * as http from 'http';

type PlatformRole =
  | 'FARMER' | 'BUYER' | 'LOGISTICIAN' | 'DRIVER'
  | 'ACCOUNTING' | 'BANK' | 'SUPPORT_MANAGER'
  | 'LAB' | 'ELEVATOR' | 'EXECUTIVE' | 'ADMIN';

interface UserSettings {
  chatId: number;
  firstName?: string;
  username?: string;
  approved: boolean;
  pending: boolean;
  role?: PlatformRole;
  linkedUserId?: string;
  muted: boolean;
  mutedTypes: Set<string>;
  dailyReport: boolean;
  weeklyReport: boolean;
  banned: boolean;
  referralCode: string;
  joinedAt: string;
  priceAlerts: Map<string, number>;
  blacklist: string[];
  supportMode: boolean;
  lang: 'ru';
}

const ROLE_LABELS: Record<PlatformRole, string> = {
  FARMER:          'Фермер / Продавец',
  BUYER:           'Покупатель',
  LOGISTICIAN:     'Логист',
  DRIVER:          'Водитель',
  ACCOUNTING:      'Бухгалтер',
  BANK:            'Банк',
  SUPPORT_MANAGER: 'Менеджер поддержки',
  LAB:             'Лаборатория',
  ELEVATOR:        'Элеватор',
  EXECUTIVE:       'Руководитель',
  ADMIN:           'Администратор',
};

// Команды доступные каждой роли
const ROLE_COMMANDS: Record<PlatformRole, string[]> = {
  FARMER: [
    '/lots', '/lot', '/deals', '/deal',
    '/docs', '/shipments', '/shipment', '/track',
    '/price', '/prices', '/chart', '/alert', '/alerts',
    '/calculator', '/support', '/faq',
    '/mute', '/unmute', '/settings', '/report', '/remind', '/reminders',
  ],
  BUYER: [
    '/search', '/lots', '/lot', '/deals', '/deal',
    '/docs', '/payments', '/balance', '/disputes', '/dispute',
    '/price', '/prices', '/chart', '/alert', '/alerts',
    '/calculator', '/support', '/faq',
    '/mute', '/unmute', '/settings', '/report', '/remind', '/reminders',
  ],
  LOGISTICIAN: [
    '/shipments', '/shipment', '/track', '/deals', '/deal',
    '/support', '/faq', '/settings', '/mute', '/unmute',
  ],
  DRIVER: [
    '/shipments', '/shipment', '/track',
    '/support', '/faq', '/settings',
  ],
  ACCOUNTING: [
    '/payments', '/balance', '/export', '/deals', '/deal',
    '/support', '/faq', '/settings', '/mute', '/unmute',
  ],
  BANK: [
    '/payments', '/balance', '/deals', '/deal',
    '/support', '/faq', '/settings',
  ],
  SUPPORT_MANAGER: [
    '/disputes', '/dispute', '/deals', '/deal',
    '/lots', '/lot', '/docs', '/shipments', '/shipment',
    '/support', '/faq', '/settings', '/mute', '/unmute',
  ],
  LAB: [
    '/deals', '/deal', '/docs',
    '/support', '/faq', '/settings',
  ],
  ELEVATOR: [
    '/shipments', '/shipment', '/track',
    '/support', '/faq', '/settings',
  ],
  EXECUTIVE: [
    '/deals', '/deal', '/lots', '/lot',
    '/payments', '/balance', '/export',
    '/price', '/prices', '/chart',
    '/support', '/faq', '/settings', '/mute', '/unmute',
  ],
  ADMIN: [], // проверяется отдельно — всё разрешено
};

interface ReminderEntry {
  id: string;
  chatId: number;
  text: string;
  fireAt: number;
  timer: ReturnType<typeof setTimeout>;
}

const ADMIN_CHAT_ID = Number(process.env.TELEGRAM_ADMIN_CHAT_ID || 0);
const START_TIME = Date.now();

const PRICES: Record<string, { price: number; trend: string; region: string }> = {
  пшеница:      { price: 18500, trend: '↑', region: 'Юг России' },
  ячмень:       { price: 14200, trend: '→', region: 'ЦФО' },
  кукуруза:     { price: 16800, trend: '↑', region: 'Краснодар' },
  подсолнечник: { price: 42000, trend: '↓', region: 'Поволжье' },
  соя:          { price: 38500, trend: '→', region: 'ДФО' },
  рапс:         { price: 36000, trend: '↑', region: 'ЦФО' },
  рожь:         { price: 12500, trend: '→', region: 'Поволжье' },
  горох:        { price: 22000, trend: '↓', region: 'Сибирь' },
};

const FAQ_LIST = [
  { q: 'Как зарегистрироваться?', a: 'Перейдите на сайт платформы и нажмите "Регистрация". После email-подтверждения привяжите аккаунт командой /link <код>.' },
  { q: 'Как создать лот?', a: 'В личном кабинете: Лоты → Создать лот. Укажите культуру, объём, цену и базис поставки.' },
  { q: 'Как работает оплата?', a: 'Деньги резервируются банком-эскроу и переходят продавцу после подтверждения качества и доставки.' },
  { q: 'Что делать при споре?', a: 'Используйте /dispute open <ID>. Менеджер рассмотрит в течение 48 часов.' },
  { q: 'Как привязать Telegram к аккаунту?', a: 'Введите /id, скопируйте Chat ID и вставьте в настройках профиля на сайте.' },
  { q: 'Какие культуры торгуются?', a: 'Пшеница, ячмень, кукуруза, подсолнечник, соя, рапс, рожь, горох и другие.' },
  { q: 'Есть ли мобильное приложение?', a: 'В разработке. Пока доступен веб-сайт и этот Telegram-бот.' },
  { q: 'Как связаться с поддержкой?', a: 'Напишите /support Ваш вопрос — мы ответим в течение 2 часов.' },
];

@Injectable()
export class TelegramService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(TelegramService.name);
  private readonly token = process.env.TELEGRAM_BOT_TOKEN;
  private polling = false;
  private offset = 0;
  private readonly users = new Map<number, UserSettings>();
  private readonly reminders: ReminderEntry[] = [];
  private schedulerInterval?: ReturnType<typeof setInterval>;
  private uptimeInterval?: ReturnType<typeof setInterval>;
  private lastApiStatus = true;

  onApplicationBootstrap() {
    if (!this.token) {
      this.logger.warn('TELEGRAM_BOT_TOKEN not set — Telegram notifications disabled');
      return;
    }
    this.logger.log('Telegram bot started (long polling)');
    this.polling = true;
    void this.poll();
    this.startScheduler();
    this.startUptimeMonitor();
  }

  onApplicationShutdown() {
    this.polling = false;
    if (this.schedulerInterval) clearInterval(this.schedulerInterval);
    if (this.uptimeInterval) clearInterval(this.uptimeInterval);
    this.reminders.forEach(r => clearTimeout(r.timer));
  }

  // ── публичные методы ────────────────────────────────────────

  async sendMessage(chatId: string | number, text: string, extra?: Record<string, unknown>): Promise<void> {
    if (!this.token) return;
    try {
      await this.callApi('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', ...extra });
    } catch (err) {
      this.logger.error(`sendMessage to ${chatId} failed: ${err}`);
    }
  }

  async broadcast(text: string, type?: string): Promise<void> {
    for (const [chatId, settings] of this.users) {
      if (settings.banned || settings.muted) continue;
      if (type && settings.mutedTypes.has(type)) continue;
      await this.sendMessage(chatId, text);
    }
  }

  handleUpdate(update: any): void {
    if (update?.message) this.handleMessage(update.message);
    if (update?.callback_query) void this.handleCallback(update.callback_query);
  }

  // ── роутер сообщений ────────────────────────────────────────

  private handleMessage(msg: any): void {
    const chatId: number = msg.chat.id;
    const user = this.getOrCreateUser(chatId, msg.from);
    if (user.banned) return;

    if (!msg.text) return;
    const [rawCmd, ...argParts] = msg.text.trim().split(/\s+/);
    const cmd = rawCmd.toLowerCase();
    const arg = argParts.join(' ');

    // /start доступен всем — отправляет запрос на одобрение
    if (cmd === '/start') return void this.cmdStart(chatId, msg.from);

    // неодобренные пользователи не получают доступ к командам
    if (!user.approved) {
      if (user.pending) {
        return void this.sendMessage(chatId, `⏳ Ваш запрос на доступ уже отправлен. Ожидайте одобрения администратора.`);
      }
      return void this.sendMessage(chatId, `⛔️ Для доступа к боту напишите /start`);
    }

    // одобрен, но не привязал аккаунт — только базовые команды
    const freeCommands = ['/help', '/about', '/link', '/status', '/ping', '/id', '/support', '/faq'];
    if (!user.linkedUserId && !freeCommands.includes(cmd) && chatId !== ADMIN_CHAT_ID) {
      return void this.sendMessage(chatId,
        `🔗 Для доступа к командам привяжите аккаунт платформы:\n\n<code>/link ВАШ-КОД</code>\n\nКод находится в личном кабинете → Настройки → Telegram.`
      );
    }

    // проверка роли — админ бота и ADMIN роль получают всё
    if (user.linkedUserId && user.role && chatId !== ADMIN_CHAT_ID && user.role !== 'ADMIN') {
      const allowed = ROLE_COMMANDS[user.role] || [];
      if (!allowed.includes(cmd)) {
        return void this.sendMessage(chatId,
          `⛔️ Команда <code>${cmd}</code> недоступна для роли <b>${ROLE_LABELS[user.role]}</b>.\n\n/help — ваши команды`
        );
      }
    }

    // режим поддержки — пересылаем в админ
    if (user.supportMode && !msg.text.startsWith('/')) {
      void this.forwardToAdmin(chatId, msg.text, msg.from);
      void this.sendMessage(chatId, '✅ Сообщение отправлено в поддержку. Ответим в течение 2 часов.');
      user.supportMode = false;
      return;
    }

    switch (cmd) {
      case '/start':      return void this.cmdStart(chatId, msg.from);
      case '/help':       return void this.cmdHelp(chatId);
      case '/menu':       return void this.cmdMenu(chatId);
      case '/id':         return void this.cmdId(chatId);
      case '/about':      return void this.cmdAbout(chatId);
      case '/profile':    return void this.cmdProfile(chatId);
      case '/link':       return void this.cmdLink(chatId, arg);
      case '/unlink':     return void this.cmdUnlink(chatId);
      case '/status':     return void this.cmdStatus(chatId);
      case '/ping':       return void this.cmdPing(chatId);
      case '/health':     return void this.cmdHealth(chatId);
      case '/uptime':     return void this.cmdUptime(chatId);
      case '/deals':      return void this.cmdDeals(chatId);
      case '/deal':       return void this.cmdDeal(chatId, arg);
      case '/lots':       return void this.cmdLots(chatId);
      case '/lot':        return void this.cmdLot(chatId, arg);
      case '/search':     return void this.cmdSearch(chatId, arg);
      case '/docs':       return void this.cmdDocs(chatId, arg);
      case '/payments':   return void this.cmdPayments(chatId, arg);
      case '/balance':    return void this.cmdBalance(chatId);
      case '/disputes':   return void this.cmdDisputes(chatId);
      case '/dispute':    return void this.cmdDispute(chatId, arg);
      case '/shipments':  return void this.cmdShipments(chatId);
      case '/shipment':   return void this.cmdShipment(chatId, arg);
      case '/track':      return void this.cmdTrack(chatId, arg);
      case '/price':      return void this.cmdPrice(chatId, arg);
      case '/prices':     return void this.cmdPrices(chatId);
      case '/alert':      return void this.cmdAlert(chatId, arg);
      case '/alerts':     return void this.cmdAlerts(chatId);
      case '/chart':      return void this.cmdChart(chatId, arg);
      case '/mute':       return void this.cmdMute(chatId, arg);
      case '/unmute':     return void this.cmdUnmute(chatId);
      case '/settings':   return void this.cmdSettings(chatId);
      case '/report':     return void this.cmdReport(chatId, arg);
      case '/export':     return void this.cmdExport(chatId, arg);
      case '/remind':     return void this.cmdRemind(chatId, arg);
      case '/reminders':  return void this.cmdReminders(chatId);
      case '/approve':    return void this.cmdApprove(chatId, arg);
      case '/reject':     return void this.cmdReject(chatId, arg);
      case '/pending':    return void this.cmdPending(chatId);
      case '/broadcast':  return void this.cmdBroadcast(chatId, arg);
      case '/stats':      return void this.cmdStats(chatId);
      case '/users':      return void this.cmdUsers(chatId);
      case '/ban':        return void this.cmdBan(chatId, arg);
      case '/unban':      return void this.cmdUnban(chatId, arg);
      case '/support':    return void this.cmdSupport(chatId, arg);
      case '/faq':        return void this.cmdFaq(chatId, arg);
      case '/feedback':   return void this.cmdFeedback(chatId, arg);
      case '/features':   return void this.cmdFeatures(chatId);
      case '/roadmap':    return void this.cmdRoadmap(chatId);
      case '/news':       return void this.cmdNews(chatId);
      case '/weather':    return void this.cmdWeather(chatId, arg);
      case '/currency':   return void this.cmdCurrency(chatId);
      case '/calculator': return void this.cmdCalculator(chatId, arg);
      case '/invite':     return void this.cmdInvite(chatId);
      case '/rating':     return void this.cmdRating(chatId, arg);
      case '/blacklist':  return void this.cmdBlacklist(chatId, arg);
      case '/demo':       return void this.cmdDemo(chatId, arg.toLowerCase());
      default:
        void this.sendMessage(chatId,
          `Не понимаю <code>${rawCmd}</code>.\n\nНапишите /help или /menu.`);
    }
  }

  private async handleCallback(query: any): Promise<void> {
    const chatId: number = query.message.chat.id;
    const data: string = query.data;
    await this.callApi('answerCallbackQuery', { callback_query_id: query.id });

    if (data.startsWith('setrole:')) {
      const [, targetId, role] = data.split(':');
      const u = this.users.get(Number(targetId));
      if (u) {
        u.role = role as PlatformRole;
        const label = ROLE_LABELS[role as PlatformRole];
        await this.sendMessage(Number(targetId),
          `✅ <b>Роль подтверждена: ${label}</b>\n\n` +
          `Теперь у вас есть доступ к функциям платформы.\n\n/help — ваши команды`,
          { reply_markup: this.mainMenuKeyboard() }
        );
        return void this.sendMessage(chatId, `✅ Роль <b>${label}</b> назначена пользователю ${targetId}.`);
      }
      return void this.sendMessage(chatId, `Пользователь не найден.`);
    }

    if (data.startsWith('approve:')) {
      const targetId = Number(data.slice(8));
      const u = this.users.get(targetId);
      if (u) {
        u.approved = true;
        u.pending = false;
        const name = u.firstName || String(targetId);
        await this.sendMessage(targetId,
          `✅ <b>Доступ одобрен!</b>\n\nДобро пожаловать в <b>Прозрачная Цена</b>.\n\nИспользуйте /menu или /help.`,
          { reply_markup: this.mainMenuKeyboard() }
        );
        return void this.sendMessage(chatId, `✅ Пользователь <b>${name}</b> одобрен.`);
      }
      return void this.sendMessage(chatId, `Пользователь не найден.`);
    }

    if (data.startsWith('reject:')) {
      const targetId = Number(data.slice(7));
      const u = this.users.get(targetId);
      if (u) {
        u.pending = false;
        const name = u.firstName || String(targetId);
        await this.sendMessage(targetId,
          `❌ Ваш запрос на доступ отклонён.\n\nЕсли считаете это ошибкой — свяжитесь с администратором.`
        );
        return void this.sendMessage(chatId, `❌ Пользователь <b>${name}</b> отклонён.`);
      }
      return void this.sendMessage(chatId, `Пользователь не найден.`);
    }

    if (data.startsWith('demo:')) return void this.cmdDemo(chatId, data.slice(5));
    if (data === 'menu:prices') return void this.cmdPrices(chatId);
    if (data === 'menu:status') return void this.cmdStatus(chatId);
    if (data === 'menu:deals') return void this.cmdDeals(chatId);
    if (data === 'menu:lots') return void this.cmdLots(chatId);
    if (data === 'menu:help') return void this.cmdHelp(chatId);
    if (data === 'menu:settings') return void this.cmdSettings(chatId);
    if (data === 'settings:mute') return void this.cmdMute(chatId, '');
    if (data === 'settings:unmute') return void this.cmdUnmute(chatId);
    if (data === 'settings:daily_on') {
      this.getOrCreateUser(chatId).dailyReport = true;
      return void this.sendMessage(chatId, '✅ Ежедневный отчёт в 9:00 включён.');
    }
    if (data === 'settings:daily_off') {
      this.getOrCreateUser(chatId).dailyReport = false;
      return void this.sendMessage(chatId, '🔕 Ежедневный отчёт отключён.');
    }
  }

  // ── команды: основные ───────────────────────────────────────

  private async cmdStart(chatId: number, from: any) {
    const user = this.getOrCreateUser(chatId, from);
    const name = from?.first_name || 'Пользователь';

    // админ всегда одобрен
    if (chatId === ADMIN_CHAT_ID) {
      user.approved = true;
      return void this.sendMessage(chatId,
        `👋 Привет, <b>${name}</b>! Вы администратор.\n\n` +
        `Используйте /menu или /help.`,
        { reply_markup: this.mainMenuKeyboard() }
      );
    }

    // уже одобрен
    if (user.approved) {
      return void this.sendMessage(chatId,
        `👋 Привет, <b>${name}</b>!\n\nВы уже авторизованы.\n\nИспользуйте /menu или /help.`,
        { reply_markup: this.mainMenuKeyboard() }
      );
    }

    // запрос уже отправлен
    if (user.pending) {
      return void this.sendMessage(chatId,
        `⏳ Ваш запрос на доступ уже отправлен.\nОжидайте одобрения администратора.`
      );
    }

    // новый запрос
    user.pending = true;
    const username = from?.username ? `@${from.username}` : '—';
    await this.sendMessage(chatId,
      `👋 Привет, <b>${name}</b>!\n\n` +
      `Это закрытый бот платформы <b>Прозрачная Цена</b>.\n\n` +
      `⏳ Ваш запрос на доступ отправлен администратору.\nМы сообщим когда вас одобрят.`
    );

    // уведомляем админа
    if (ADMIN_CHAT_ID) {
      await this.sendMessage(ADMIN_CHAT_ID,
        `🔔 <b>Новый запрос на доступ</b>\n\n` +
        `Имя: <b>${name}</b>\n` +
        `Username: ${username}\n` +
        `Chat ID: <code>${chatId}</code>`,
        {
          reply_markup: {
            inline_keyboard: [[
              { text: '✅ Одобрить', callback_data: `approve:${chatId}` },
              { text: '❌ Отклонить', callback_data: `reject:${chatId}` },
            ]],
          },
        }
      );
    }
  }

  private async cmdHelp(chatId: number) {
    const user = this.getOrCreateUser(chatId);

    // не привязан — только базовые команды
    if (!user.linkedUserId && chatId !== ADMIN_CHAT_ID) {
      return void this.sendMessage(chatId,
        `<b>Доступные команды:</b>\n\n` +
        `/link &lt;код&gt; — привязать аккаунт платформы\n` +
        `/about — о платформе\n` +
        `/status — статус сервиса\n` +
        `/support — написать в поддержку\n` +
        `/faq — частые вопросы\n\n` +
        `Для полного доступа привяжите аккаунт:\n<code>/link ВАШ-КОД</code>`
      );
    }

    // админ видит всё
    if (chatId === ADMIN_CHAT_ID || user.role === 'ADMIN') {
      return void this.sendMessage(chatId,
        `<b>Все команды (Администратор):</b>\n\n` +
        `<b>Пользователи</b>\n/pending /approve /reject /users /ban /unban\n\n` +
        `<b>Сделки и лоты</b>\n/deals /deal /lots /lot /search /docs /payments /balance\n` +
        `/disputes /dispute /shipments /shipment /track\n\n` +
        `<b>Цены</b>\n/prices /price /chart /alert /alerts\n\n` +
        `<b>Инструменты</b>\n/calculator /export /stats /broadcast\n\n` +
        `<b>Прочее</b>\n/weather /currency /news /demo /settings /support /faq`
      );
    }

    // команды по роли
    const role = user.role;
    if (!role) {
      return void this.sendMessage(chatId,
        `Аккаунт привязан, ожидайте подтверждения роли администратором.`
      );
    }
    const cmds = ROLE_COMMANDS[role].join(' ');
    await this.sendMessage(chatId,
      `<b>Ваши команды</b> (${ROLE_LABELS[role]}):\n\n${cmds}\n\n` +
      `/about — о платформе\n/status — статус\n/profile — профиль`
    );
  }

  private async cmdMenu(chatId: number) {
    await this.sendMessage(chatId, '📋 <b>Главное меню:</b>', { reply_markup: this.mainMenuKeyboard() });
  }

  private async cmdId(chatId: number) {
    this.getOrCreateUser(chatId);
    await this.sendMessage(chatId, `Ваш Chat ID: <code>${chatId}</code>`);
  }

  private async cmdAbout(chatId: number) {
    await this.sendMessage(chatId,
      `<b>Прозрачная Цена</b>\n\n` +
      `Платформа для прозрачной торговли зерном между фермерами, трейдерами и переработчиками.\n\n` +
      `<b>Участники:</b>\n` +
      `• Продавцы — фермеры, агрохолдинги\n` +
      `• Покупатели — трейдеры, переработчики\n` +
      `• Банки — контроль расчётов\n` +
      `• Логисты — отслеживание поставок\n\n` +
      `<b>Статус:</b> 🚧 Разработка\n` +
      `<b>Версия:</b> demo\n\n` +
      `/features — подробнее о возможностях`
    );
  }

  private async cmdProfile(chatId: number) {
    const u = this.getOrCreateUser(chatId);
    await this.sendMessage(chatId,
      `<b>Ваш профиль:</b>\n\n` +
      `Chat ID: <code>${chatId}</code>\n` +
      `Аккаунт: ${u.linkedUserId ? `привязан (${u.linkedUserId})` : 'не привязан'}\n` +
      `Уведомления: ${u.muted ? '🔕 отключены' : '🔔 включены'}\n` +
      `Ежедневный отчёт: ${u.dailyReport ? '✅' : '❌'}\n` +
      `Еженедельный отчёт: ${u.weeklyReport ? '✅' : '❌'}\n` +
      `Ценовых алертов: ${u.priceAlerts.size}\n` +
      `В чёрном списке: ${u.blacklist.length} компаний\n` +
      `Реферальный код: <code>${u.referralCode}</code>\n` +
      `Зарегистрирован: ${new Date(u.joinedAt).toLocaleDateString('ru-RU')}`
    );
  }

  private async cmdLink(chatId: number, code: string) {
    if (!code) {
      return void this.sendMessage(chatId,
        `Укажите код из личного кабинета:\n<code>/link ВАШ-КОД</code>\n\n` +
        `Найти код: Настройки → Telegram → Код привязки`);
    }
    const user = this.getOrCreateUser(chatId);
    user.linkedUserId = code;
    await this.sendMessage(chatId,
      `✅ Код <code>${code}</code> принят.\n\n⏳ Ожидайте — администратор подтвердит вашу роль на платформе.`
    );
    // уведомляем админа с выбором роли
    if (ADMIN_CHAT_ID) {
      const name = user.firstName || String(chatId);
      const roleButtons = (Object.keys(ROLE_LABELS) as PlatformRole[]).map(r => ([{
        text: ROLE_LABELS[r], callback_data: `setrole:${chatId}:${r}`,
      }]));
      await this.sendMessage(ADMIN_CHAT_ID,
        `🔗 <b>Запрос на привязку аккаунта</b>\n\n` +
        `Пользователь: <b>${name}</b> (<code>${chatId}</code>)\n` +
        `Код: <code>${code}</code>\n\n` +
        `Выберите роль:`,
        { reply_markup: { inline_keyboard: roleButtons } }
      );
    }
  }

  private async cmdUnlink(chatId: number) {
    this.getOrCreateUser(chatId).linkedUserId = undefined;
    await this.sendMessage(chatId, `✅ Аккаунт отвязан. Персональные уведомления отключены.`);
  }

  // ── мониторинг ──────────────────────────────────────────────

  private async cmdStatus(chatId: number) {
    const start = Date.now();
    const apiOk = await this.pingApi();
    const ms = Date.now() - start;
    const uptimeSec = Math.floor((Date.now() - START_TIME) / 1000);
    const h = Math.floor(uptimeSec / 3600);
    const m = Math.floor((uptimeSec % 3600) / 60);
    await this.sendMessage(chatId,
      `<b>Статус платформы</b>\n\n` +
      `API:          ${apiOk ? `✅ ${ms}мс` : '❌ недоступен'}\n` +
      `Telegram бот: ✅ работает\n` +
      `Режим:        🔧 разработка\n` +
      `Uptime:       ${h}ч ${m}м\n\n` +
      `Подключено чатов: ${this.users.size}\n` +
      `Активных алертов: ${[...this.users.values()].reduce((n, u) => n + u.priceAlerts.size, 0)}\n` +
      `Напоминаний: ${this.reminders.length}`
    );
  }

  private async cmdPing(chatId: number) {
    const start = Date.now();
    const ok = await this.pingApi();
    const ms = Date.now() - start;
    await this.sendMessage(chatId, ok ? `🏓 Понг! <b>${ms}мс</b>` : `❌ API не отвечает`);
  }

  private async cmdHealth(chatId: number) {
    const apiOk = await this.pingApi();
    await this.sendMessage(chatId,
      `<b>Диагностика:</b>\n\n` +
      `HTTP API:     ${apiOk ? '✅' : '❌'}\n` +
      `Telegram:     ✅\n` +
      `База данных:  ⚠️ file-mode (demo)\n` +
      `Очереди:      ✅\n` +
      `Интеграции:   ⚠️ sandbox\n` +
      `Email:        ❌ не настроен\n` +
      `SMS:          ❌ не настроен`
    );
  }

  private async cmdUptime(chatId: number) {
    const sec = Math.floor((Date.now() - START_TIME) / 1000);
    const d = Math.floor(sec / 86400);
    const h = Math.floor((sec % 86400) / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    await this.sendMessage(chatId, `⏱ Uptime: <b>${d}д ${h}ч ${m}м ${s}с</b>`);
  }

  // ── сделки / лоты ───────────────────────────────────────────

  private async cmdDeals(chatId: number) {
    const u = this.getOrCreateUser(chatId);
    if (!u.linkedUserId) return void this.sendMessage(chatId, `Привяжите аккаунт командой /link &lt;код&gt; чтобы видеть свои сделки.`);
    await this.sendMessage(chatId,
      `<b>Ваши активные сделки:</b>\n\n` +
      `🤝 <code>DL-9102</code> — Пшеница 500т — CONFIRMED\n` +
      `🤝 <code>DL-9088</code> — Ячмень 200т — PENDING\n` +
      `🤝 <code>DL-9071</code> — Кукуруза 300т — DOCS_REVIEW\n\n` +
      `Детали: /deal DL-9102`
    );
  }

  private async cmdDeal(chatId: number, id: string) {
    if (!id) return void this.sendMessage(chatId, `Укажите ID: <code>/deal DL-9102</code>`);
    await this.sendMessage(chatId,
      `<b>Сделка ${id}</b>\n\n` +
      `Статус: CONFIRMED ✅\n` +
      `Продавец: ООО Агро-Юг\n` +
      `Покупатель: ТД Зернотрейд\n` +
      `Культура: Пшеница 3 класс\n` +
      `Объём: 500 т\n` +
      `Цена: 18 500 ₽/т\n` +
      `Сумма: <b>9 250 000 ₽</b>\n` +
      `Платёж: ✅ подтверждён\n` +
      `Документы: 3/4 подписано\n` +
      `Поставка: в пути 🚛\n\n` +
      `/docs ${id} — документы\n` +
      `/payments ${id} — платежи`
    );
  }

  private async cmdLots(chatId: number) {
    await this.sendMessage(chatId,
      `<b>Активные лоты:</b>\n\n` +
      `📦 <code>LT-0441</code> — Ячмень 200т — 14 200 ₽/т — Краснодар\n` +
      `📦 <code>LT-0438</code> — Пшеница 3кл 1000т — 18 800 ₽/т — Ростов\n` +
      `📦 <code>LT-0435</code> — Кукуруза 500т — 16 500 ₽/т — Ставрополь\n\n` +
      `Детали: /lot LT-0441\n` +
      `Поиск: /search пшеница краснодар`
    );
  }

  private async cmdLot(chatId: number, id: string) {
    if (!id) return void this.sendMessage(chatId, `Укажите ID: <code>/lot LT-0441</code>`);
    await this.sendMessage(chatId,
      `<b>Лот ${id}</b>\n\n` +
      `Культура: Ячмень кормовой\n` +
      `Объём: 200 т\n` +
      `Цена: 14 200 ₽/т\n` +
      `Базис: EXW Краснодарский край\n` +
      `Влажность: ≤14%\n` +
      `Протеин: ≥11%\n` +
      `Продавец: КФХ Иванов\n` +
      `Рейтинг продавца: ⭐⭐⭐⭐⭐\n` +
      `Действует до: 28.05.2026`
    );
  }

  private async cmdSearch(chatId: number, query: string) {
    if (!query) return void this.sendMessage(chatId, `Укажите запрос: <code>/search пшеница краснодар</code>`);
    await this.sendMessage(chatId,
      `<b>Поиск: "${query}"</b>\n\n` +
      `📦 LT-0438 — Пшеница 3кл 1000т — 18 800 ₽/т — Ростов\n` +
      `📦 LT-0431 — Пшеница 4кл 500т — 17 200 ₽/т — Краснодар\n` +
      `📦 LT-0428 — Пшеница 5кл 300т — 15 900 ₽/т — Краснодар\n\n` +
      `Найдено: 3 лота`
    );
  }

  private async cmdDocs(chatId: number, dealId: string) {
    if (!dealId) return void this.sendMessage(chatId, `Укажите сделку: <code>/docs DL-9102</code>`);
    await this.sendMessage(chatId,
      `<b>Документы по ${dealId}:</b>\n\n` +
      `📄 Договор купли-продажи — ✅ подписан\n` +
      `📄 Спецификация — ✅ подписана\n` +
      `📄 ТТН-2026-04412 — ⏳ ожидает подписи покупателя\n` +
      `📄 Акт приёмки — ❌ не загружен`
    );
  }

  private async cmdPayments(chatId: number, dealId: string) {
    if (!dealId) return void this.sendMessage(chatId, `Укажите сделку: <code>/payments DL-9102</code>`);
    await this.sendMessage(chatId,
      `<b>Платежи по ${dealId}:</b>\n\n` +
      `💳 Аванс 50% — 4 625 000 ₽ — ✅ CONFIRMED\n` +
      `💳 Остаток 50% — 4 625 000 ₽ — ⏳ ожидает поставки\n\n` +
      `Итого: 9 250 000 ₽`
    );
  }

  private async cmdBalance(chatId: number) {
    const u = this.getOrCreateUser(chatId);
    if (!u.linkedUserId) return void this.sendMessage(chatId, `Привяжите аккаунт командой /link &lt;код&gt;.`);
    await this.sendMessage(chatId,
      `<b>Баланс счёта:</b>\n\n` +
      `Доступно: <b>1 250 000 ₽</b>\n` +
      `В резерве: 4 625 000 ₽\n` +
      `Ожидает поступления: 4 625 000 ₽\n\n` +
      `Банк: СберБизнес`
    );
  }

  private async cmdDisputes(chatId: number) {
    await this.sendMessage(chatId,
      `<b>Споры:</b>\n\n` +
      `⚖️ DS-0088 — DL-8901 — на рассмотрении ⏳\n\n` +
      `Детали: /dispute DS-0088\n` +
      `Открыть спор: /dispute open DL-&lt;ID&gt;`
    );
  }

  private async cmdDispute(chatId: number, arg: string) {
    if (!arg) return void this.sendMessage(chatId, `Укажите ID или действие:\n/dispute DS-0088\n/dispute open DL-9102`);
    if (arg.toLowerCase().startsWith('open ')) {
      const dealId = arg.split(' ')[1];
      return void this.sendMessage(chatId, `✅ Спор по сделке ${dealId} открыт.\nМенеджер рассмотрит в течение 48 часов.`);
    }
    await this.sendMessage(chatId,
      `<b>Спор ${arg}:</b>\n\n` +
      `Сделка: DL-8901\nИнициатор: Покупатель\n` +
      `Причина: Несоответствие качества\n` +
      `Ущерб: 320 000 ₽\nСтатус: на рассмотрении ⏳\n` +
      `Срок решения: 23.05.2026`
    );
  }

  private async cmdShipments(chatId: number) {
    await this.sendMessage(chatId,
      `<b>Поставки:</b>\n\n` +
      `🚛 SH-0221 — DL-9102 — в пути — Краснодар → Москва\n` +
      `🚛 SH-0218 — DL-9088 — ожидает отгрузки\n\n` +
      `Детали: /shipment SH-0221`
    );
  }

  private async cmdShipment(chatId: number, id: string) {
    if (!id) return void this.sendMessage(chatId, `Укажите ID: <code>/shipment SH-0221</code>`);
    await this.sendMessage(chatId,
      `<b>Поставка ${id}:</b>\n\n` +
      `Маршрут: Краснодар → Москва\n` +
      `Транспорт: КАМАЗ А777ВВ123\n` +
      `Водитель: Иванов А.С.\n` +
      `Статус: в пути 🚛\n` +
      `Прогресс: ████░░░ 65%\n` +
      `Ожидаемое прибытие: 23.05.2026 14:00\n\n` +
      `GPS: /track ${id}`
    );
  }

  private async cmdTrack(chatId: number, id: string) {
    if (!id) return void this.sendMessage(chatId, `Укажите ID: <code>/track SH-0221</code>`);
    await this.sendMessage(chatId,
      `📍 <b>GPS: ${id}</b>\n\n` +
      `Последняя отметка: 21.05.2026 19:10\n` +
      `Координаты: 48.7194° N, 44.5018° E\n` +
      `Населённый пункт: Волгоград\n` +
      `Скорость: 78 км/ч\n` +
      `До цели: ~850 км (~9 часов)`
    );
  }

  // ── цены ────────────────────────────────────────────────────

  private async cmdPrice(chatId: number, crop: string) {
    if (!crop) return void this.cmdPrices(chatId);
    const key = crop.toLowerCase();
    const p = PRICES[key];
    if (!p) {
      return void this.sendMessage(chatId,
        `Культура "<b>${crop}</b>" не найдена.\n\nДоступные: ${Object.keys(PRICES).join(', ')}`);
    }
    await this.sendMessage(chatId,
      `📊 <b>${crop.charAt(0).toUpperCase() + crop.slice(1)}</b>\n\n` +
      `Цена: <b>${p.price.toLocaleString('ru-RU')} ₽/т</b> ${p.trend}\n` +
      `Регион: ${p.region}\n` +
      `Дата: ${new Date().toLocaleDateString('ru-RU')}\n\n` +
      `Алерт при цене: /alert ${key} &lt;цена&gt;\n` +
      `График: /chart ${key}`
    );
  }

  private async cmdPrices(chatId: number) {
    const lines = Object.entries(PRICES)
      .map(([k, v]) => `${v.trend} <b>${k.charAt(0).toUpperCase() + k.slice(1)}</b>: ${v.price.toLocaleString('ru-RU')} ₽/т`)
      .join('\n');
    await this.sendMessage(chatId,
      `📊 <b>Цены на зерно (${new Date().toLocaleDateString('ru-RU')}):</b>\n\n${lines}\n\n` +
      `Детали: /price пшеница`
    );
  }

  private async cmdAlert(chatId: number, arg: string) {
    const parts = arg.trim().split(/\s+/);
    if (parts.length < 2) {
      return void this.sendMessage(chatId,
        `Формат: <code>/alert пшеница 19000</code>\n` +
        `Удалить: <code>/alert off пшеница</code>`);
    }
    const u = this.getOrCreateUser(chatId);
    if (parts[0] === 'off') {
      u.priceAlerts.delete(parts[1]);
      return void this.sendMessage(chatId, `✅ Алерт по ${parts[1]} удалён.`);
    }
    const crop = parts[0].toLowerCase();
    const price = Number(parts[1]);
    if (!PRICES[crop]) return void this.sendMessage(chatId, `Культура "${crop}" не найдена.`);
    if (isNaN(price)) return void this.sendMessage(chatId, `Укажите цену числом: <code>/alert пшеница 19000</code>`);
    u.priceAlerts.set(crop, price);
    await this.sendMessage(chatId,
      `🔔 Алерт установлен: <b>${crop}</b> при ${price.toLocaleString('ru-RU')} ₽/т\n` +
      `Текущая цена: ${PRICES[crop].price.toLocaleString('ru-RU')} ₽/т`
    );
  }

  private async cmdAlerts(chatId: number) {
    const u = this.getOrCreateUser(chatId);
    if (u.priceAlerts.size === 0) {
      return void this.sendMessage(chatId, `У вас нет активных алертов.\n\nУстановить: /alert пшеница 19000`);
    }
    const lines = [...u.priceAlerts.entries()]
      .map(([k, v]) => `🔔 ${k}: ${v.toLocaleString('ru-RU')} ₽/т (сейчас ${PRICES[k]?.price.toLocaleString('ru-RU') ?? '—'} ₽/т)`)
      .join('\n');
    await this.sendMessage(chatId, `<b>Ваши алерты:</b>\n\n${lines}\n\nУдалить: /alert off &lt;культура&gt;`);
  }

  private async cmdChart(chatId: number, arg: string) {
    const [crop] = arg.split(/\s+/);
    if (!crop) return void this.sendMessage(chatId, `Укажите культуру: <code>/chart пшеница</code>`);
    const p = PRICES[crop.toLowerCase()];
    if (!p) return void this.sendMessage(chatId, `Культура "${crop}" не найдена.`);
    const base = p.price;
    const chart = [0.96, 0.97, 0.98, 0.99, 1.0, 0.99, 1.01, 1.0, 1.02, 1.01, 1.03, 1.0]
      .map((m, i) => {
        const v = Math.round(base * m / 100) * 100;
        const bar = '█'.repeat(Math.round((v - base * 0.95) / (base * 0.08) * 10));
        return `${i + 1} мес: ${v.toLocaleString('ru-RU')} ₽ ${bar}`;
      }).join('\n');
    await this.sendMessage(chatId, `📈 <b>${crop} — динамика за 12 мес:</b>\n\n<code>${chart}</code>`);
  }

  // ── уведомления и настройки ─────────────────────────────────

  private async cmdMute(chatId: number, type: string) {
    const u = this.getOrCreateUser(chatId);
    if (!type || type === 'all' || type === '') {
      u.muted = true;
      return void this.sendMessage(chatId, `🔕 Все уведомления отключены.\nВключить: /unmute`);
    }
    u.mutedTypes.add(type);
    await this.sendMessage(chatId, `🔕 Уведомления типа "${type}" отключены.`);
  }

  private async cmdUnmute(chatId: number) {
    const u = this.getOrCreateUser(chatId);
    u.muted = false;
    u.mutedTypes.clear();
    await this.sendMessage(chatId, `🔔 Все уведомления включены.`);
  }

  private async cmdSettings(chatId: number) {
    const u = this.getOrCreateUser(chatId);
    await this.sendMessage(chatId,
      `<b>Настройки уведомлений:</b>\n\n` +
      `Все уведомления: ${u.muted ? '🔕 выкл' : '🔔 вкл'}\n` +
      `Ежедневный отчёт: ${u.dailyReport ? '✅' : '❌'}\n` +
      `Еженедельный отчёт: ${u.weeklyReport ? '✅' : '❌'}`,
      { reply_markup: this.settingsKeyboard(u) }
    );
  }

  private async cmdReport(chatId: number, arg: string) {
    const [type, toggle] = arg.split(/\s+/);
    const u = this.getOrCreateUser(chatId);
    if (type === 'daily') {
      u.dailyReport = toggle === 'on';
      return void this.sendMessage(chatId, `✅ Ежедневный отчёт ${toggle === 'on' ? 'включён' : 'отключён'}.`);
    }
    if (type === 'weekly') {
      u.weeklyReport = toggle === 'on';
      return void this.sendMessage(chatId, `✅ Еженедельный отчёт ${toggle === 'on' ? 'включён' : 'отключён'}.`);
    }
    await this.sendDailyReport(chatId);
  }

  private async cmdExport(chatId: number, arg: string) {
    const type = arg.split(/\s+/)[0] || 'deals';
    const csv = type === 'deals'
      ? `ID,Статус,Культура,Объём,Цена,Сумма\nDL-9102,CONFIRMED,Пшеница,500,18500,9250000\nDL-9088,PENDING,Ячмень,200,14200,2840000`
      : `ID,Культура,Объём,Цена,Базис\nLT-0441,Ячмень,200,14200,EXW Краснодар\nLT-0438,Пшеница,1000,18800,EXW Ростов`;
    await this.sendMessage(chatId,
      `📊 <b>Экспорт: ${type}</b>\n\n<code>${csv}</code>\n\n` +
      `(В production: будет прислан файл .csv или .xlsx)`
    );
  }

  // ── напоминания ─────────────────────────────────────────────

  private async cmdRemind(chatId: number, arg: string) {
    const parts = arg.trim().split(/\s+/);
    const timeStr = parts[parts.length - 1];
    const text = parts.slice(0, -1).join(' ');
    const ms = this.parseTime(timeStr);
    if (!ms || !text) {
      return void this.sendMessage(chatId,
        `Формат: <code>/remind текст напоминания 1h</code>\n` +
        `Варианты: 30m, 1h, 2h, 24h, 2d, 7d`);
    }
    const id = `rem-${Date.now()}`;
    const fireAt = Date.now() + ms;
    const timer = setTimeout(() => {
      void this.sendMessage(chatId, `⏰ <b>Напоминание:</b> ${text}`);
      const idx = this.reminders.findIndex(r => r.id === id);
      if (idx >= 0) this.reminders.splice(idx, 1);
    }, ms);
    this.reminders.push({ id, chatId, text, fireAt, timer });
    const fireDate = new Date(fireAt).toLocaleString('ru-RU');
    await this.sendMessage(chatId, `⏰ Напоминание установлено на <b>${fireDate}</b>:\n"${text}"`);
  }

  private async cmdReminders(chatId: number) {
    const mine = this.reminders.filter(r => r.chatId === chatId);
    if (!mine.length) return void this.sendMessage(chatId, `Нет активных напоминаний.\n\nУстановить: /remind текст 1h`);
    const lines = mine.map(r =>
      `⏰ "${r.text}" — ${new Date(r.fireAt).toLocaleString('ru-RU')}`
    ).join('\n');
    await this.sendMessage(chatId, `<b>Ваши напоминания:</b>\n\n${lines}`);
  }

  // ── поддержка ───────────────────────────────────────────────

  private async cmdSupport(chatId: number, text: string) {
    if (!text) {
      this.getOrCreateUser(chatId).supportMode = true;
      return void this.sendMessage(chatId, `✍️ Напишите ваш вопрос следующим сообщением — мы передадим его в поддержку.`);
    }
    await this.forwardToAdmin(chatId, text, null);
    await this.sendMessage(chatId, `✅ Вопрос отправлен в поддержку. Ответим в течение 2 часов.`);
  }

  private async cmdFaq(chatId: number, arg: string) {
    const num = parseInt(arg);
    if (!isNaN(num) && FAQ_LIST[num - 1]) {
      const f = FAQ_LIST[num - 1];
      return void this.sendMessage(chatId, `❓ <b>${f.q}</b>\n\n${f.a}`);
    }
    const list = FAQ_LIST.map((f, i) => `${i + 1}. ${f.q}`).join('\n');
    await this.sendMessage(chatId, `<b>Частые вопросы:</b>\n\n${list}\n\nОткрыть: /faq 1`);
  }

  private async cmdFeedback(chatId: number, text: string) {
    if (!text) return void this.sendMessage(chatId, `Формат: <code>/feedback Ваш отзыв</code>`);
    await this.forwardToAdmin(chatId, `[FEEDBACK] ${text}`, null);
    await this.sendMessage(chatId, `✅ Спасибо за отзыв! Мы учтём его при разработке.`);
  }

  // ── информация ──────────────────────────────────────────────

  private async cmdFeatures(chatId: number) {
    await this.sendMessage(chatId,
      `<b>Возможности платформы:</b>\n\n` +
      `📦 Лоты — публикация и поиск предложений\n` +
      `🤝 Сделки — заключение и ведение\n` +
      `💳 Расчёты — безопасные платежи через банк\n` +
      `📄 Документы — ЭДО, накладные, договоры\n` +
      `🚛 Логистика — отслеживание, GPS\n` +
      `🧪 Лаборатория — анализ качества зерна\n` +
      `⚖️ Споры — разбор конфликтов\n` +
      `🏦 Банк — интеграция со СберБизнес\n` +
      `📊 Аналитика — отчёты и мониторинг\n` +
      `🤖 Telegram — этот бот`
    );
  }

  private async cmdRoadmap(chatId: number) {
    await this.sendMessage(chatId,
      `<b>Планы развития:</b>\n\n` +
      `✅ Telegram-бот (готово)\n` +
      `🔜 Привязка аккаунта\n` +
      `🔜 Управление сделками через бота\n` +
      `🔜 Telegram Mini App\n` +
      `🔜 Мобильное приложение\n` +
      `🔜 Интеграция ФГИС Зерно\n` +
      `🔜 Онлайн-торги в реальном времени\n` +
      `🔜 AI-помощник (распознавание фото зерна)\n` +
      `🔜 Электронная подпись\n` +
      `🔜 Выход на рынки СНГ`
    );
  }

  private async cmdNews(chatId: number) {
    const today = new Date().toLocaleDateString('ru-RU');
    await this.sendMessage(chatId,
      `<b>Новости рынка зерна (${today}):</b>\n\n` +
      `📰 Экспорт пшеницы из России вырос на 12% г/г\n` +
      `📰 Цены на ячмень стабилизировались после снижения\n` +
      `📰 Минсельхоз скорректировал прогноз урожая: 130 млн т\n` +
      `📰 СберАгро запускает новые программы финансирования\n\n` +
      `(Данные демонстрационные — в production подключится реальный фид новостей)`
    );
  }

  private async cmdWeather(chatId: number, city: string) {
    if (!city) return void this.sendMessage(chatId, `Укажите город: <code>/weather краснодар</code>`);
    try {
      const data = await this.httpGet(`http://wttr.in/${encodeURIComponent(city)}?format=4&lang=ru`);
      await this.sendMessage(chatId, `🌤 <b>Погода — ${city}:</b>\n\n${data}`);
    } catch {
      await this.sendMessage(chatId, `🌤 <b>Погода — ${city}:</b>\n\nСервис недоступен. Попробуйте позже.`);
    }
  }

  private async cmdCurrency(chatId: number) {
    try {
      const raw = await this.httpsGet('api.exchangerate-api.com', '/v4/latest/RUB');
      const data = JSON.parse(raw as string) as { rates: Record<string, number> };
      const usd = (1 / data.rates['USD']).toFixed(2);
      const eur = (1 / data.rates['EUR']).toFixed(2);
      const cny = (1 / data.rates['CNY']).toFixed(2);
      await this.sendMessage(chatId,
        `💱 <b>Курс валют (ЦБ РФ):</b>\n\n` +
        `USD: <b>${usd} ₽</b>\nEUR: <b>${eur} ₽</b>\nCNY: <b>${cny} ₽</b>\n\n` +
        `(Актуально для экспортных сделок)`
      );
    } catch {
      await this.sendMessage(chatId,
        `💱 <b>Курс валют:</b>\n\nUSD: ~90 ₽\nEUR: ~97 ₽\nCNY: ~12.5 ₽\n\n(Данные примерные)`
      );
    }
  }

  // ── инструменты ─────────────────────────────────────────────

  private async cmdCalculator(chatId: number, arg: string) {
    const parts = arg.trim().split(/\s+/);
    if (parts.length < 2) {
      return void this.sendMessage(chatId,
        `Калькулятор сделки:\n<code>/calculator пшеница 500</code>\n(культура и объём в тоннах)`);
    }
    const crop = parts[0].toLowerCase();
    const volume = Number(parts[1]);
    const price = PRICES[crop]?.price || 18000;
    const total = price * volume;
    const commission = Math.round(total * 0.005);
    const bank = Math.round(total * 0.001);
    await this.sendMessage(chatId,
      `🧮 <b>Расчёт сделки:</b>\n\n` +
      `Культура: ${crop}\nОбъём: ${volume} т\n` +
      `Цена: ${price.toLocaleString('ru-RU')} ₽/т\n\n` +
      `Сумма сделки: <b>${total.toLocaleString('ru-RU')} ₽</b>\n` +
      `Комиссия платформы (0.5%): ${commission.toLocaleString('ru-RU')} ₽\n` +
      `Комиссия банка (0.1%): ${bank.toLocaleString('ru-RU')} ₽\n` +
      `Итого к оплате: <b>${(total + commission + bank).toLocaleString('ru-RU')} ₽</b>`
    );
  }

  private async cmdInvite(chatId: number) {
    const u = this.getOrCreateUser(chatId);
    await this.sendMessage(chatId,
      `📨 <b>Пригласите коллегу:</b>\n\n` +
      `Ваш реферальный код: <code>${u.referralCode}</code>\n\n` +
      `Поделитесь ссылкой:\n<code>https://t.me/${process.env.TELEGRAM_BOT_USERNAME || 'ваш_бот'}?start=${u.referralCode}</code>\n\n` +
      `За каждого приглашённого пользователя, который совершит сделку, вы получите бонус.`
    );
  }

  private async cmdRating(chatId: number, company: string) {
    if (!company) return void this.sendMessage(chatId, `Укажите компанию: <code>/rating ООО Агро-Юг</code>`);
    await this.sendMessage(chatId,
      `⭐ <b>Рейтинг: ${company}</b>\n\n` +
      `Оценка: ⭐⭐⭐⭐⭐ (4.8/5)\n` +
      `Сделок: 47\nСпоров: 1 (2%)\n` +
      `Avg срок поставки: 3.2 дня\n` +
      `Avg срок оплаты: 1.1 дня\n` +
      `Отзывов: 23\n\n` +
      `(В production данные будут из реальных сделок)`
    );
  }

  private async cmdBlacklist(chatId: number, arg: string) {
    const u = this.getOrCreateUser(chatId);
    const [action, ...nameParts] = arg.split(/\s+/);
    const name = nameParts.join(' ');
    if (action === 'add' && name) {
      u.blacklist.push(name);
      return void this.sendMessage(chatId, `🚫 "${name}" добавлен в чёрный список.`);
    }
    if (action === 'remove' && name) {
      u.blacklist = u.blacklist.filter(n => n !== name);
      return void this.sendMessage(chatId, `✅ "${name}" удалён из чёрного списка.`);
    }
    if (!u.blacklist.length) return void this.sendMessage(chatId, `Чёрный список пуст.\nДобавить: /blacklist add ООО Рога`);
    await this.sendMessage(chatId,
      `🚫 <b>Чёрный список:</b>\n\n${u.blacklist.map(n => `• ${n}`).join('\n')}\n\nУдалить: /blacklist remove Название`
    );
  }

  // ── демо ────────────────────────────────────────────────────

  private async cmdDemo(chatId: number, arg: string) {
    const all = !arg || arg === 'all';
    if (!arg) {
      return void this.sendMessage(chatId,
        `Выберите тип демо-события:`,
        { reply_markup: this.demoKeyboard() }
      );
    }
    if (all || arg === 'deal') await this.sendMessage(chatId,
      `🤝 <b>DEAL · Новая сделка</b>\n\nСделка <code>DL-9102</code> создана\n` +
      `Продавец: ООО Агро-Юг · Покупатель: ТД Зернотрейд\n` +
      `Культура: Пшеница 3 класс · Объём: 500 т\n` +
      `Цена: 18 500 ₽/т · Сумма: <b>9 250 000 ₽</b>\nСтатус: DRAFT`);
    if (all || arg === 'lot') await this.sendMessage(chatId,
      `📦 <b>LOT · Новый лот</b>\n\nЛот <code>LT-0441</code> опубликован\n` +
      `Ячмень кормовой · 200 т · 14 200 ₽/т\nEXW Краснодарский край · до 28.05.2026`);
    if (all || arg === 'dispute') await this.sendMessage(chatId,
      `⚖️ <b>DISPUTE · Спор открыт</b>\n\nСпор <code>DS-0088</code> по <code>DL-8901</code>\n` +
      `Причина: несоответствие качества · Ущерб: 320 000 ₽\nСтатус: ожидает рассмотрения ⏳`);
    if (all || arg === 'payment') await this.sendMessage(chatId,
      `💳 <b>PAYMENT · Платёж</b>\n\nПо сделке <code>DL-9102</code>\n` +
      `Аванс 50% · <b>4 625 000 ₽</b> · СберБизнес\nСтатус: CONFIRMED ✅`);
    if (all || arg === 'doc') await this.sendMessage(chatId,
      `📄 <b>DOCUMENT · Документ</b>\n\nТТН-2026-04412 по <code>DL-9102</code>\n` +
      `Загружен: ООО Агро-Юг · Статус: ожидает подписи ✍️`);
    if (all || arg === 'logistics') await this.sendMessage(chatId,
      `🚛 <b>LOGISTICS · Поставка</b>\n\nSH-0221 по <code>DL-9102</code>\n` +
      `Краснодар → Москва · КАМАЗ А777ВВ123\nПрибытие: 23.05.2026 · Прогресс: 65%`);
    if (all || arg === 'auction') await this.sendMessage(chatId,
      `🔨 <b>AUCTION · Торги</b>\n\nЛот <code>LT-0441</code> · Ячмень 200 т\n` +
      `Текущая ставка: <b>14 500 ₽/т</b> (+300 ₽)\nПоследняя ставка: ТД Зернотрейд · 30 сек назад\nДо конца: 4 мин 12 сек ⏱`);
  }

  // ── админ ────────────────────────────────────────────────────

  private isAdmin(chatId: number): boolean {
    return ADMIN_CHAT_ID > 0 && chatId === ADMIN_CHAT_ID;
  }

  private async cmdApprove(chatId: number, target: string) {
    if (!this.isAdmin(chatId)) return void this.sendMessage(chatId, `❌ Нет доступа.`);
    const id = Number(target);
    if (isNaN(id)) return void this.sendMessage(chatId, `Укажите Chat ID: /approve 123456789`);
    const u = this.users.get(id);
    if (!u) return void this.sendMessage(chatId, `Пользователь не найден.`);
    u.approved = true;
    u.pending = false;
    await this.sendMessage(id, `✅ <b>Доступ одобрен!</b>\n\nДобро пожаловать в <b>Прозрачная Цена</b>.\n\nИспользуйте /menu или /help.`, { reply_markup: this.mainMenuKeyboard() });
    await this.sendMessage(chatId, `✅ Пользователь ${id} одобрен.`);
  }

  private async cmdReject(chatId: number, target: string) {
    if (!this.isAdmin(chatId)) return void this.sendMessage(chatId, `❌ Нет доступа.`);
    const id = Number(target);
    if (isNaN(id)) return void this.sendMessage(chatId, `Укажите Chat ID: /reject 123456789`);
    const u = this.users.get(id);
    if (!u) return void this.sendMessage(chatId, `Пользователь не найден.`);
    u.pending = false;
    await this.sendMessage(id, `❌ Ваш запрос на доступ отклонён.`);
    await this.sendMessage(chatId, `❌ Пользователь ${id} отклонён.`);
  }

  private async cmdPending(chatId: number) {
    if (!this.isAdmin(chatId)) return void this.sendMessage(chatId, `❌ Нет доступа.`);
    const pending = [...this.users.values()].filter(u => u.pending);
    if (!pending.length) return void this.sendMessage(chatId, `Нет ожидающих одобрения.`);
    const lines = pending.map(u =>
      `• ${u.firstName || '—'} (${u.username ? '@' + u.username : '—'}) — <code>${u.chatId}</code>`
    ).join('\n');
    await this.sendMessage(chatId,
      `<b>Ожидают одобрения (${pending.length}):</b>\n\n${lines}\n\n` +
      `Одобрить: /approve &lt;chatId&gt;\nОтклонить: /reject &lt;chatId&gt;`
    );
  }

  private async cmdBroadcast(chatId: number, text: string) {
    if (!this.isAdmin(chatId)) return void this.sendMessage(chatId, `❌ Нет доступа.`);
    if (!text) return void this.sendMessage(chatId, `Формат: <code>/broadcast Текст сообщения</code>`);
    let sent = 0;
    for (const [id] of this.users) {
      await this.sendMessage(id, `📢 <b>Сообщение от платформы:</b>\n\n${text}`);
      sent++;
    }
    await this.sendMessage(chatId, `✅ Разослано: ${sent} пользователям.`);
  }

  private async cmdStats(chatId: number) {
    if (!this.isAdmin(chatId)) return void this.sendMessage(chatId, `❌ Нет доступа.`);
    const total = this.users.size;
    const muted = [...this.users.values()].filter(u => u.muted).length;
    const linked = [...this.users.values()].filter(u => u.linkedUserId).length;
    const alerts = [...this.users.values()].reduce((n, u) => n + u.priceAlerts.size, 0);
    await this.sendMessage(chatId,
      `<b>Статистика бота:</b>\n\n` +
      `Пользователей: ${total}\nПривязанных аккаунтов: ${linked}\n` +
      `Отключили уведомления: ${muted}\nАктивных алертов: ${alerts}\n` +
      `Напоминаний: ${this.reminders.length}\n` +
      `Uptime: ${Math.floor((Date.now() - START_TIME) / 60000)} мин`
    );
  }

  private async cmdUsers(chatId: number) {
    if (!this.isAdmin(chatId)) return void this.sendMessage(chatId, `❌ Нет доступа.`);
    const lines = [...this.users.entries()].slice(0, 20)
      .map(([id, u]) => `${id}${u.linkedUserId ? ` (${u.linkedUserId})` : ''}${u.muted ? ' 🔕' : ''}${u.banned ? ' 🚫' : ''}`)
      .join('\n');
    await this.sendMessage(chatId, `<b>Пользователи (${this.users.size}):</b>\n\n<code>${lines || 'пусто'}</code>`);
  }

  private async cmdBan(chatId: number, target: string) {
    if (!this.isAdmin(chatId)) return void this.sendMessage(chatId, `❌ Нет доступа.`);
    const id = Number(target);
    if (isNaN(id)) return void this.sendMessage(chatId, `Укажите Chat ID: <code>/ban 123456789</code>`);
    const u = this.users.get(id);
    if (u) { u.banned = true; await this.sendMessage(chatId, `🚫 Пользователь ${id} заблокирован.`); }
    else await this.sendMessage(chatId, `Пользователь ${id} не найден.`);
  }

  private async cmdUnban(chatId: number, target: string) {
    if (!this.isAdmin(chatId)) return void this.sendMessage(chatId, `❌ Нет доступа.`);
    const id = Number(target);
    const u = this.users.get(id);
    if (u) { u.banned = false; await this.sendMessage(chatId, `✅ Пользователь ${id} разблокирован.`); }
    else await this.sendMessage(chatId, `Пользователь ${id} не найден.`);
  }

  // ── расписание ───────────────────────────────────────────────

  private startScheduler() {
    this.schedulerInterval = setInterval(() => void this.tickScheduler(), 60000);
  }

  private async tickScheduler() {
    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes();
    const dow = now.getDay();
    if (h === 9 && m === 0) {
      for (const [chatId, u] of this.users) {
        if (u.dailyReport && !u.muted) await this.sendDailyReport(chatId);
      }
    }
    if (dow === 1 && h === 9 && m === 0) {
      for (const [chatId, u] of this.users) {
        if (u.weeklyReport && !u.muted) await this.sendWeeklyReport(chatId);
      }
    }
    this.checkPriceAlerts();
  }

  private async sendDailyReport(chatId: number) {
    const prices = Object.entries(PRICES).slice(0, 4)
      .map(([k, v]) => `${v.trend} ${k.charAt(0).toUpperCase() + k.slice(1)}: ${v.price.toLocaleString('ru-RU')} ₽/т`)
      .join('\n');
    await this.sendMessage(chatId,
      `☀️ <b>Утренний отчёт — ${new Date().toLocaleDateString('ru-RU')}</b>\n\n` +
      `<b>Цены:</b>\n${prices}\n\n` +
      `<b>Активных сделок:</b> 3\n` +
      `<b>Новых лотов за ночь:</b> 7\n` +
      `<b>Ожидают вашего действия:</b> 1 документ\n\n` +
      `/deals — к сделкам`
    );
  }

  private async sendWeeklyReport(chatId: number) {
    await this.sendMessage(chatId,
      `📊 <b>Еженедельный отчёт</b>\n\n` +
      `Сделок завершено: 2\nОбъём: 700 т\nСумма: 12 090 000 ₽\n\n` +
      `Пшеница за неделю: 18 200 → 18 500 ₽/т (+1.6%)\n` +
      `Ячмень за неделю: 14 000 → 14 200 ₽/т (+1.4%)`
    );
  }

  private checkPriceAlerts() {
    for (const [chatId, u] of this.users) {
      for (const [crop, threshold] of u.priceAlerts) {
        const current = PRICES[crop]?.price;
        if (current && current >= threshold) {
          void this.sendMessage(chatId,
            `🔔 <b>Ценовой алерт!</b>\n\n` +
            `${crop.charAt(0).toUpperCase() + crop.slice(1)}: <b>${current.toLocaleString('ru-RU')} ₽/т</b>\n` +
            `Ваш порог: ${threshold.toLocaleString('ru-RU')} ₽/т ✅`
          );
          u.priceAlerts.delete(crop);
        }
      }
    }
  }

  // ── uptime monitor ───────────────────────────────────────────

  private startUptimeMonitor() {
    this.uptimeInterval = setInterval(() => void this.checkUptime(), 5 * 60 * 1000);
  }

  private async checkUptime() {
    const ok = await this.pingApi();
    if (!ok && this.lastApiStatus) {
      this.logger.error('API health check failed — notifying admins');
      if (ADMIN_CHAT_ID) await this.sendMessage(ADMIN_CHAT_ID, `🚨 <b>API недоступен!</b>\n\nHealth check провалился. Проверьте сервер.`);
    }
    if (ok && !this.lastApiStatus) {
      if (ADMIN_CHAT_ID) await this.sendMessage(ADMIN_CHAT_ID, `✅ <b>API восстановлен.</b>`);
    }
    this.lastApiStatus = ok;
  }

  // ── inline keyboards ─────────────────────────────────────────

  private mainMenuKeyboard() {
    return {
      inline_keyboard: [
        [{ text: '📊 Цены', callback_data: 'menu:prices' }, { text: '✅ Статус', callback_data: 'menu:status' }],
        [{ text: '🤝 Сделки', callback_data: 'menu:deals' }, { text: '📦 Лоты', callback_data: 'menu:lots' }],
        [{ text: '⚙️ Настройки', callback_data: 'menu:settings' }, { text: '❓ Помощь', callback_data: 'menu:help' }],
      ],
    };
  }

  private demoKeyboard() {
    return {
      inline_keyboard: [
        [{ text: '🤝 Сделка', callback_data: 'demo:deal' }, { text: '📦 Лот', callback_data: 'demo:lot' }],
        [{ text: '⚖️ Спор', callback_data: 'demo:dispute' }, { text: '💳 Платёж', callback_data: 'demo:payment' }],
        [{ text: '📄 Документ', callback_data: 'demo:doc' }, { text: '🚛 Логистика', callback_data: 'demo:logistics' }],
        [{ text: '🔨 Торги', callback_data: 'demo:auction' }, { text: '🔁 Все сразу', callback_data: 'demo:all' }],
      ],
    };
  }

  private settingsKeyboard(u: UserSettings) {
    return {
      inline_keyboard: [
        [{ text: u.muted ? '🔔 Включить уведомления' : '🔕 Отключить уведомления',
           callback_data: u.muted ? 'settings:unmute' : 'settings:mute' }],
        [{ text: u.dailyReport ? '❌ Отключить отчёт в 9:00' : '✅ Включить отчёт в 9:00',
           callback_data: u.dailyReport ? 'settings:daily_off' : 'settings:daily_on' }],
      ],
    };
  }

  // ── вспомогательные ──────────────────────────────────────────

  private getOrCreateUser(chatId: number, from?: any): UserSettings {
    if (!this.users.has(chatId)) {
      this.users.set(chatId, {
        chatId,
        firstName: from?.first_name,
        username: from?.username,
        approved: chatId === ADMIN_CHAT_ID,
        pending: false,
        muted: false,
        mutedTypes: new Set(),
        dailyReport: false,
        weeklyReport: false,
        banned: false,
        referralCode: `PC${chatId.toString().slice(-6)}`,
        joinedAt: new Date().toISOString(),
        priceAlerts: new Map(),
        blacklist: [],
        supportMode: false,
        lang: 'ru',
      });
    }
    return this.users.get(chatId)!;
  }

  private async forwardToAdmin(chatId: number, text: string, from: any) {
    if (!ADMIN_CHAT_ID) return;
    const name = from ? `${from.first_name || ''} ${from.last_name || ''}`.trim() : 'пользователь';
    await this.sendMessage(ADMIN_CHAT_ID,
      `📩 <b>Сообщение от пользователя</b>\nChat ID: <code>${chatId}</code>${name ? ` · ${name}` : ''}\n\n${text}`
    );
  }

  private parseTime(s: string): number | null {
    const m = /^(\d+)(m|h|d)$/.exec(s);
    if (!m) return null;
    const n = Number(m[1]);
    if (m[2] === 'm') return n * 60 * 1000;
    if (m[2] === 'h') return n * 3600 * 1000;
    if (m[2] === 'd') return n * 86400 * 1000;
    return null;
  }

  private pingApi(): Promise<boolean> {
    return new Promise((resolve) => {
      const req = http.get('http://localhost:4000/health', (res) => resolve(res.statusCode === 200));
      req.on('error', () => resolve(false));
      req.setTimeout(3000, () => { req.destroy(); resolve(false); });
    });
  }

  private httpGet(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      http.get(url, (res) => {
        let d = ''; res.on('data', c => { d += c; }); res.on('end', () => resolve(d));
      }).on('error', reject);
    });
  }

  private httpsGet(hostname: string, path: string): Promise<unknown> {
    return new Promise((resolve, reject) => {
      https.get({ hostname, path, timeout: 5000 }, (res) => {
        let d = ''; res.on('data', c => { d += c; }); res.on('end', () => resolve(d));
      }).on('error', reject);
    });
  }

  private async poll(): Promise<void> {
    while (this.polling) {
      try {
        const result = await this.callApi('getUpdates', {
          offset: this.offset, timeout: 30,
          allowed_updates: ['message', 'callback_query'],
        }) as { ok: boolean; result: any[] };
        if (result.ok && result.result.length > 0) {
          for (const update of result.result) {
            this.handleUpdate(update);
            this.offset = update.update_id + 1;
          }
        }
      } catch (err) {
        if (this.polling) { this.logger.error(`Polling error: ${err}`); await this.sleep(5000); }
      }
    }
  }

  private sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

  private callApi(method: string, params: Record<string, unknown>): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const body = JSON.stringify(params);
      const req = https.request(
        { hostname: 'api.telegram.org', path: `/bot${this.token}/${method}`,
          method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
          timeout: 35000 },
        (res) => {
          let data = '';
          res.on('data', c => { data += c; });
          res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve(data); } });
        });
      req.on('error', reject);
      req.on('timeout', () => req.destroy(new Error('timeout')));
      req.write(body); req.end();
    });
  }
}
