import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { createAppModule } from './app.module.js';
import { configureApp } from './bootstrap.js';
import { loadConfig } from './config.js';

const config = loadConfig();
const app = await NestFactory.create<NestExpressApplication>(createAppModule(config), { bufferLogs: false });
app.set('trust proxy', 1);
configureApp(app, config);
await app.listen(config.PORT);
console.log(`SuperPonto API em ${config.API_URL} (docs em /docs)`);
