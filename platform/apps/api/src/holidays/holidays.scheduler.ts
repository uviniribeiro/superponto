import { Inject, Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../config.js';
import { HolidaysService } from './holidays.service.js';

const SIX_HOURS = 6 * 60 * 60 * 1000;

/**
 * Cadastro automático de feriados: na subida da API e a cada 6 horas garante o ano corrente e o
 * seguinte. Assim, no dia 01/01 o novo ano já está cadastrado (é gerado com antecedência) e, se o
 * servidor estiver desligado na virada, ele completa assim que voltar. A geração é idempotente.
 */
@Injectable()
export class HolidaysScheduler implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly log = new Logger('Feriados');
  private timer?: NodeJS.Timeout;
  constructor(private readonly holidays: HolidaysService, @Inject(APP_CONFIG) private readonly config: AppConfig) {}

  onApplicationBootstrap() {
    if (this.config.NODE_ENV === 'test') return;
    const run = () => this.holidays.ensureUpcoming().catch((e: Error) => this.log.error(`Falha ao gerar feriados: ${e.message}`));
    void run();
    this.timer = setInterval(run, SIX_HOURS);
    this.timer.unref();
  }

  onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
  }
}
