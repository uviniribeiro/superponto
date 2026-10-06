import jsPDF from 'jspdf';

export const generateEquipmentDocPDF = () => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - 2 * margin;
  let y = 20;

  const addTitle = (text: string, size: number = 16) => {
    doc.setFontSize(size);
    doc.setFont('helvetica', 'bold');
    doc.text(text, margin, y);
    y += size * 0.5 + 4;
  };

  const addSubtitle = (text: string) => {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(text, margin, y);
    y += 8;
  };

  const addText = (text: string) => {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(text, contentWidth);
    doc.text(lines, margin, y);
    y += lines.length * 5 + 4;
  };

  const addCode = (text: string) => {
    doc.setFontSize(9);
    doc.setFont('courier', 'normal');
    doc.setFillColor(240, 240, 240);
    const lines = doc.splitTextToSize(text, contentWidth - 10);
    doc.rect(margin, y - 4, contentWidth, lines.length * 4.5 + 6, 'F');
    doc.text(lines, margin + 5, y);
    y += lines.length * 4.5 + 10;
  };

  const addBullet = (text: string) => {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(text, contentWidth - 10);
    doc.text('•', margin, y);
    doc.text(lines, margin + 8, y);
    y += lines.length * 5 + 2;
  };

  const checkPageBreak = (needed: number = 40) => {
    if (y > doc.internal.pageSize.getHeight() - needed) {
      doc.addPage();
      y = 20;
    }
  };

  const addSpacer = (size: number = 8) => {
    y += size;
  };

  // === CAPA ===
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 297, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.text('Manual Completo', pageWidth / 2, 100, { align: 'center' });
  
  doc.setFontSize(22);
  doc.text('Agente de Sincronização', pageWidth / 2, 115, { align: 'center' });
  doc.text('de Equipamentos', pageWidth / 2, 127, { align: 'center' });
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('Guia de Instalação e Configuração', pageWidth / 2, 150, { align: 'center' });
  
  doc.setFontSize(10);
  doc.text(`Versão 1.0.0 - ${new Date().toLocaleDateString('pt-BR')}`, pageWidth / 2, 250, { align: 'center' });
  
  // === ÍNDICE ===
  doc.addPage();
  doc.setTextColor(0, 0, 0);
  y = 20;
  
  addTitle('Índice', 20);
  addSpacer(10);
  
  const tocItems = [
    '1. Introdução .......................................................... 3',
    '2. Requisitos do Sistema ......................................... 4',
    '3. Instalação Windows (Serviço) .............................. 5',
    '4. Instalação Windows (Agente Simples) ................. 7',
    '5. Instalação Linux (Systemd) .................................. 8',
    '6. Pacotes .deb (Debian/Ubuntu) ............................ 10',
    '7. Pacotes .rpm (RHEL/Fedora) ............................... 11',
    '8. Criação de Executáveis ...................................... 12',
    '9. Dashboard de Monitoramento ............................. 13',
    '10. Configuração do Agente ................................... 14',
    '11. Fabricantes Suportados .................................... 15',
    '12. Solução de Problemas ..................................... 16',
  ];
  
  tocItems.forEach(item => {
    doc.setFontSize(11);
    doc.text(item, margin, y);
    y += 8;
  });

  // === 1. INTRODUÇÃO ===
  doc.addPage();
  y = 20;
  
  addTitle('1. Introdução', 18);
  addSpacer();
  
  addText('O Agente de Sincronização de Equipamentos é uma solução completa para detectar automaticamente relógios de ponto na rede local e sincronizá-los com o sistema de gerenciamento na nuvem.');
  addSpacer();
  
  addSubtitle('Principais Funcionalidades:');
  addBullet('Detecção automática de equipamentos na rede');
  addBullet('Sincronização contínua com o servidor cloud');
  addBullet('Dashboard web local para monitoramento');
  addBullet('Suporte a múltiplos fabricantes');
  addBullet('Execução como serviço do sistema operacional');
  addBullet('Logs detalhados para diagnóstico');
  
  addSpacer();
  addSubtitle('Modos de Operação:');
  addText('O agente pode operar em dois modos principais:');
  addBullet('Serviço (recomendado): Executa em segundo plano, inicia automaticamente com o sistema');
  addBullet('Agente Simples: Execução manual para detecção e configuração');

  // === 2. REQUISITOS ===
  doc.addPage();
  y = 20;
  
  addTitle('2. Requisitos do Sistema', 18);
  addSpacer();
  
  addSubtitle('Windows:');
  addBullet('Windows 10 ou superior (64-bit)');
  addBullet('Python 3.8 ou superior');
  addBullet('Acesso de administrador para instalação como serviço');
  addBullet('Conexão de rede com acesso à internet');
  
  addSpacer();
  addSubtitle('Linux:');
  addBullet('Ubuntu 20.04+, Debian 11+, CentOS 8+, Fedora 35+');
  addBullet('Python 3.8 ou superior');
  addBullet('systemd para gerenciamento de serviços');
  addBullet('Acesso root para instalação');
  
  addSpacer();
  addSubtitle('Dependências Python:');
  addCode('pip install requests psutil pywin32  # Windows\npip install requests psutil           # Linux');
  
  addSpacer();
  addSubtitle('Portas de Rede:');
  addBullet('Porta 8765: Dashboard web local');
  addBullet('Porta 443: Comunicação HTTPS com servidor cloud');
  addBullet('Portas 80, 4370, 5005, 8080, 9922: Detecção de equipamentos');

  // === 3. INSTALAÇÃO WINDOWS SERVIÇO ===
  doc.addPage();
  y = 20;
  
  addTitle('3. Instalação Windows (Serviço)', 18);
  addSpacer();
  
  addText('O serviço Windows é a opção recomendada para ambientes de produção. Ele inicia automaticamente com o sistema e inclui um dashboard de monitoramento.');
  addSpacer();
  
  addSubtitle('Passo 1: Baixar os Arquivos');
  addText('Baixe os seguintes arquivos da página de ajuda do sistema:');
  addBullet('install-service.bat');
  addBullet('equipment-service.py');
  
  addSpacer();
  addSubtitle('Passo 2: Executar como Administrador');
  addText('Clique com o botão direito no arquivo install-service.bat e selecione "Executar como administrador".');
  
  addSpacer();
  addSubtitle('Passo 3: Acompanhar a Instalação');
  addText('O script irá:');
  addBullet('Verificar se o Python está instalado');
  addBullet('Instalar as dependências necessárias');
  addBullet('Instalar e iniciar o serviço');
  
  addSpacer();
  addSubtitle('Comandos do Serviço:');
  addCode('python equipment-service.py install   # Instala o serviço\npython equipment-service.py start     # Inicia o serviço\npython equipment-service.py stop      # Para o serviço\npython equipment-service.py remove    # Remove o serviço');
  
  checkPageBreak();
  addSpacer();
  addSubtitle('Verificar Status:');
  addText('Abra o Gerenciador de Serviços do Windows (services.msc) e procure por "Equipment Sync Agent".');
  
  addSpacer();
  addSubtitle('Dashboard:');
  addText('Após a instalação, acesse o dashboard em:');
  addCode('http://localhost:8765');

  // === 4. INSTALAÇÃO WINDOWS AGENTE SIMPLES ===
  doc.addPage();
  y = 20;
  
  addTitle('4. Instalação Windows (Agente Simples)', 18);
  addSpacer();
  
  addText('O agente simples é ideal para detecção manual de equipamentos e testes de configuração.');
  addSpacer();
  
  addSubtitle('Passo 1: Baixar os Arquivos');
  addBullet('equipment-agent.py');
  addBullet('equipment-agent.bat');
  
  addSpacer();
  addSubtitle('Passo 2: Executar');
  addText('Dê duplo clique no arquivo equipment-agent.bat ou execute via terminal:');
  addCode('python equipment-agent.py');
  
  addSpacer();
  addSubtitle('Opções de Linha de Comando:');
  addCode('python equipment-agent.py scan        # Escaneia a rede\npython equipment-agent.py register    # Registra equipamentos\npython equipment-agent.py daemon      # Modo contínuo');
  
  addSpacer();
  addSubtitle('Configuração:');
  addText('Edite o arquivo config.json no mesmo diretório do script para configurar:');
  addBullet('company_code: Código da sua empresa no sistema');
  addBullet('network_ranges: Faixas de IP para escanear');
  addBullet('scan_interval: Intervalo entre escaneamentos (em segundos)');

  // === 5. INSTALAÇÃO LINUX ===
  doc.addPage();
  y = 20;
  
  addTitle('5. Instalação Linux (Systemd)', 18);
  addSpacer();
  
  addText('A instalação Linux usa systemd para gerenciamento do serviço, garantindo alta disponibilidade e reinício automático em caso de falhas.');
  addSpacer();
  
  addSubtitle('Passo 1: Baixar os Arquivos');
  addText('Baixe os seguintes arquivos:');
  addBullet('install-linux.sh');
  addBullet('equipment-agent-linux.py');
  addBullet('equipment-agent.service');
  
  addSpacer();
  addSubtitle('Passo 2: Executar o Instalador');
  addCode('chmod +x install-linux.sh\nsudo ./install-linux.sh');
  
  addSpacer();
  addSubtitle('O que o instalador faz:');
  addBullet('Cria o diretório /opt/equipment-sync-agent');
  addBullet('Copia os arquivos necessários');
  addBullet('Instala as dependências Python');
  addBullet('Configura o serviço systemd');
  addBullet('Inicia o serviço automaticamente');
  
  checkPageBreak();
  addSpacer();
  addSubtitle('Comandos Systemd:');
  addCode('systemctl status equipment-agent    # Ver status\nsystemctl restart equipment-agent  # Reiniciar\nsystemctl stop equipment-agent     # Parar\njournalctl -u equipment-agent -f   # Ver logs');
  
  addSpacer();
  addSubtitle('Arquivos Importantes:');
  addBullet('/opt/equipment-sync-agent/config.json - Configuração');
  addBullet('/var/log/equipment-sync/agent.log - Logs do agente');
  addBullet('/var/lib/equipment-sync/state.json - Estado atual');

  // === 6. PACOTES DEB ===
  doc.addPage();
  y = 20;
  
  addTitle('6. Pacotes .deb (Debian/Ubuntu)', 18);
  addSpacer();
  
  addText('Os pacotes .deb permitem instalação simplificada em sistemas Debian, Ubuntu, Linux Mint e derivados.');
  addSpacer();
  
  addSubtitle('Gerar o Pacote:');
  addText('Baixe o script build-deb.sh e execute:');
  addCode('chmod +x build-deb.sh\n./build-deb.sh');
  
  addSpacer();
  addSubtitle('Instalar o Pacote:');
  addCode('sudo dpkg -i equipment-sync-agent_1.0.0_all.deb\nsudo apt-get install -f  # Resolve dependências');
  
  addSpacer();
  addSubtitle('Remover o Pacote:');
  addCode('sudo dpkg -r equipment-sync-agent\nsudo dpkg -P equipment-sync-agent  # Remove com configs');
  
  addSpacer();
  addSubtitle('Distribuições Compatíveis:');
  addBullet('Ubuntu 20.04, 22.04, 24.04');
  addBullet('Debian 11, 12');
  addBullet('Linux Mint 20, 21');
  addBullet('Pop!_OS, Elementary OS, Zorin OS');

  // === 7. PACOTES RPM ===
  doc.addPage();
  y = 20;
  
  addTitle('7. Pacotes .rpm (RHEL/Fedora)', 18);
  addSpacer();
  
  addText('Os pacotes .rpm são para sistemas Red Hat Enterprise Linux, CentOS, Fedora, Rocky Linux e AlmaLinux.');
  addSpacer();
  
  addSubtitle('Pré-requisitos:');
  addCode('sudo dnf install rpm-build  # Fedora/RHEL 8+\nsudo yum install rpm-build  # CentOS 7');
  
  addSpacer();
  addSubtitle('Gerar o Pacote:');
  addCode('chmod +x build-rpm.sh\n./build-rpm.sh');
  
  addSpacer();
  addSubtitle('Instalar o Pacote:');
  addCode('sudo dnf install ./equipment-sync-agent-1.0.0*.rpm');
  
  addSpacer();
  addSubtitle('Remover o Pacote:');
  addCode('sudo dnf remove equipment-sync-agent');
  
  addSpacer();
  addSubtitle('Distribuições Compatíveis:');
  addBullet('Red Hat Enterprise Linux 8, 9');
  addBullet('CentOS Stream 8, 9');
  addBullet('Fedora 35+');
  addBullet('Rocky Linux 8, 9');
  addBullet('AlmaLinux 8, 9');

  // === 8. CRIAÇÃO DE EXECUTÁVEIS ===
  doc.addPage();
  y = 20;
  
  addTitle('8. Criação de Executáveis', 18);
  addSpacer();
  
  addText('Você pode compilar o agente em um executável standalone que não requer Python instalado na máquina de destino.');
  addSpacer();
  
  addSubtitle('Pré-requisitos:');
  addCode('pip install pyinstaller pywin32');
  
  addSpacer();
  addSubtitle('Arquivos Necessários:');
  addText('Coloque os seguintes arquivos na mesma pasta:');
  addBullet('build-executable.py');
  addBullet('equipment-service.py (Windows)');
  addBullet('equipment-agent-linux.py (Linux)');
  
  addSpacer();
  addSubtitle('Gerar Executável:');
  addCode('python build-executable.py');
  
  addSpacer();
  addSubtitle('Saída:');
  addBullet('Windows: dist/EquipmentAgentSetup.exe');
  addBullet('Linux: dist/equipment-agent');
  
  addSpacer();
  addSubtitle('Instalador NSIS (Windows):');
  addText('O script também gera um arquivo installer.nsi para criar um instalador profissional com NSIS, incluindo desinstalador e atalhos.');

  // === 9. DASHBOARD ===
  doc.addPage();
  y = 20;
  
  addTitle('9. Dashboard de Monitoramento', 18);
  addSpacer();
  
  addText('O dashboard web local permite monitorar o agente em tempo real através do navegador.');
  addSpacer();
  
  addSubtitle('Acesso:');
  addCode('http://localhost:8765');
  
  addSpacer();
  addSubtitle('Funcionalidades:');
  addBullet('Estatísticas de sincronizações em tempo real');
  addBullet('Lista de equipamentos detectados');
  addBullet('Histórico completo de sincronizações');
  addBullet('Log de erros com detalhes');
  addBullet('Configuração via interface web');
  addBullet('Botão de scan manual');
  addBullet('Sincronização sob demanda');
  
  addSpacer();
  addSubtitle('Métricas Exibidas:');
  addBullet('Total de escaneamentos realizados');
  addBullet('Número de equipamentos encontrados');
  addBullet('Sincronizações bem-sucedidas');
  addBullet('Falhas de sincronização');
  
  addSpacer();
  addSubtitle('Acesso Remoto:');
  addText('Por padrão, o dashboard só aceita conexões locais. Para acesso remoto, configure o firewall e altere o bind address no código.');

  // === 10. CONFIGURAÇÃO ===
  doc.addPage();
  y = 20;
  
  addTitle('10. Configuração do Agente', 18);
  addSpacer();
  
  addSubtitle('Arquivo de Configuração:');
  addText('O agente usa um arquivo config.json para suas configurações:');
  addSpacer();
  
  addCode(`{
  "cloud_endpoint": "${import.meta.env.VITE_SUPABASE_URL}/functions/v1/equipment-sync",
  "company_code": "SEU_CODIGO_AQUI",
  "scan_interval": 300,
  "dashboard_port": 8765,
  "network_ranges": [
    "192.168.0.0/24",
    "192.168.1.0/24",
    "10.0.0.0/24"
  ],
  "equipment_ports": [80, 443, 4370, 5005, 8080, 9922]
}`);
  
  checkPageBreak();
  addSpacer();
  addSubtitle('Parâmetros:');
  addBullet('cloud_endpoint: URL do servidor de sincronização');
  addBullet('company_code: Código único da empresa no sistema');
  addBullet('scan_interval: Intervalo entre escaneamentos (segundos)');
  addBullet('dashboard_port: Porta do dashboard web');
  addBullet('network_ranges: Faixas de IP para escanear');
  addBullet('equipment_ports: Portas para detectar equipamentos');
  
  addSpacer();
  addSubtitle('Localização do Arquivo:');
  addBullet('Windows: Mesmo diretório do executável');
  addBullet('Linux: /opt/equipment-sync-agent/config.json');

  // === 11. FABRICANTES SUPORTADOS ===
  doc.addPage();
  y = 20;
  
  addTitle('11. Fabricantes Suportados', 18);
  addSpacer();
  
  addText('O agente suporta a detecção automática dos seguintes fabricantes e modelos de relógios de ponto:');
  addSpacer();
  
  const manufacturers = [
    'Henry (Prisma, Orion, Hexa)',
    'Dimep (PrintPoint, Smart Print)',
    'Control iD (iDClass, iDFace)',
    'Topdata (Inner Rep)',
    'Madis (MD 6705, MD FaceID)',
    'Secullum (REP 4, REP Bio)',
    'ZKTeco (K40, SpeedFace)',
    'Anviz (C2 Pro, FacePass)',
    'Suprema/BioStar',
    'Trix (SS 710, SS 810)',
    'RWTech',
    'Hikvision',
    'Intelbras (SS 411, SS 611)',
    'Primme Acesso',
  ];
  
  manufacturers.forEach(m => addBullet(m));
  
  addSpacer();
  addSubtitle('Portas Padrão por Fabricante:');
  addBullet('Henry/Dimep: 80, 443');
  addBullet('ZKTeco: 4370');
  addBullet('Control iD: 80, 443');
  addBullet('Outros: 8080, 9922');

  // === 12. SOLUÇÃO DE PROBLEMAS ===
  doc.addPage();
  y = 20;
  
  addTitle('12. Solução de Problemas', 18);
  addSpacer();
  
  addSubtitle('Serviço não inicia:');
  addBullet('Verifique se o Python está instalado corretamente');
  addBullet('Execute como administrador (Windows) ou root (Linux)');
  addBullet('Verifique os logs para erros específicos');
  
  addSpacer();
  addSubtitle('Equipamentos não detectados:');
  addBullet('Verifique se as faixas de rede estão corretas');
  addBullet('Confirme que os equipamentos estão ligados e na rede');
  addBullet('Verifique se o firewall não está bloqueando');
  addBullet('Tente adicionar as portas do fabricante específico');
  
  addSpacer();
  addSubtitle('Erro de sincronização:');
  addBullet('Verifique a conexão com a internet');
  addBullet('Confirme que o company_code está correto');
  addBullet('Verifique se o endpoint cloud está acessível');
  
  addSpacer();
  addSubtitle('Dashboard inacessível:');
  addBullet('Verifique se o serviço está rodando');
  addBullet('Confirme a porta 8765 não está em uso');
  addBullet('Verifique o firewall local');
  
  addSpacer();
  addSubtitle('Logs para Diagnóstico:');
  addCode('# Windows\ntype %APPDATA%\\EquipmentSyncAgent\\agent.log\n\n# Linux\njournalctl -u equipment-agent -f\ncat /var/log/equipment-sync/agent.log');
  
  checkPageBreak();
  addSpacer();
  addSubtitle('Suporte:');
  addText('Para suporte adicional, entre em contato através do sistema ou consulte a documentação online.');

  // Salvar PDF
  doc.save('Manual_Agente_Sincronizacao_Equipamentos.pdf');
};
