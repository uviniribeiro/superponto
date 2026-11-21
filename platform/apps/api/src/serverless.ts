// Entrada da API como função da Vercel: a mesma aplicação Nest de main.ts, iniciada uma vez por
// instância e reaproveitada entre as requisições. Tarefas em segundo plano (feriados, alertas) rodam
// enquanto a instância está viva; no servidor próprio (Docker) elas rodam sem interrupção.
import 'reflect-metadata';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter, type NestExpressApplication } from '@nestjs/platform-express';
import express from 'express';
import { createAppModule } from './app.module.js';
import { configureApp } from './bootstrap.js';
import { loadConfig } from './config.js';

type Handler = (req: IncomingMessage, res: ServerResponse) => void;
let ready: Promise<Handler> | null = null;

async function init(): Promise<Handler> {
  const config = loadConfig();
  const server = express();
  const app = await NestFactory.create<NestExpressApplication>(createAppModule(config), new ExpressAdapter(server), { bufferLogs: false });
  app.set('trust proxy', 1);
  configureApp(app, config);
  await app.init();
  return server as unknown as Handler;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  ready ??= init().catch((e) => { ready = null; throw e; });
  (await ready)(req, res);
}
