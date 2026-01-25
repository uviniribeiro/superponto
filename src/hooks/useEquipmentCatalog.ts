// Complete catalog of time clock equipment approved by Brazilian Ministry of Labor
// Following Portarias 373, 1510, and 671

export interface EquipmentModel {
  value: string;
  label: string;
  port: number;
  protocol: 'http' | 'https';
  endpoint: string;
  portaria: 'portaria_671' | 'portaria_1510' | 'portaria_373';
  repType?: 'REP-P' | 'REP-A' | 'REP-C' | 'REP';
  hasWebservice: boolean;
  hasFacialRecognition?: boolean;
  hasBiometric?: boolean;
  hasRFID?: boolean;
  hasQRCode?: boolean;
}

export interface EquipmentManufacturer {
  manufacturer: string;
  label: string;
  country: string;
  website?: string;
  models: EquipmentModel[];
}

// Complete MTE-approved equipment catalog
export const EQUIPMENT_CATALOG_FULL: EquipmentManufacturer[] = [
  // HENRY - Brazilian manufacturer
  {
    manufacturer: 'henry',
    label: 'Henry',
    country: 'Brasil',
    website: 'https://www.henry.com.br',
    models: [
      { value: 'prisma_super_facil', label: 'Prisma Super Fácil', port: 80, protocol: 'http', endpoint: '/iDClass/SyncDataService.svc', portaria: 'portaria_671', repType: 'REP-P', hasWebservice: true, hasBiometric: true, hasRFID: true },
      { value: 'prisma_super_facil_adv', label: 'Prisma Super Fácil ADV', port: 80, protocol: 'http', endpoint: '/iDClass/SyncDataService.svc', portaria: 'portaria_671', repType: 'REP-P', hasWebservice: true, hasFacialRecognition: true, hasBiometric: true },
      { value: 'orion_6', label: 'Orion 6', port: 80, protocol: 'http', endpoint: '/iDClass/SyncDataService.svc', portaria: 'portaria_671', repType: 'REP-P', hasWebservice: true, hasBiometric: true },
      { value: 'orion_7', label: 'Orion 7', port: 80, protocol: 'http', endpoint: '/iDClass/SyncDataService.svc', portaria: 'portaria_671', repType: 'REP-P', hasWebservice: true, hasFacialRecognition: true },
      { value: 'hexa', label: 'Hexa', port: 80, protocol: 'http', endpoint: '/iDClass/SyncDataService.svc', portaria: 'portaria_1510', repType: 'REP', hasWebservice: true, hasBiometric: true },
      { value: 'hexa_adv', label: 'Hexa ADV', port: 80, protocol: 'http', endpoint: '/iDClass/SyncDataService.svc', portaria: 'portaria_671', repType: 'REP-P', hasWebservice: true, hasFacialRecognition: true },
      { value: 'primme', label: 'Primme', port: 80, protocol: 'http', endpoint: '/iDClass/SyncDataService.svc', portaria: 'portaria_1510', repType: 'REP', hasWebservice: true, hasBiometric: true },
      { value: 'primme_sf', label: 'Primme Super Fácil', port: 80, protocol: 'http', endpoint: '/iDClass/SyncDataService.svc', portaria: 'portaria_671', repType: 'REP-P', hasWebservice: true, hasBiometric: true },
      { value: 'vega', label: 'Vega', port: 80, protocol: 'http', endpoint: '/iDClass/SyncDataService.svc', portaria: 'portaria_671', repType: 'REP-P', hasWebservice: true, hasFacialRecognition: true },
    ],
  },
  // DIMEP - Brazilian manufacturer  
  {
    manufacturer: 'dimep',
    label: 'Dimep',
    country: 'Brasil',
    website: 'https://www.dimep.com.br',
    models: [
      { value: 'printpoint_iii', label: 'PrintPoint III', port: 80, protocol: 'http', endpoint: '/api/v1/records', portaria: 'portaria_1510', repType: 'REP', hasWebservice: true, hasBiometric: true },
      { value: 'smart_print', label: 'Smart Print', port: 80, protocol: 'http', endpoint: '/api/v1/records', portaria: 'portaria_671', repType: 'REP-P', hasWebservice: true, hasBiometric: true },
      { value: 'face_plus', label: 'FacePlus', port: 80, protocol: 'http', endpoint: '/api/v1/records', portaria: 'portaria_671', repType: 'REP-P', hasWebservice: true, hasFacialRecognition: true },
      { value: 'biopoint_ii', label: 'BioPoint II', port: 80, protocol: 'http', endpoint: '/api/v1/records', portaria: 'portaria_1510', repType: 'REP', hasWebservice: true, hasBiometric: true },
      { value: 'biopoint_iii', label: 'BioPoint III', port: 80, protocol: 'http', endpoint: '/api/v1/records', portaria: 'portaria_671', repType: 'REP-P', hasWebservice: true, hasBiometric: true },
      { value: 'd_face', label: 'D-Face', port: 80, protocol: 'http', endpoint: '/api/v1/records', portaria: 'portaria_671', repType: 'REP-P', hasWebservice: true, hasFacialRecognition: true },
      { value: 'miniprint', label: 'MiniPrint', port: 80, protocol: 'http', endpoint: '/api/v1/records', portaria: 'portaria_1510', repType: 'REP', hasWebservice: true, hasBiometric: true },
    ],
  },
  // CONTROL ID - Brazilian manufacturer
  {
    manufacturer: 'controlid',
    label: 'Control iD',
    country: 'Brasil',
    website: 'https://www.controlid.com.br',
    models: [
      { value: 'idclass', label: 'iDClass', port: 80, protocol: 'http', endpoint: '/api/v1/afd', portaria: 'portaria_1510', repType: 'REP', hasWebservice: true, hasBiometric: true },
      { value: 'idface', label: 'iDFace', port: 80, protocol: 'http', endpoint: '/api/v1/afd', portaria: 'portaria_671', repType: 'REP-P', hasWebservice: true, hasFacialRecognition: true },
      { value: 'idbox', label: 'iDBox', port: 80, protocol: 'http', endpoint: '/api/v1/afd', portaria: 'portaria_1510', repType: 'REP', hasWebservice: true, hasBiometric: true },
      { value: 'idflex', label: 'iDFlex', port: 80, protocol: 'http', endpoint: '/api/v1/afd', portaria: 'portaria_671', repType: 'REP-P', hasWebservice: true, hasBiometric: true, hasFacialRecognition: true },
      { value: 'idflex_pro', label: 'iDFlex Pro', port: 80, protocol: 'http', endpoint: '/api/v1/afd', portaria: 'portaria_671', repType: 'REP-P', hasWebservice: true, hasFacialRecognition: true },
      { value: 'idface_max', label: 'iDFace Max', port: 80, protocol: 'http', endpoint: '/api/v1/afd', portaria: 'portaria_671', repType: 'REP-P', hasWebservice: true, hasFacialRecognition: true },
      { value: 'idflex_lite', label: 'iDFlex Lite', port: 80, protocol: 'http', endpoint: '/api/v1/afd', portaria: 'portaria_671', repType: 'REP-P', hasWebservice: true, hasRFID: true, hasQRCode: true },
      { value: 'rep_idx', label: 'REP iDX', port: 80, protocol: 'http', endpoint: '/api/v1/afd', portaria: 'portaria_671', repType: 'REP-P', hasWebservice: true, hasBiometric: true },
    ],
  },
  // TOPDATA - Brazilian manufacturer
  {
    manufacturer: 'topdata',
    label: 'Topdata',
    country: 'Brasil',
    website: 'https://www.topdata.com.br',
    models: [
      { value: 'inner_rep', label: 'Inner Rep', port: 80, protocol: 'http', endpoint: '/inner/api', portaria: 'portaria_1510', repType: 'REP', hasWebservice: true, hasBiometric: true },
      { value: 'inner_rep_plus', label: 'Inner Rep Plus', port: 80, protocol: 'http', endpoint: '/inner/api', portaria: 'portaria_671', repType: 'REP-P', hasWebservice: true, hasBiometric: true },
      { value: 'inner_bio', label: 'Inner Bio', port: 80, protocol: 'http', endpoint: '/inner/api', portaria: 'portaria_671', repType: 'REP-P', hasWebservice: true, hasBiometric: true },
      { value: 'inner_acesso', label: 'Inner Acesso', port: 80, protocol: 'http', endpoint: '/inner/api', portaria: 'portaria_373', repType: 'REP-A', hasWebservice: true, hasRFID: true },
      { value: 'inner_face', label: 'Inner Face', port: 80, protocol: 'http', endpoint: '/inner/api', portaria: 'portaria_671', repType: 'REP-P', hasWebservice: true, hasFacialRecognition: true },
    ],
  },
  // MADIS - Brazilian manufacturer
  {
    manufacturer: 'madis',
    label: 'Madis',
    country: 'Brasil',
    website: 'https://www.madis.com.br',
    models: [
      { value: 'md_6705', label: 'MD 6705', port: 80, protocol: 'http', endpoint: '/api/records', portaria: 'portaria_1510', repType: 'REP', hasWebservice: true, hasBiometric: true },
      { value: 'md_6710', label: 'MD 6710', port: 80, protocol: 'http', endpoint: '/api/records', portaria: 'portaria_671', repType: 'REP-P', hasWebservice: true, hasBiometric: true },
      { value: 'md_faceid', label: 'MD FaceID', port: 80, protocol: 'http', endpoint: '/api/records', portaria: 'portaria_671', repType: 'REP-P', hasWebservice: true, hasFacialRecognition: true },
      { value: 'md_5711', label: 'MD 5711', port: 80, protocol: 'http', endpoint: '/api/records', portaria: 'portaria_1510', repType: 'REP', hasWebservice: true, hasBiometric: true },
      { value: 'md_x705', label: 'MD X705', port: 80, protocol: 'http', endpoint: '/api/records', portaria: 'portaria_671', repType: 'REP-P', hasWebservice: true, hasBiometric: true, hasFacialRecognition: true },
    ],
  },
  // SECULLUM - Brazilian manufacturer
  {
    manufacturer: 'secullum',
    label: 'Secullum',
    country: 'Brasil',
    website: 'https://www.secullum.com.br',
    models: [
      { value: 'rep_4', label: 'REP 4', port: 80, protocol: 'http', endpoint: '/webservice/ponto', portaria: 'portaria_1510', repType: 'REP', hasWebservice: true, hasBiometric: true },
      { value: 'rep_bio', label: 'REP Bio', port: 80, protocol: 'http', endpoint: '/webservice/ponto', portaria: 'portaria_671', repType: 'REP-P', hasWebservice: true, hasBiometric: true },
      { value: 'rep_facial', label: 'REP Facial', port: 80, protocol: 'http', endpoint: '/webservice/ponto', portaria: 'portaria_671', repType: 'REP-P', hasWebservice: true, hasFacialRecognition: true },
      { value: 'rep_5', label: 'REP 5', port: 80, protocol: 'http', endpoint: '/webservice/ponto', portaria: 'portaria_671', repType: 'REP-P', hasWebservice: true, hasBiometric: true },
    ],
  },
  // ZKTECO - Chinese manufacturer (widely used in Brazil)
  {
    manufacturer: 'zkteco',
    label: 'ZKTeco',
    country: 'China',
    website: 'https://www.zkteco.com.br',
    models: [
      { value: 'k40', label: 'K40', port: 80, protocol: 'http', endpoint: '/iclock/cdata', portaria: 'portaria_373', repType: 'REP-A', hasWebservice: false, hasBiometric: true },
      { value: 'k50', label: 'K50', port: 80, protocol: 'http', endpoint: '/iclock/cdata', portaria: 'portaria_373', repType: 'REP-A', hasWebservice: false, hasBiometric: true },
      { value: 'mb10', label: 'MB10-VL', port: 80, protocol: 'http', endpoint: '/iclock/cdata', portaria: 'portaria_671', repType: 'REP-P', hasWebservice: true, hasFacialRecognition: true },
      { value: 'speedface', label: 'SpeedFace-V5L', port: 80, protocol: 'http', endpoint: '/iclock/cdata', portaria: 'portaria_671', repType: 'REP-P', hasWebservice: true, hasFacialRecognition: true },
      { value: 'uface800', label: 'UFace 800', port: 80, protocol: 'http', endpoint: '/iclock/cdata', portaria: 'portaria_671', repType: 'REP-P', hasWebservice: true, hasFacialRecognition: true },
      { value: 'g3', label: 'G3', port: 80, protocol: 'http', endpoint: '/iclock/cdata', portaria: 'portaria_373', repType: 'REP-A', hasWebservice: false, hasBiometric: true },
      { value: 'f22', label: 'F22', port: 80, protocol: 'http', endpoint: '/iclock/cdata', portaria: 'portaria_373', repType: 'REP-A', hasWebservice: false, hasBiometric: true },
      { value: 'iclock_880', label: 'iClock 880', port: 80, protocol: 'http', endpoint: '/iclock/cdata', portaria: 'portaria_373', repType: 'REP-A', hasWebservice: false, hasBiometric: true },
      { value: 'sf300', label: 'SF300', port: 80, protocol: 'http', endpoint: '/iclock/cdata', portaria: 'portaria_373', repType: 'REP-A', hasWebservice: false, hasBiometric: true },
      { value: 'lface', label: 'LFace', port: 80, protocol: 'http', endpoint: '/iclock/cdata', portaria: 'portaria_671', repType: 'REP-P', hasWebservice: true, hasFacialRecognition: true },
    ],
  },
  // ANVIZ - Chinese manufacturer
  {
    manufacturer: 'anviz',
    label: 'Anviz',
    country: 'China',
    website: 'https://www.anviz.com',
    models: [
      { value: 'c2pro', label: 'C2 Pro', port: 80, protocol: 'http', endpoint: '/api/transaction', portaria: 'portaria_373', repType: 'REP-A', hasWebservice: false, hasBiometric: true },
      { value: 'facepass7', label: 'FacePass 7', port: 80, protocol: 'http', endpoint: '/api/transaction', portaria: 'portaria_671', repType: 'REP-P', hasWebservice: true, hasFacialRecognition: true },
      { value: 'w2pro', label: 'W2 Pro', port: 80, protocol: 'http', endpoint: '/api/transaction', portaria: 'portaria_373', repType: 'REP-A', hasWebservice: false, hasBiometric: true },
      { value: 'facedeep5', label: 'FaceDeep 5', port: 80, protocol: 'http', endpoint: '/api/transaction', portaria: 'portaria_671', repType: 'REP-P', hasWebservice: true, hasFacialRecognition: true },
      { value: 'tc580', label: 'TC580', port: 80, protocol: 'http', endpoint: '/api/transaction', portaria: 'portaria_373', repType: 'REP-A', hasWebservice: false, hasBiometric: true },
    ],
  },
  // SUPREMA - Korean manufacturer (BioStar)
  {
    manufacturer: 'suprema',
    label: 'Suprema (BioStar)',
    country: 'Coreia do Sul',
    website: 'https://www.supremainc.com',
    models: [
      { value: 'biostation2', label: 'BioStation 2', port: 443, protocol: 'https', endpoint: '/api/v2/events', portaria: 'portaria_671', repType: 'REP-P', hasWebservice: true, hasBiometric: true, hasFacialRecognition: true },
      { value: 'bioentry', label: 'BioEntry W2', port: 443, protocol: 'https', endpoint: '/api/v2/events', portaria: 'portaria_671', repType: 'REP-P', hasWebservice: true, hasBiometric: true },
      { value: 'facelite', label: 'FaceLite', port: 443, protocol: 'https', endpoint: '/api/v2/events', portaria: 'portaria_671', repType: 'REP-P', hasWebservice: true, hasFacialRecognition: true },
      { value: 'facestation_f2', label: 'FaceStation F2', port: 443, protocol: 'https', endpoint: '/api/v2/events', portaria: 'portaria_671', repType: 'REP-P', hasWebservice: true, hasFacialRecognition: true },
      { value: 'biostation_a2', label: 'BioStation A2', port: 443, protocol: 'https', endpoint: '/api/v2/events', portaria: 'portaria_671', repType: 'REP-P', hasWebservice: true, hasBiometric: true },
    ],
  },
  // TRIX - Brazilian manufacturer
  {
    manufacturer: 'trix',
    label: 'Trix Tecnologia',
    country: 'Brasil',
    website: 'https://www.trix.com.br',
    models: [
      { value: 'ss_710', label: 'SS 710', port: 80, protocol: 'http', endpoint: '/api/v1/marcacoes', portaria: 'portaria_1510', repType: 'REP', hasWebservice: true, hasBiometric: true },
      { value: 'ss_810', label: 'SS 810', port: 80, protocol: 'http', endpoint: '/api/v1/marcacoes', portaria: 'portaria_671', repType: 'REP-P', hasWebservice: true, hasBiometric: true },
      { value: 'ss_710_face', label: 'SS 710 Face', port: 80, protocol: 'http', endpoint: '/api/v1/marcacoes', portaria: 'portaria_671', repType: 'REP-P', hasWebservice: true, hasFacialRecognition: true },
    ],
  },
  // RWTECH - Brazilian manufacturer
  {
    manufacturer: 'rwtech',
    label: 'RWTech',
    country: 'Brasil',
    website: 'https://www.rwtech.com.br',
    models: [
      { value: 'rw_bio', label: 'RW Bio', port: 80, protocol: 'http', endpoint: '/api/records', portaria: 'portaria_671', repType: 'REP-P', hasWebservice: true, hasBiometric: true },
      { value: 'rw_facial', label: 'RW Facial', port: 80, protocol: 'http', endpoint: '/api/records', portaria: 'portaria_671', repType: 'REP-P', hasWebservice: true, hasFacialRecognition: true },
      { value: 'rw_rep_671', label: 'RW REP 671', port: 80, protocol: 'http', endpoint: '/api/records', portaria: 'portaria_671', repType: 'REP-P', hasWebservice: true, hasBiometric: true },
    ],
  },
  // HIKVISION - Chinese manufacturer
  {
    manufacturer: 'hikvision',
    label: 'Hikvision',
    country: 'China',
    website: 'https://www.hikvision.com',
    models: [
      { value: 'ds_k1t671m', label: 'DS-K1T671M', port: 80, protocol: 'http', endpoint: '/ISAPI/AccessControl/AcsEvent', portaria: 'portaria_671', repType: 'REP-P', hasWebservice: true, hasFacialRecognition: true },
      { value: 'ds_k1t341', label: 'DS-K1T341', port: 80, protocol: 'http', endpoint: '/ISAPI/AccessControl/AcsEvent', portaria: 'portaria_671', repType: 'REP-P', hasWebservice: true, hasFacialRecognition: true },
      { value: 'ds_k1t671tw', label: 'DS-K1T671TW', port: 80, protocol: 'http', endpoint: '/ISAPI/AccessControl/AcsEvent', portaria: 'portaria_671', repType: 'REP-P', hasWebservice: true, hasFacialRecognition: true },
      { value: 'ds_k1a802', label: 'DS-K1A802', port: 80, protocol: 'http', endpoint: '/ISAPI/AccessControl/AcsEvent', portaria: 'portaria_373', repType: 'REP-A', hasWebservice: true, hasBiometric: true },
    ],
  },
  // INTELBRAS - Brazilian manufacturer
  {
    manufacturer: 'intelbras',
    label: 'Intelbras',
    country: 'Brasil',
    website: 'https://www.intelbras.com.br',
    models: [
      { value: 'ss_411', label: 'SS 411 E', port: 80, protocol: 'http', endpoint: '/api/records', portaria: 'portaria_1510', repType: 'REP', hasWebservice: true, hasBiometric: true },
      { value: 'ss_611', label: 'SS 611', port: 80, protocol: 'http', endpoint: '/api/records', portaria: 'portaria_671', repType: 'REP-P', hasWebservice: true, hasBiometric: true },
      { value: 'ss_3430_bio', label: 'SS 3430 Bio', port: 80, protocol: 'http', endpoint: '/api/records', portaria: 'portaria_671', repType: 'REP-P', hasWebservice: true, hasBiometric: true },
      { value: 'ss_3430_face', label: 'SS 3430 Face', port: 80, protocol: 'http', endpoint: '/api/records', portaria: 'portaria_671', repType: 'REP-P', hasWebservice: true, hasFacialRecognition: true },
      { value: 'ss_5530', label: 'SS 5530', port: 80, protocol: 'http', endpoint: '/api/records', portaria: 'portaria_373', repType: 'REP-A', hasWebservice: false, hasFacialRecognition: true },
    ],
  },
  // PONTO MAIS (Ahgora) - Software-based
  {
    manufacturer: 'pontomais',
    label: 'Ponto Mais (Ahgora)',
    country: 'Brasil',
    website: 'https://www.pontomais.com.br',
    models: [
      { value: 'rep_virtual', label: 'REP Virtual', port: 443, protocol: 'https', endpoint: '/api/v1/records', portaria: 'portaria_671', repType: 'REP-P', hasWebservice: true, hasFacialRecognition: true, hasQRCode: true },
    ],
  },
  // TANGERINO - Software-based
  {
    manufacturer: 'tangerino',
    label: 'Tangerino',
    country: 'Brasil',
    website: 'https://www.tangerino.com.br',
    models: [
      { value: 'rep_app', label: 'REP App', port: 443, protocol: 'https', endpoint: '/api/registros', portaria: 'portaria_671', repType: 'REP-P', hasWebservice: true, hasFacialRecognition: true },
    ],
  },
  // OITCHAU - Software-based
  {
    manufacturer: 'oitchau',
    label: 'Oitchau',
    country: 'Brasil',
    website: 'https://www.oitchau.com.br',
    models: [
      { value: 'ponto_app', label: 'Ponto App', port: 443, protocol: 'https', endpoint: '/api/v1/records', portaria: 'portaria_671', repType: 'REP-P', hasWebservice: true, hasFacialRecognition: true },
    ],
  },
  // BIOMTECH - Brazilian manufacturer (facial recognition pioneer)
  {
    manufacturer: 'biomtech',
    label: 'Biomtech',
    country: 'Brasil',
    website: 'https://www.biomtech.com.br',
    models: [
      { value: 'faceschool', label: 'faceSchool', port: 443, protocol: 'https', endpoint: '/api/v1/attendance', portaria: 'portaria_671', repType: 'REP-P', hasWebservice: true, hasFacialRecognition: true },
      { value: 'facejus', label: 'faceJus', port: 443, protocol: 'https', endpoint: '/api/v1/attendance', portaria: 'portaria_671', repType: 'REP-P', hasWebservice: true, hasFacialRecognition: true },
      { value: 'facepoint', label: 'facePoint', port: 443, protocol: 'https', endpoint: '/api/v1/attendance', portaria: 'portaria_671', repType: 'REP-P', hasWebservice: true, hasFacialRecognition: true },
      { value: 'facecorp', label: 'faceCorp', port: 443, protocol: 'https', endpoint: '/api/v1/attendance', portaria: 'portaria_671', repType: 'REP-P', hasWebservice: true, hasFacialRecognition: true },
      { value: 'facepass', label: 'facePass', port: 443, protocol: 'https', endpoint: '/api/v1/access', portaria: 'portaria_671', repType: 'REP-A', hasWebservice: true, hasFacialRecognition: true },
      { value: 'biomtech_terminal', label: 'Terminal Biomtech', port: 443, protocol: 'https', endpoint: '/api/v1/attendance', portaria: 'portaria_671', repType: 'REP-P', hasWebservice: true, hasFacialRecognition: true },
    ],
  },
  // Generic/Other
  {
    manufacturer: 'generic',
    label: 'Genérico / Outro',
    country: 'Diversos',
    models: [
      { value: 'generic_http', label: 'HTTP/REST Genérico', port: 80, protocol: 'http', endpoint: '/', portaria: 'portaria_373', repType: 'REP-A', hasWebservice: false },
      { value: 'generic_https', label: 'HTTPS/REST Genérico', port: 443, protocol: 'https', endpoint: '/', portaria: 'portaria_671', repType: 'REP-P', hasWebservice: true },
      { value: 'tcp_socket', label: 'TCP Socket', port: 4370, protocol: 'http', endpoint: '/', portaria: 'portaria_373', repType: 'REP-A', hasWebservice: false },
    ],
  },
];

// Portaria compliance options
export const PORTARIA_OPTIONS = [
  { value: 'portaria_671', label: 'Portaria 671/2021', description: 'REP-P, REP-A ou REP-C - Sistema atual' },
  { value: 'portaria_1510', label: 'Portaria 1510/2009', description: 'REP Convencional - Sistema legado' },
  { value: 'portaria_373', label: 'Portaria 373/2011', description: 'Alternativo - Acordo coletivo' },
];

// REP Type explanations
export const REP_TYPES = {
  'REP-P': 'Registrador Eletrônico de Ponto via Programa',
  'REP-A': 'Registrador Eletrônico de Ponto Alternativo',
  'REP-C': 'Registrador Eletrônico de Ponto Convencional',
  'REP': 'Registrador Eletrônico de Ponto (Legado)',
};

// Helper functions
export function getManufacturerLabel(value: string): string {
  return EQUIPMENT_CATALOG_FULL.find(m => m.manufacturer === value)?.label || value;
}

export function getModelLabel(manufacturer: string, model: string): string {
  const mfr = EQUIPMENT_CATALOG_FULL.find(m => m.manufacturer === manufacturer);
  return mfr?.models.find(m => m.value === model)?.label || model;
}

export function getModelDetails(manufacturer: string, model: string): EquipmentModel | undefined {
  const mfr = EQUIPMENT_CATALOG_FULL.find(m => m.manufacturer === manufacturer);
  return mfr?.models.find(m => m.value === model);
}

export function getManufacturerModels(manufacturer: string): EquipmentModel[] {
  return EQUIPMENT_CATALOG_FULL.find(m => m.manufacturer === manufacturer)?.models || [];
}

export function filterModelsByPortaria(portaria: string): EquipmentManufacturer[] {
  return EQUIPMENT_CATALOG_FULL.map(mfr => ({
    ...mfr,
    models: mfr.models.filter(m => m.portaria === portaria),
  })).filter(mfr => mfr.models.length > 0);
}

export function getModelsWithoutWebservice(): EquipmentManufacturer[] {
  return EQUIPMENT_CATALOG_FULL.map(mfr => ({
    ...mfr,
    models: mfr.models.filter(m => !m.hasWebservice),
  })).filter(mfr => mfr.models.length > 0);
}

export function getModelsWithWebservice(): EquipmentManufacturer[] {
  return EQUIPMENT_CATALOG_FULL.map(mfr => ({
    ...mfr,
    models: mfr.models.filter(m => m.hasWebservice),
  })).filter(mfr => mfr.models.length > 0);
}

// Count statistics
export function getCatalogStats() {
  let totalModels = 0;
  let portaria671 = 0;
  let portaria1510 = 0;
  let portaria373 = 0;
  let withWebservice = 0;
  let withFacial = 0;

  EQUIPMENT_CATALOG_FULL.forEach(mfr => {
    mfr.models.forEach(model => {
      totalModels++;
      if (model.portaria === 'portaria_671') portaria671++;
      if (model.portaria === 'portaria_1510') portaria1510++;
      if (model.portaria === 'portaria_373') portaria373++;
      if (model.hasWebservice) withWebservice++;
      if (model.hasFacialRecognition) withFacial++;
    });
  });

  return {
    totalManufacturers: EQUIPMENT_CATALOG_FULL.length,
    totalModels,
    portaria671,
    portaria1510,
    portaria373,
    withWebservice,
    withFacial,
  };
}
