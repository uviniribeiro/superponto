import { readFileSync } from 'node:fs';
import { ControlIdDriver } from './drivers/controlid.js';
import { SimulatorDriver } from './drivers/simulator.js';
import type { DeviceDriver } from './drivers/types.js';

export interface DeviceEntry {
  /** nome livre só para os logs */
  id: string;
  /** chave do equipamento (spd_...), gerada na tela Equipamentos */
  key: string;
  driver: 'controlid' | 'simulator';
  host?: string;
  port?: number;
  https?: boolean;
  insecureTls?: boolean;
  login?: string;
  password?: string;
  family?: 'rep' | 'access';
}
export interface AgentConfig { apiUrl: string; stateFile: string | null; intervalSeconds: number; devices: DeviceEntry[] }

/**
 * Configuração: arquivo JSON (SUPERPONTO_AGENT_CONFIG) ou variáveis de ambiente para um equipamento só.
 * O endereço da API vem da instalação (nunca fixo no código).
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AgentConfig {
  const file = env.SUPERPONTO_AGENT_CONFIG;
  const raw: Partial<AgentConfig> = file ? JSON.parse(readFileSync(file, 'utf8')) : {
    apiUrl: env.SUPERPONTO_API_URL,
    devices: env.SUPERPONTO_DEVICE_KEY ? [{
      id: env.SUPERPONTO_DEVICE_NAME ?? 'relogio', key: env.SUPERPONTO_DEVICE_KEY, driver: (env.SUPERPONTO_DRIVER ?? 'controlid') as DeviceEntry['driver'],
      host: env.SUPERPONTO_DEVICE_HOST, port: env.SUPERPONTO_DEVICE_PORT ? Number(env.SUPERPONTO_DEVICE_PORT) : undefined,
      https: env.SUPERPONTO_DEVICE_HTTPS !== 'false', insecureTls: env.SUPERPONTO_DEVICE_INSECURE_TLS !== 'false',
      login: env.SUPERPONTO_DEVICE_LOGIN, password: env.SUPERPONTO_DEVICE_PASSWORD, family: (env.SUPERPONTO_DEVICE_FAMILY ?? 'rep') as DeviceEntry['family'],
    }] : [],
  };
  const apiUrl = raw.apiUrl ?? env.SUPERPONTO_API_URL;
  if (!apiUrl || !/^https?:\/\//.test(apiUrl)) throw new Error('Informe o endereço da API (SUPERPONTO_API_URL ou "apiUrl" no arquivo)');
  if (/^http:\/\//.test(apiUrl) && !/^http:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(apiUrl)) throw new Error('A API precisa ser HTTPS (http só para localhost)');
  const devices = raw.devices ?? [];
  if (!devices.length) throw new Error('Nenhum equipamento configurado');
  for (const d of devices) {
    if (!/^spd_[A-Za-z0-9_-]{20,}$/.test(d.key ?? '')) throw new Error(`${d.id}: chave do equipamento inválida (gere em Equipamentos → Agente local)`);
    if (d.driver === 'controlid' && (!d.host || !d.login || !d.password)) throw new Error(`${d.id}: Control iD precisa de host, login e password`);
  }
  return { apiUrl, stateFile: raw.stateFile ?? env.SUPERPONTO_AGENT_STATE ?? 'superponto-agent-state.json', intervalSeconds: Math.max(10, raw.intervalSeconds ?? 30), devices };
}

export function createDriver(d: DeviceEntry): DeviceDriver {
  if (d.driver === 'simulator') return new SimulatorDriver();
  if (d.driver === 'controlid') {
    const https = d.https ?? true;
    return new ControlIdDriver({ host: d.host!, port: d.port ?? (https ? 443 : 80), https, insecureTls: d.insecureTls ?? true, timeoutMs: 30_000, login: d.login!, password: d.password!, family: d.family ?? 'rep' });
  }
  throw new Error(`Driver desconhecido: ${String(d.driver)}`);
}
