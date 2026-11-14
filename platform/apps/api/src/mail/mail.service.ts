import { Inject, Injectable, Logger } from '@nestjs/common';
import nodemailer, { type Transporter } from 'nodemailer';
import { APP_CONFIG, type AppConfig } from '../config.js';

export interface OutgoingMail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/** Envio de e-mail por SMTP. Em testes/desenvolvimento (`memory`), guarda as mensagens em memória. */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter | null;
  readonly outbox: OutgoingMail[] = [];

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {
    this.transporter =
      config.MAIL_TRANSPORT === 'smtp'
        ? nodemailer.createTransport({
            host: config.SMTP_HOST,
            port: config.SMTP_PORT,
            secure: config.SMTP_PORT === 465,
            auth: config.SMTP_USER ? { user: config.SMTP_USER, pass: config.SMTP_PASS } : undefined,
          })
        : null;
  }

  async send(mail: OutgoingMail): Promise<void> {
    if (!this.transporter) {
      this.outbox.push(mail);
      this.logger.log(`E-mail (memória) para ${mail.to}: ${mail.subject}`);
      return;
    }
    await this.transporter.sendMail({ from: this.config.MAIL_FROM, ...mail });
  }
}
