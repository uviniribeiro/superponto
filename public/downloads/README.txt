═══════════════════════════════════════════════════════════════════
         AGENTE DE SINCRONIZAÇÃO DE RELÓGIOS DE PONTO
               Guia de Instalação e Uso
═══════════════════════════════════════════════════════════════════

DESCRIÇÃO
---------
Este agente detecta automaticamente relógios de ponto na sua rede 
local e configura a sincronização com o servidor cloud.

REQUISITOS
----------
• Sistema Operacional: Windows 10/11, Linux ou macOS
• Python 3.8 ou superior
• Conexão com a internet
• Acesso à rede local onde estão os equipamentos

INSTALAÇÃO - WINDOWS
--------------------
1. Certifique-se de ter o Python instalado:
   - Baixe em: https://www.python.org/downloads/
   - Durante a instalação, marque "Add Python to PATH"

2. Execute o arquivo "equipment-agent.bat" com duplo clique

3. O agente instalará automaticamente as dependências necessárias

INSTALAÇÃO - LINUX/MAC
----------------------
1. Abra o terminal

2. Navegue até a pasta do agente:
   cd /caminho/para/pasta

3. Torne o script executável:
   chmod +x equipment-agent.py

4. Execute:
   python3 equipment-agent.py

   Ou instale as dependências manualmente:
   pip3 install requests

FUNCIONALIDADES
---------------
1. ESCANEAR REDE
   - Detecta automaticamente todos os relógios de ponto na rede
   - Identifica fabricante, modelo e porta de comunicação
   - Suporta múltiplos fabricantes simultaneamente

2. SINCRONIZAÇÃO AUTOMÁTICA
   - Mantém os dados sincronizados continuamente
   - Intervalo configurável (padrão: 60 segundos)
   - Funciona em segundo plano

3. REGISTRO NO CLOUD
   - Cadastra equipamentos automaticamente no servidor
   - Não é necessário configuração manual na interface web

4. TESTE DE CONEXÃO
   - Testa conectividade com equipamentos específicos
   - Útil para diagnóstico de problemas

FABRICANTES SUPORTADOS
----------------------
• Henry (Prisma, Orion, Hexa)
• Dimep (PrintPoint, Smart Print)
• Control iD (iDClass, iDFace)
• ZKTeco (K40, SpeedFace)
• Topdata (Inner Rep)
• Madis (MD 6705, FaceID)
• Hikvision
• Intelbras (SS 411, SS 611)
• Trix (SS 710, SS 810)
• RWTech
• Secullum (REP 4, REP Bio)
• Anviz (C2 Pro, FacePass)
• Biomtech (faceSchool, faceJus, facePoint, faceCorp, facePass)
  * Suporte a números de série alfanuméricos

SOLUÇÃO DE PROBLEMAS
--------------------
1. "Python não encontrado"
   - Instale o Python e marque "Add Python to PATH"
   - Reinicie o computador após a instalação

2. "Equipamento não responde"
   - Verifique se o equipamento está ligado
   - Confirme se está na mesma rede
   - Verifique se o firewall não está bloqueando

3. "Não foi possível conectar ao servidor"
   - Verifique sua conexão com a internet
   - Tente novamente em alguns minutos

4. "Nenhum equipamento encontrado"
   - Verifique se os equipamentos estão na mesma sub-rede
   - Alguns equipamentos podem usar portas não-padrão

ENDPOINT DO SERVIDOR
--------------------
Informe no assistente o endereço HTTPS do backend Supabase fornecido pelo gestor.
O endereço termina em /functions/v1/agent-gateway.

SUPORTE
-------
Em caso de dúvidas, consulte a página de ajuda no sistema
ou entre em contato com o suporte técnico.

═══════════════════════════════════════════════════════════════════
                    Versão 1.0.0 - 2024
═══════════════════════════════════════════════════════════════════
