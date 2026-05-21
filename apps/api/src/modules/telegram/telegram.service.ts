import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import * as https from 'https';

@Injectable()
export class TelegramService implements OnApplicationBootstrap {
  private readonly logger = new Logger(TelegramService.name);
  private readonly token = process.env.TELEGRAM_BOT_TOKEN;

  onApplicationBootstrap() {
    if (!this.token) {
      this.logger.warn('TELEGRAM_BOT_TOKEN not set — Telegram notifications disabled');
    } else {
      this.logger.log('Telegram bot ready');
    }
  }

  async sendMessage(chatId: string | number, text: string): Promise<void> {
    if (!this.token) return;
    try {
      await this.callApi('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML' });
    } catch (err) {
      this.logger.error(`Failed to send Telegram message to ${chatId}: ${err}`);
    }
  }

  handleUpdate(update: any): void {
    const msg = update?.message;
    if (!msg?.text) return;
    const chatId = msg.chat.id;
    const text = (msg.text as string).trim();

    if (text === '/start') {
      void this.sendMessage(
        chatId,
        `Добро пожаловать в <b>Прозрачная Цена</b>!\n\nЭтот бот отправляет уведомления о ваших сделках и лотах.\n\nВаш Chat ID: <code>${chatId}</code>`,
      );
    } else if (text === '/id') {
      void this.sendMessage(chatId, `Ваш Chat ID: <code>${chatId}</code>`);
    }
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
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => {
            try {
              resolve(JSON.parse(data));
            } catch {
              resolve(data);
            }
          });
        },
      );
      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }
}
