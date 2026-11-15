#!/usr/bin/env node
import { AgentApi } from './api.js';
import { DeviceRunner, StateStore, VERSION } from './agent.js';
import { createDriver, loadConfig } from './config.js';

const cfg = loadConfig();
const state = new StateStore(cfg.stateFile);
await state.load();
const runners = cfg.devices.map((d) => new DeviceRunner(d.id, new AgentApi(cfg.apiUrl, d.key), createDriver(d), state, (level, msg) => {
  const line = `${new Date().toISOString()} [${level}] ${d.id}: ${msg}`;
  if (level === 'error') console.error(line); else console.log(line);
}));
console.log(`SuperPonto agente ${VERSION}: ${runners.length} equipamento(s), API ${cfg.apiUrl}`);
const stop = () => { for (const r of runners) r.stop(); setTimeout(() => process.exit(0), 1000).unref(); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
await Promise.all(runners.map((r) => r.loop(cfg.intervalSeconds * 1000)));
