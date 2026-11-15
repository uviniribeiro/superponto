/**
 * Adaptador Control iD: traduz RepCommand em chamadas HTTP da API local dos equipamentos (*.fcgi).
 * Gera apenas as requisições (método, caminho, corpo); quem executa é o Servidor de Comunicação,
 * que faz o login (POST /login.fcgi → session) e anexa ?session=... a cada chamada.
 *
 * Família "Access" (iDAccess, iDFlex, iDFace, iDBlock): objetos `users` e `templates` via
 * create_objects/modify_objects/destroy_objects. Os REPs iDClass usam a mesma sessão; o envio de
 * empregador e funcionários neles está marcado como pendente de homologação em equipamento real.
 */
import type { AfdLayout } from './afd.ts';
import { localParts } from './time.ts';
import { assertEmployerFitsLayout, repName, validateEmployer, workerIdFor, type RepCommand, type RepEmployee } from './commands.ts';

export interface DeviceRequest {
  method: 'GET' | 'POST';
  path: string;
  body?: unknown;
  /** true enquanto o comando não foi validado em equipamento real */
  homologationPending?: boolean;
}

export interface ControlIdProfile {
  family: 'access' | 'rep';
  layout: AfdLayout;
}

/** Id numérico estável do usuário no equipamento, derivado do identificador legal. */
function deviceUserId(layout: AfdLayout, e: RepEmployee) {
  return Number(workerIdFor(layout, e).value.slice(-9));
}

export function controlIdRequests(cmd: RepCommand, profile: ControlIdProfile): DeviceRequest[] {
  const { layout, family } = profile;
  switch (cmd.type) {
    case 'SET_CLOCK': {
      const d = localParts(cmd.at, cmd.timeZone);
      return [{ method: 'POST', path: '/set_system_time.fcgi', body: { day: d.day, month: d.month, year: d.year, hour: d.hour, minute: d.minute, second: d.second } }];
    }
    case 'FETCH_AFD':
      return [{ method: 'GET', path: `/get_afd.fcgi?mode=${layout}${cmd.fromNsr ? `&initial_nsr=${cmd.fromNsr}` : ''}` }];
    case 'SET_EMPLOYER': {
      const e = validateEmployer(cmd.employer);
      assertEmployerFitsLayout(layout, e);
      if (family !== 'rep') return []; // equipamentos de acesso não guardam empregador
      return [{
        method: 'POST', path: '/set_employer.fcgi', homologationPending: true,
        body: { employer: { document_type: e.idType === 'CNPJ' ? 1 : 2, document: e.id, cei: e.secondaryId ?? '', name: e.name.slice(0, 150), address: e.location.slice(0, 100) } },
      }];
    }
    case 'UPSERT_EMPLOYEE': {
      const wid = workerIdFor(layout, cmd.employee);
      const name = repName(cmd.employee.name);
      if (family === 'rep') {
        return [{ method: 'POST', path: '/add_users.fcgi', homologationPending: true, body: { users: [{ name, [wid.type === 'PIS' ? 'pis' : 'cpf']: Number(wid.value), registration: cmd.employee.registration ?? '', rfid: cmd.employee.card ? Number(cmd.employee.card) : 0 }] } }];
      }
      const id = deviceUserId(layout, cmd.employee);
      return [
        { method: 'POST', path: '/destroy_objects.fcgi', body: { object: 'users', where: { users: { id } } } },
        { method: 'POST', path: '/create_objects.fcgi', body: { object: 'users', values: [{ id, name, registration: cmd.employee.registration ?? String(id) }] } },
      ];
    }
    case 'DELETE_EMPLOYEE': {
      const wid = workerIdFor(layout, cmd.employee);
      if (family === 'rep') return [{ method: 'POST', path: '/remove_users.fcgi', homologationPending: true, body: { users: [Number(wid.value)] } }];
      return [{ method: 'POST', path: '/destroy_objects.fcgi', body: { object: 'users', where: { users: { id: deviceUserId(layout, cmd.employee) } } } }];
    }
    case 'UPSERT_FINGERPRINT': {
      if (cmd.fingerprint.format !== 'CONTROLID' && cmd.fingerprint.format !== 'ISO_19794_2') {
        throw new Error(`Formato de digital ${cmd.fingerprint.format} não é aceito por equipamentos Control iD`);
      }
      const id = deviceUserId(layout, cmd.employee);
      return [{ method: 'POST', path: '/create_objects.fcgi', homologationPending: family === 'rep', body: { object: 'templates', values: [{ user_id: id, finger_type: cmd.fingerprint.finger, template: cmd.fingerprint.template }] } }];
    }
    case 'DELETE_FINGERPRINTS':
      return [{ method: 'POST', path: '/destroy_objects.fcgi', homologationPending: family === 'rep', body: { object: 'templates', where: { templates: { user_id: deviceUserId(layout, cmd.employee) } } } }];
  }
}
