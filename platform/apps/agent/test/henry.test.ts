// Driver Henry contra um equipamento falso que fala o protocolo 8x por TCP.
import net from 'node:net';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { decodeHenry, encodeHenry, parseAfd } from '@superponto/rep-protocols';
import { HenryDriver } from '../src/drivers/henry.js';

const users = new Map<string, string>();
const fps = new Map<string, string>();
let employer = '';
let clock = '';
const events: string[] = [];
for (let i = 1; i <= 120; i++) events.push(`${i}[${i % 40 === 0 ? '83' : '0'}[52998224725[03/11/2026 ${String(7 + (i % 10)).padStart(2, '0')}:00:00[1[0[5[0`);

function reply(cmd: string, data: string): [string, string] {
  switch (cmd) {
    case 'EH': clock = data; return ['00', ''];
    case 'RH': return ['00', clock];
    case 'EE': employer = data; return ['00', ''];
    case 'RE': return employer ? ['00', employer] : ['20', ''];
    case 'EU': {
      const [, op, id, name] = /^1\+([IAE])\[(\d+)\[([^[]*)/.exec(data) ?? [];
      if (op === 'I' && users.has(id!)) return ['00', '1+23'];
      if (op === 'E' && !users.has(id!)) return ['00', '1+22'];
      if (op === 'E') users.delete(id!); else users.set(id!, name!);
      return ['00', '1+00'];
    }
    case 'RU': {
      const [n, start] = data.split(']').map(Number) as [number, number];
      const list = [...users].slice(start, start + n);
      return list.length ? ['00', `${list.length}+${list.map(([k, v]) => `${k}[${v}[[0[`).join(']')}`] : ['01', ''];
    }
    case 'ED': {
      if (data.startsWith('D]')) { const id = data.slice(2).split('}')[0]!; if (!users.has(id)) return ['22', '']; fps.set(id, data.slice(2)); }
      if (data.startsWith('E]')) fps.delete(data.slice(2));
      return ['00', ''];
    }
    case 'RD': {
      if (data.startsWith('L]')) return fps.size ? ['00', `${fps.size}+${[...fps.keys()].join(']')}`] : ['01', ''];
      const id = data.slice(2);
      return fps.has(id) ? ['00', `D]${fps.get(id)}`] : ['26', ''];
    }
    case 'RR': {
      const [, n, start] = data.split(']');
      const list = events.filter((e) => Number(e.split('[')[0]) >= Number(start)).slice(0, Number(n));
      return list.length ? ['00', `${list.length}+${list.join(']')}`] : ['01', ''];
    }
    default: return ['10', ''];
  }
}

const server = net.createServer((sock) => {
  let buf: Buffer = Buffer.alloc(0);
  // Evento online no começo da conexão: o driver deve ignorar.
  sock.write(encodeHenry(42, 'REON', '0]00000001]03/11/2026 08:57:01]1]0]5'));
  sock.on('data', (c: Buffer) => {
    buf = Buffer.concat([buf, c]);
    const { frames, rest } = decodeHenry(buf);
    buf = rest;
    for (const f of frames) {
      const [code, data] = reply(f.command, f.data);
      const out = encodeHenry(Number(f.index), f.command, data, code);
      // Entrega em dois pedaços para testar a remontagem.
      sock.write(out.subarray(0, 5)); setTimeout(() => sock.write(out.subarray(5)), 5);
    }
  });
});
let port = 0;
beforeAll(async () => { await new Promise<void>((r) => server.listen(0, '127.0.0.1', r)); port = (server.address() as AddressInfo).port; });
afterAll(() => new Promise<void>((r) => server.close(() => r())));

const drv = () => new HenryDriver({ host: '127.0.0.1', port, timeoutMs: 3000, timeZone: 'America/Sao_Paulo', batch: 50 });
const emp = { worker: { type: 'CPF' as const, value: '52998224725' }, name: 'JOÃO PEREIRA', registration: '10' };

describe('Driver Henry (protocolo 8x)', () => {
  it('hora local e empregador', async () => {
    const d = drv();
    await d.setClock(new Date('2026-11-03T10:00:05Z'), 'America/Sao_Paulo');
    expect(clock).toBe('03/11/26 07:00:05]00/00/00]00/00/00');
    await d.setEmployer({ idType: 'CNPJ', id: '11222333000181', name: 'Clínica Vida', location: 'Sede' });
    expect(await d.readEmployer()).toEqual({ cnpj: '11222333000181', name: 'Clinica Vida' });
  });

  it('usuário: inclui, já existente vira alteração, lista e exclui (inexistente não é erro)', async () => {
    const d = drv();
    await d.upsertEmployee(emp);
    await d.upsertEmployee({ ...emp, name: 'JOAO P' });
    expect(users.get('52998224725')).toBe('JOAO P');
    expect(await d.readEmployees()).toEqual([{ workerId: '52998224725', name: 'JOAO P' }]);
    await d.deleteEmployee(emp);
    await d.deleteEmployee(emp);
    expect(users.size).toBe(0);
  });

  it('digitais só no formato Henry; leitura volta em base64', async () => {
    const d = drv();
    await d.upsertEmployee(emp);
    await expect(d.upsertFingerprint({ ...emp, finger: 1, format: 'ISO_19794_2', template: 'x' })).rejects.toThrow(/formato/);
    await d.upsertFingerprint({ ...emp, finger: 1, format: 'HENRY', template: Buffer.from('T'.repeat(384)).toString('base64') });
    const fp = await d.readFingerprints();
    expect(fp).toHaveLength(1);
    expect(Buffer.from(fp[0]!.template, 'base64').toString()).toBe('T'.repeat(384));
    await d.deleteFingerprints(emp);
    expect(fps.size).toBe(0);
  });

  it('coleta em lotes a partir do NSR, ignora estados de catraca e gera AFD válido', async () => {
    const d = drv();
    const all = parseAfd(await d.fetchAfd('671', 0)).records;
    expect(all).toHaveLength(117); // 120 eventos menos 3 com código 83
    expect(all[0]).toMatchObject({ nsr: 1, workerId: '52998224725' });
    const tail = parseAfd(await d.fetchAfd('671', 100)).records;
    expect(tail.map((r) => r.nsr)).toEqual([101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119]);
    expect(await d.fetchAfd('671', 120)).toBe('');
  });

  it('erro do equipamento vira mensagem clara; sem resposta vira tempo esgotado', async () => {
    await expect(drv().request('XX')).resolves.toMatchObject({ code: '10' });
    const dead = new HenryDriver({ host: '127.0.0.1', port: 1, timeoutMs: 500 });
    await expect(dead.setClock(new Date(), 'America/Sao_Paulo')).rejects.toThrow(/Henry 127.0.0.1:1/);
  });
});
