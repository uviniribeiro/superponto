// Navegação montada pelas permissões (mesma regra da web). Só entram telas registradas em pages/registry.dart.
import 'package:material_ui/material_ui.dart';

import '../core/api.dart';
import '../pages/registry.dart';

class NavItem {
  const NavItem(this.label, this.path, this.icon, {this.dot});
  final String label, path;
  final IconData icon;
  final Color? dot;
}

class NavSection {
  NavSection(this.label, this.items);
  final String label;
  final List<NavItem> items;
}

List<NavSection> buildNav(Me me) {
  bool can(String p) => me.can(p);
  final out = <NavSection>[];
  void add(String label, List<NavItem?> items) {
    final list = [
      for (final i in items)
        if (i != null && pageRoutes.containsKey(i.path)) i,
    ];
    if (list.isNotEmpty) out.add(NavSection(label, list));
  }

  NavItem? when(bool c, NavItem i) => c ? i : null;

  add('Principal', [const NavItem('Visão geral', '/', Icons.space_dashboard_rounded)]);
  if (can('org.companies:read')) {
    add('Organização', [
      const NavItem('Empresas', '/empresas', Icons.business_rounded),
      when(can('org.units:read'), const NavItem('Unidades e locais', '/estrutura/unidades', Icons.place_rounded, dot: Color(0xFFF87171))),
      when(can('org.departments:read'), const NavItem('Departamentos', '/estrutura/departamentos', Icons.account_tree_rounded, dot: Color(0xFF60A5FA))),
      when(can('org.positions:read'), const NavItem('Cargos', '/estrutura/cargos', Icons.work_rounded, dot: Color(0xFFA78BFA))),
      when(can('org.functions:read'), const NavItem('Funções', '/estrutura/funcoes', Icons.verified_rounded, dot: Color(0xFF34D399))),
      when(can('org.costcenters:read'), const NavItem('Centros de custo', '/estrutura/centros-de-custo', Icons.account_balance_wallet_rounded, dot: Color(0xFFF472B6))),
      when(can('org.employeetypes:read'), const NavItem('Tipos de funcionário', '/estrutura/tipos-de-funcionario', Icons.sell_rounded, dot: Color(0xFFFB923C))),
      when(can('org.unions:read'), const NavItem('Sindicatos', '/estrutura/sindicatos', Icons.account_balance_rounded, dot: Color(0xFF22D3EE))),
      when(can('org.holidays:read'), const NavItem('Feriados', '/feriados', Icons.event_rounded)),
      when(can('org.competences:read'), const NavItem('Competências', '/estrutura/competencias', Icons.date_range_rounded)),
      when(can('org.groupings:read'), const NavItem('Agrupamentos', '/estrutura/agrupamentos', Icons.widgets_rounded)),
    ]);
  }
  if (can('people.employments:read')) {
    add('Pessoas', [
      const NavItem('Funcionários', '/funcionarios', Icons.groups_rounded),
      when(can('people.employments:import'), const NavItem('Importar planilha', '/funcionarios/importar', Icons.upload_file_rounded)),
    ]);
  }
  add('Jornada', [
    when(can('schedules.schedules:read'), const NavItem('Escalas', '/jornada/escalas', Icons.calendar_month_rounded)),
    when(can('schedules.timetables:read'), const NavItem('Horários', '/jornada/horarios', Icons.schedule_rounded)),
    when(can('schedules.timetables:read'), const NavItem('Regras de apuração', '/jornada/regras', Icons.speed_rounded)),
  ]);
  final calc = can('time.calculations:read');
  add('Ponto', [
    when(can('time.records:create'), const NavItem('Registrar ponto', '/ponto/registrar', Icons.fingerprint_rounded)),
    when(calc || can('time.records:create'), NavItem(calc ? 'Espelho de ponto' : 'Meu espelho', '/ponto/espelho', Icons.receipt_long_rounded)),
    when(calc, const NavItem('Espelho diário', '/ponto/diario', Icons.today_rounded)),
    when(calc, const NavItem('Painel ao vivo', '/ferramentas/ao-vivo', Icons.monitor_heart_rounded)),
    when(can('time.records:create'), const NavItem('Meus aparelhos', '/ponto/aparelhos', Icons.smartphone_rounded)),
    when(can('time.records:import'), const NavItem('Importar marcações', '/ponto/importar', Icons.file_download_rounded)),
    when(can('time.records:read'), const NavItem('Ajustes de marcação', '/ponto/ajustes', Icons.fact_check_rounded)),
    when(calc, const NavItem('Abonos e afastamentos', '/ponto/abonos', Icons.healing_rounded)),
    when(calc, const NavItem('Justificativas', '/ponto/justificativas', Icons.rule_rounded)),
    when(calc, const NavItem('Fechamento', '/ponto/fechamento', Icons.lock_rounded)),
  ]);
  add('Bancos e solicitações', [
    when(can('time.bank:read'), const NavItem('Banco de horas', '/bancos/banco-de-horas', Icons.savings_rounded)),
    when(can('time.records:create') && !can('time.bank:read'), const NavItem('Meu banco de horas', '/bancos/meu-banco', Icons.savings_rounded)),
    when(can('requests.requests:create'), const NavItem('Solicitações', '/solicitacoes', Icons.forum_rounded)),
    when(can('requests.requests:read'), const NavItem('Fluxos de aprovação', '/solicitacoes/fluxos', Icons.alt_route_rounded)),
  ]);
  add('Relatórios', [
    when(can('reports.reports:read'), const NavItem('Relatórios', '/relatorios', Icons.bar_chart_rounded)),
    when(can('reports.payroll:export'), const NavItem('Exportação para a folha', '/folha', Icons.output_rounded)),
  ]);
  add('Módulos', [
    when(can('health.shifts:read'), const NavItem('Plantões', '/saude/plantoes', Icons.medical_services_rounded)),
    when(can('education.academic:read'), const NavItem('Educação', '/educacao', Icons.school_rounded)),
    when(can('operational.board:read'), const NavItem('Ocorrências', '/operacional/ocorrencias', Icons.assignment_late_rounded)),
  ]);
  add('Ferramentas', [
    when(can('tools.announcements:manage'), const NavItem('Avisos', '/ferramentas/avisos', Icons.campaign_rounded)),
    when(can('tools.notifications:manage'), const NavItem('E-mails agendados', '/ferramentas/emails', Icons.mark_email_read_rounded)),
    when(can('admin.settings:manage'), const NavItem('Textos personalizados', '/ferramentas/textos', Icons.text_fields_rounded)),
  ]);
  if (can('devices.devices:read')) add('Equipamentos', [const NavItem('Relógios (REP)', '/equipamentos', Icons.router_rounded)]);
  if (can('admin.users:read')) {
    add('Administração', [
      const NavItem('Usuários', '/usuarios', Icons.people_alt_rounded),
      const NavItem('Perfis e permissões', '/perfis', Icons.key_rounded),
      const NavItem('Bloqueios de acesso', '/bloqueios', Icons.block_rounded),
      const NavItem('Plano e uso', '/plano', Icons.layers_rounded),
      when(can('admin.users:manage'), const NavItem('Aparelhos do app', '/usuarios/aparelhos', Icons.phonelink_lock_rounded)),
      when(can('admin.ldap:manage'), const NavItem('Login pela rede (LDAP)', '/usuarios/ldap', Icons.lan_rounded)),
    ]);
  }
  if (me.isPlatformAdmin) {
    add('Plataforma', [const NavItem('Clientes', '/plataforma/clientes', Icons.verified_user_rounded), const NavItem('Planos', '/plataforma/planos', Icons.layers_rounded)]);
  }
  add('Conta', [const NavItem('Minha conta', '/minha-conta', Icons.person_rounded)]);
  add('Ajuda', [
    const NavItem('Central de ajuda', '/ferramentas/ajuda', Icons.calculate_rounded),
    const NavItem('Manual', '/manual', Icons.menu_book_rounded),
    const NavItem('Conformidade MTE', '/conformidade', Icons.balance_rounded),
  ]);
  return out;
}
