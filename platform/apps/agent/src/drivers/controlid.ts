import { controlIdRequests, type AfdLayout, type RepCommand, type RepEmployee } from '@superponto/rep-protocols';
import { deviceRequest, type HttpTarget } from './http.js';
import { UnsupportedError, type DeviceDriver, type DeviceFingerprint, type EmployeeData, type EmployerData, type FingerprintData, type RosterEntry } from './types.js';

export interface ControlIdOptions extends HttpTarget {
  login: string;
  password: string;
  /** "rep" = REP iDClass (Portaria 671/1510); "access" = iDAccess/iDFlex/iDFace */
  family: 'rep' | 'access';
}

const toRepEmployee = (e: EmployeeData): RepEmployee => ({ employmentId: '', name: e.name, registration: e.registration ?? null, ...(e.worker.type === 'PIS' ? { pis: e.worker.value } : { cpf: e.worker.value }) });

/**
 * Control iD pela API local do equipamento (HTTP/JSON, *.fcgi): login → sessão → chamadas com
 * ?session=. Relógio de ponto, AFD e cadastro de usuários seguem a documentação pública da
 * Control iD; os comandos marcados como "homologação pendente" ainda não foram validados em REP real.
 */
export class ControlIdDriver implements DeviceDriver {
  readonly name = 'Control iD';
  private session: string | null = null;
  constructor(private readonly o: ControlIdOptions) {}

  private async login() {
    const r = await deviceRequest(this.o, 'POST', '/login.fcgi', { login: this.o.login, password: this.o.password });
    if (r.status !== 200) throw new Error(`Login no relógio recusado (HTTP ${r.status}): confira usuário e senha do equipamento`);
    const s = (JSON.parse(r.text) as { session?: string }).session;
    if (!s) throw new Error('Relógio não devolveu sessão');
    this.session = s;
  }

  /** Chamada autenticada; refaz o login uma vez se a sessão expirou. */
  async call(method: 'GET' | 'POST', path: string, body?: unknown, retry = true): Promise<{ status: number; text: string }> {
    if (!this.session) await this.login();
    const sep = path.includes('?') ? '&' : '?';
    const r = await deviceRequest(this.o, method, `${path}${sep}session=${encodeURIComponent(this.session!)}`, body);
    if ((r.status === 401 || r.status === 403) && retry) { this.session = null; return this.call(method, path, body, false); }
    if (r.status < 200 || r.status >= 300) throw new Error(`${path.split('?')[0]}: HTTP ${r.status} ${r.text.slice(0, 200)}`);
    return r;
  }

  private async run(cmd: RepCommand, layout: AfdLayout) {
    for (const req of controlIdRequests(cmd, { family: this.o.family, layout })) await this.call(req.method, req.path, req.body);
  }

  setClock(at: Date, timeZone: string) { return this.run({ type: 'SET_CLOCK', at, timeZone }, '671'); }
  setEmployer(e: EmployerData, layout: AfdLayout) { return this.run({ type: 'SET_EMPLOYER', employer: e }, layout); }
  upsertEmployee(e: EmployeeData, layout: AfdLayout) { return this.run({ type: 'UPSERT_EMPLOYEE', employee: toRepEmployee(e) }, layout); }
  deleteEmployee(e: EmployeeData, layout: AfdLayout) { return this.run({ type: 'DELETE_EMPLOYEE', employee: toRepEmployee(e) }, layout); }
  upsertFingerprint(f: FingerprintData, layout: AfdLayout) {
    return this.run({ type: 'UPSERT_FINGERPRINT', employee: toRepEmployee(f), fingerprint: { employmentId: '', finger: f.finger, format: f.format as never, template: f.template } }, layout);
  }
  deleteFingerprints(e: EmployeeData, layout: AfdLayout) { return this.run({ type: 'DELETE_FINGERPRINTS', employee: toRepEmployee(e) }, layout); }

  async readEmployees(layout: AfdLayout): Promise<RosterEntry[]> {
    if (this.o.family === 'rep') {
      // REP iDClass: load_users.fcgi (homologação pendente).
      const r = await this.call('POST', '/load_users.fcgi', { limit: 20000, offset: 0 });
      const users = (JSON.parse(r.text) as { users?: Array<{ name?: string; pis?: number; cpf?: number; registration?: string; templates_count?: number }> }).users ?? [];
      return users.map((u) => ({ workerId: String((layout === '1510' ? u.pis : u.cpf) ?? u.cpf ?? u.pis ?? '').padStart(11, '0'), name: u.name, registration: u.registration, fingerprints: u.templates_count })).filter((u) => /^\d{11,12}$/.test(u.workerId));
    }
    const r = await this.call('POST', '/load_objects.fcgi', { object: 'users' });
    const users = (JSON.parse(r.text) as { users?: Array<{ id: number; name?: string; registration?: string }> }).users ?? [];
    return users.map((u) => ({ workerId: String(u.id).padStart(11, '0'), name: u.name, registration: u.registration }));
  }

  async readFingerprints(): Promise<DeviceFingerprint[]> {
    if (this.o.family === 'rep') throw new UnsupportedError('Leitura de digitais do REP iDClass ainda não homologada');
    const r = await this.call('POST', '/load_objects.fcgi', { object: 'templates' });
    const list = (JSON.parse(r.text) as { templates?: Array<{ user_id: number; finger_type?: number; template: string }> }).templates ?? [];
    return list.map((t) => ({ workerId: String(t.user_id).padStart(11, '0'), finger: Math.min(9, Math.max(0, t.finger_type ?? 0)), format: 'CONTROLID', template: t.template }));
  }

  async readEmployer(): Promise<{ cnpj: string; name?: string }> {
    throw new UnsupportedError('Leitura do empregador gravado no Control iD ainda não homologada: confira no visor do relógio');
  }

  async fetchAfd(layout: AfdLayout, sinceNsr: number) {
    const [req] = controlIdRequests({ type: 'FETCH_AFD', fromNsr: sinceNsr > 0 ? sinceNsr + 1 : undefined }, { family: this.o.family, layout });
    return (await this.call(req!.method, req!.path)).text;
  }
}
