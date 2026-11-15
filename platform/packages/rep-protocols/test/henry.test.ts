import { describe, expect, it } from 'vitest';
import { decodeHenry, encodeHenry, henryDateTime, henryEmployer, henryEventsToAfd, henryUser, henryUserResult, parseAfd, parseHenryEvents, parseHenryUsers } from '../src/index.ts';

describe('Henry protocolo 8x', () => {
  it('monta o quadro: start, tamanho little-endian, índice, checksum XOR a partir do tamanho e end', () => {
    const f = encodeHenry(7, 'RH');
    const body = '07+RH+00';
    expect(f[0]).toBe(0x02);
    expect(f.readUInt16LE(1)).toBe(body.length);
    expect(f.subarray(3, 3 + body.length).toString('latin1')).toBe(body);
    const cs = [...f.subarray(1, 3 + body.length)].reduce((a, b) => a ^ b, 0);
    expect(f[3 + body.length]).toBe(cs);
    expect(f.at(-1)).toBe(0x03);
  });

  it('lê quadros em pedaços, descarta lixo e confere checksum', () => {
    const a = encodeHenry(1, 'RH', '24/06/10 16:35:15]00/00/00]00/00/00');
    const b = encodeHenry(2, 'EH');
    const all = Buffer.concat([Buffer.from([0xff, 0x00]), a, b]);
    const p1 = decodeHenry(all.subarray(0, 10));
    expect(p1.frames).toHaveLength(0);
    const p2 = decodeHenry(all);
    expect(p2.frames.map((f) => `${f.index}:${f.command}:${f.code}`)).toEqual(['01:RH:00', '02:EH:00']);
    expect(p2.frames[0]!.data).toBe('24/06/10 16:35:15]00/00/00]00/00/00');
    const bad = Buffer.from(a); bad[bad.length - 2] = bad[bad.length - 2]! ^ 1;
    expect(() => decodeHenry(bad)).toThrow(/Checksum/);
    // Pacote maior que 255 bytes (tamanho em dois bytes).
    const big = encodeHenry(3, 'EU', `1+I[52998224725[${'A'.repeat(90)}[[0[`.repeat(4));
    expect(decodeHenry(big).frames[0]!.data.length).toBeGreaterThan(255);
  });

  it('comandos: data/hora, empregador, usuário e resultado por usuário', () => {
    expect(henryDateTime({ year: 2026, month: 11, day: 3, hour: 7, minute: 5, second: 9 })).toBe('03/11/26 07:05:09]00/00/00]00/00/00');
    expect(henryEmployer({ id: '12.345.678/0001-95', name: 'Clínica+Vida', location: 'Sede]Centro' })).toBe(']12345678000195]]Clinica Vida]Sede Centro');
    expect(henryUser('I', '52998224725', 'JOÃO PEREIRA')).toBe('1+I[52998224725[JOAO PEREIRA[[0[');
    expect(henryUser('E', '52998224725')).toBe('1+E[52998224725[[[0[');
    expect(henryUserResult('2+00]22')).toEqual(['00', '22']);
  });

  it('eventos viram linhas de AFD que o leitor oficial aceita', () => {
    const data = '3+1[0[52998224725[03/11/2026 07:58:10[1[0[5[0]2[0[52998224725[03/11/2026 12:01:00[2[0[5[0]3[83[0[03/11/2026 12:02:00[0[0[0[0';
    const ev = parseHenryEvents(data);
    expect(ev.map((e) => e.id)).toEqual([1, 2, 3]);
    const afd = henryEventsToAfd(ev, '671');
    const r = parseAfd(afd);
    expect(r.records.map((x) => x.nsr)).toEqual([1, 2]); // evento sem matrícula fica de fora
    expect(r.records[0]).toMatchObject({ kind: 'punch', workerId: '52998224725' });
    expect(parseAfd(henryEventsToAfd(ev, '1510')).records).toHaveLength(2);
    expect(parseHenryUsers('1+123456789012[Eduardo[[2[1535}6587')).toEqual([{ id: '123456789012', name: 'Eduardo', cards: ['1535', '6587'] }]);
  });
});
