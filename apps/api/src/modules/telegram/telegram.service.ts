import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import * as https from 'https';

@Injectable()
export class TelegramService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(TelegramService.name);
  private readonly token = process.env.TELEGRAM_BOT_TOKEN;
  private polling = false;
  private offset = 0;

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
            try {
              resolve(JSON.parse(data));
            } catch {
              resolve(data);
            }
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
