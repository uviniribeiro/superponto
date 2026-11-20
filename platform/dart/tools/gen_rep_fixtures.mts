// Fixtures de paridade dos protocolos (TS -> Dart). Uso: node --experimental-strip-types tools/gen_rep_fixtures.mts
import { writeFileSync } from 'node:fs';
import { afdHeader671, afdRecord7, afdTrailer671, controlIdRequests, crc16, encodeHenry, henryEventsToAfd, henryUser, parseAfd, parseHenryEvents } from '../../packages/rep-protocols/src/index.ts';

let seed = 77;
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const int = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
const L = (v: string | number, n: number) => String(v).padStart(n, '0').slice(-n);
const R = (v: string, n: number) => v.padEnd(n, ' ').slice(0, n);
const pad = (n: number) => String(n).padStart(2, '0');

const files: string[] = [];
for (let f = 0; f < 120; f++) {
  const is671 = rnd() < 0.5;
  const lines: string[] = [];
  if (rnd() < 0.7) lines.push(is671
    ? L(0, 9) + '1' + '1' + R('11222333000181', 14) + R('', 14) + R('EMPRESA TESTE ' + f, 150) + R('00004000020000123', 17) + '2026-11-01' + '2026-11-30' + '2026-12-01T08:00:00-0300' + '003' + '1' + '11222333000181' + R('MODELO X', 30) + 'ABCD'
    : L(0, 9) + '1' + '1' + R('11222333000181', 14) + R('', 12) + R('EMPRESA TESTE ' + f, 150) + R('00004000020000123', 17) + '01112026' + '30112026' + '0112202608001');
  let nsr = 0;
  for (let i = 0; i < int(1, 25); i++) {
    nsr += rnd() < 0.1 ? int(2, 3) : rnd() < 0.05 ? 0 : 1;
    const d = int(1, 28), h = int(0, 23), m = int(0, 59);
    const kind = rnd();
    if (is671) {
      const dt = `2026-11-${pad(d)}T${pad(h)}:${pad(m)}:00-0300`;
      if (kind < 0.6) lines.push(L(nsr, 9) + '3' + dt + L('52998224725', 12) + 'A1B2');
      else if (kind < 0.75) lines.push(L(nsr, 9) + '7' + dt + L('11144477735', 12) + `2026-11-${pad(d)}T${pad(h)}:${pad(m)}:05-0300` + '02' + '0' + 'a'.repeat(64));
      else if (kind < 0.85) lines.push(L(nsr, 9) + '5' + dt + 'I' + L('52998224725', 12) + R('JOAO PEREIRA', 52) + R('', 4) + '52998224725' + 'FFFF');
      else if (kind < 0.92) lines.push(L(nsr, 9) + '6' + dt + '02');
      else lines.push(L(nsr, 9) + '3' + '2026-13-99T99:99:00-0300' + L('1', 12));
    } else {
      const dt = `${pad(d)}112026${pad(h)}${pad(m)}`;
      if (kind < 0.7) lines.push(L(nsr, 9) + '3' + dt + L('12056462127', 12));
      else if (kind < 0.85) lines.push(L(nsr, 9) + '5' + dt + 'I' + L('12056462127', 12) + R('MARIA SILVA', 52));
      else if (kind < 0.92) lines.push(L(nsr, 9) + '4' + dt + `${pad(d)}112026${pad(h)}${pad(int(0, 59))}`);
      else lines.push(L(nsr, 9) + '3' + '99999999' + '9999' + L('1', 12));
    }
  }
  if (rnd() < 0.5) lines.push('999999999' + L(0, 9) + L(int(0, 20), 9) + L(0, 9) + L(0, 9) + (is671 ? L(0, 9) + L(0, 9) : '') + '9');
  files.push(lines.join(rnd() < 0.5 ? '\r\n' : '\n'));
}
const parsed = files.map((c) => { const r = parseAfd(c); return { layout: r.layout, header: r.header, records: r.records.map((x) => JSON.parse(JSON.stringify(x))), trailer: r.trailer, warnings: r.warnings }; });

const writer = [];
let prev: string | null = null;
for (let i = 1; i <= 30; i++) {
  const at = new Date(Date.UTC(2026, 10, int(1, 28), int(0, 23), int(0, 59), int(0, 59)));
  const r = afdRecord7({ nsr: i, at, cpf: '52998224725', recordedAt: at, collector: rnd() < 0.5 ? '01' : '02', offline: rnd() < 0.2 }, prev);
  writer.push({ nsr: i, at: at.toISOString(), collector: r.line.slice(70, 72), offline: r.line[72] === '1', prev, line: r.line, hash: r.hash });
  prev = r.hash;
}
const header = afdHeader671({ employerIdType: 'CNPJ', employerId: '11.222.333/0001-81', employerName: 'Clínica Vida Ltda', repId: '12345678901234567', periodStart: '2026-11-01', periodEnd: '2026-11-30', generatedAt: new Date('2026-12-01T11:00:00Z'), developerId: '11222333000181', model: 'SuperPonto' });
const henry = [encodeHenry(7, 'RH'), encodeHenry(42, 'EU', henryUser('I', '52998224725', 'JOÃO PEREIRA')), encodeHenry(3, 'RR', 'T]50]1')].map((b) => [...b]);
const events = parseHenryEvents('3+1[0[52998224725[03/11/2026 07:58:10[1[0[5[0]2[0[52998224725[03/11/2026 12:01:00[2[0[5[0]3[83[0[03/11/2026 12:02:00[0[0[0[0');
const cid = [
  controlIdRequests({ type: 'SET_CLOCK', at: new Date('2026-11-03T10:00:05Z'), timeZone: 'America/Sao_Paulo' }, { family: 'rep', layout: '671' }),
  controlIdRequests({ type: 'FETCH_AFD', fromNsr: 5 }, { family: 'rep', layout: '1510' }),
  controlIdRequests({ type: 'UPSERT_EMPLOYEE', employee: { employmentId: '', name: 'JOÃO PEREIRA', cpf: '52998224725', registration: '10' } }, { family: 'rep', layout: '671' }),
  controlIdRequests({ type: 'UPSERT_EMPLOYEE', employee: { employmentId: '', name: 'Ana', pis: '12056462127', registration: '7' } }, { family: 'access', layout: '1510' }),
];
writeFileSync(new URL('../packages/sp_core/test/fixtures/rep_cases.json', import.meta.url), JSON.stringify({ files, parsed, writer, header, crc: crc16('123456789'), trailer: afdTrailer671({ '7': 30 }), henry, henryAfd671: henryEventsToAfd(events, '671'), henryAfd1510: henryEventsToAfd(events, '1510'), cid }));
console.log(files.length, 'arquivos AFD');
