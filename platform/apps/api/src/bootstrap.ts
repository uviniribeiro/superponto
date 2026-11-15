import 'reflect-metadata';
import { StandardSchemaValidationPipe, type INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { AppConfig } from './config.js';

/** Configuração comum à aplicação real e aos testes. */
export function configureApp(app: INestApplication, config: AppConfig) {
  // AFD, planilhas de importação e logos passam do limite padrão do Express (100 KB).
  const express = app as INestApplication & { useBodyParser?: (type: string, opts: { limit: string }) => void };
  express.useBodyParser?.('json', { limit: '25mb' });
  app.useGlobalPipes(new StandardSchemaValidationPipe());
  const origins = [config.APP_URL, ...config.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)];
  app.enableCors({ origin: origins, credentials: true });
  const maybeCsrf = (app as unknown as { enableCsrfProtection?: (o: unknown) => void }).enableCsrfProtection;
  if (typeof maybeCsrf === 'function') maybeCsrf.call(app, { trustedOrigins: origins });
  app.enableShutdownHooks();

  const doc = new DocumentBuilder()
    .setTitle('SuperPonto API')
    .setDescription('Plataforma de gestão de pessoas, jornadas, ponto e equipamentos')
    .setVersion('2.0.0-alpha')
    .addBearerAuth()
    .addCookieAuth('__Host-sid')
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, doc));
}
