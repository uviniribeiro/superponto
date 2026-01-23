#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SuperPonto - Instalador Multi-Database
Cria automaticamente banco de dados local com suporte a:
- PostgreSQL
- Microsoft SQL Server
- Oracle Database

Baseado no instalador: https://www.secullum.com.br/SecullumPontoOffline-setup.exe
"""

import os
import sys
import json
import subprocess
import platform
import shutil
from pathlib import Path
from typing import Optional, Dict, Any
import argparse

# Cores para terminal
class Colors:
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'

def print_header():
    print(f"""
{Colors.BLUE}╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   {Colors.BOLD}SuperPonto - Instalador Multi-Database{Colors.ENDC}{Colors.BLUE}                     ║
║   Sistema de Ponto Eletrônico                                 ║
║                                                               ║
║   Bancos Suportados:                                          ║
║   • PostgreSQL 14+                                            ║
║   • Microsoft SQL Server 2019+                                ║
║   • Oracle Database 19c+                                      ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝{Colors.ENDC}
""")

def print_success(msg: str):
    print(f"{Colors.GREEN}✓ {msg}{Colors.ENDC}")

def print_error(msg: str):
    print(f"{Colors.RED}✗ {msg}{Colors.ENDC}")

def print_warning(msg: str):
    print(f"{Colors.YELLOW}⚠ {msg}{Colors.ENDC}")

def print_info(msg: str):
    print(f"{Colors.BLUE}ℹ {msg}{Colors.ENDC}")


class DatabaseInstaller:
    """Classe base para instaladores de banco de dados"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.db_name = config.get('database', 'superponto')
        self.user = config.get('user', 'superponto')
        self.password = config.get('password', 'SuperPonto@2024')
        self.host = config.get('host', 'localhost')
        self.port = config.get('port', self.default_port())
        
    def default_port(self) -> int:
        return 5432
    
    def check_installation(self) -> bool:
        raise NotImplementedError
    
    def create_database(self) -> bool:
        raise NotImplementedError
    
    def create_user(self) -> bool:
        raise NotImplementedError
    
    def run_migrations(self, migrations_dir: str) -> bool:
        raise NotImplementedError
    
    def test_connection(self) -> bool:
        raise NotImplementedError
    
    def get_connection_string(self) -> str:
        raise NotImplementedError


class PostgreSQLInstaller(DatabaseInstaller):
    """Instalador para PostgreSQL"""
    
    def default_port(self) -> int:
        return 5432
    
    def check_installation(self) -> bool:
        try:
            result = subprocess.run(['psql', '--version'], capture_output=True, text=True)
            if result.returncode == 0:
                print_success(f"PostgreSQL encontrado: {result.stdout.strip()}")
                return True
        except FileNotFoundError:
            pass
        
        print_warning("PostgreSQL não encontrado. Tentando instalar...")
        return self._install_postgresql()
    
    def _install_postgresql(self) -> bool:
        system = platform.system()
        
        try:
            if system == 'Linux':
                # Debian/Ubuntu
                if shutil.which('apt'):
                    subprocess.run(['sudo', 'apt', 'update'], check=True)
                    subprocess.run(['sudo', 'apt', 'install', '-y', 'postgresql', 'postgresql-contrib'], check=True)
                # RHEL/CentOS/Fedora
                elif shutil.which('dnf'):
                    subprocess.run(['sudo', 'dnf', 'install', '-y', 'postgresql-server', 'postgresql-contrib'], check=True)
                    subprocess.run(['sudo', 'postgresql-setup', '--initdb'], check=True)
                    subprocess.run(['sudo', 'systemctl', 'start', 'postgresql'], check=True)
                    subprocess.run(['sudo', 'systemctl', 'enable', 'postgresql'], check=True)
                else:
                    print_error("Gerenciador de pacotes não suportado")
                    return False
                    
            elif system == 'Darwin':  # macOS
                subprocess.run(['brew', 'install', 'postgresql@16'], check=True)
                subprocess.run(['brew', 'services', 'start', 'postgresql@16'], check=True)
                
            elif system == 'Windows':
                print_info("No Windows, baixe o PostgreSQL de: https://www.postgresql.org/download/windows/")
                print_info("Ou use: winget install PostgreSQL.PostgreSQL")
                return False
                
            print_success("PostgreSQL instalado com sucesso")
            return True
            
        except subprocess.CalledProcessError as e:
            print_error(f"Erro ao instalar PostgreSQL: {e}")
            return False
    
    def create_user(self) -> bool:
        try:
            # Criar usuário
            cmd = f"CREATE USER {self.user} WITH PASSWORD '{self.password}' CREATEDB;"
            subprocess.run(
                ['sudo', '-u', 'postgres', 'psql', '-c', cmd],
                check=True, capture_output=True
            )
            print_success(f"Usuário '{self.user}' criado")
            return True
        except subprocess.CalledProcessError:
            print_warning(f"Usuário '{self.user}' já existe ou erro ao criar")
            return True  # Continuar mesmo se já existir
    
    def create_database(self) -> bool:
        try:
            # Criar banco de dados
            cmd = f"CREATE DATABASE {self.db_name} OWNER {self.user};"
            subprocess.run(
                ['sudo', '-u', 'postgres', 'psql', '-c', cmd],
                check=True, capture_output=True
            )
            print_success(f"Banco de dados '{self.db_name}' criado")
            
            # Habilitar extensões
            extensions = ['pgcrypto', 'uuid-ossp']
            for ext in extensions:
                cmd = f"CREATE EXTENSION IF NOT EXISTS \"{ext}\";"
                subprocess.run(
                    ['sudo', '-u', 'postgres', 'psql', '-d', self.db_name, '-c', cmd],
                    check=True, capture_output=True
                )
            print_success("Extensões habilitadas")
            
            return True
        except subprocess.CalledProcessError as e:
            print_error(f"Erro ao criar banco de dados: {e}")
            return False
    
    def run_migrations(self, migrations_dir: str) -> bool:
        migrations_path = Path(migrations_dir)
        if not migrations_path.exists():
            print_warning(f"Diretório de migrations não encontrado: {migrations_dir}")
            return True
        
        migration_files = sorted(migrations_path.glob('*.sql'))
        
        for migration in migration_files:
            try:
                print_info(f"Executando: {migration.name}")
                subprocess.run(
                    ['psql', '-h', self.host, '-p', str(self.port), 
                     '-U', self.user, '-d', self.db_name, '-f', str(migration)],
                    check=True, capture_output=True,
                    env={**os.environ, 'PGPASSWORD': self.password}
                )
                print_success(f"Migration aplicada: {migration.name}")
            except subprocess.CalledProcessError as e:
                print_error(f"Erro na migration {migration.name}: {e}")
                return False
        
        return True
    
    def test_connection(self) -> bool:
        try:
            result = subprocess.run(
                ['psql', '-h', self.host, '-p', str(self.port), 
                 '-U', self.user, '-d', self.db_name, '-c', 'SELECT 1;'],
                capture_output=True, text=True,
                env={**os.environ, 'PGPASSWORD': self.password}
            )
            if result.returncode == 0:
                print_success("Conexão com banco de dados OK")
                return True
        except Exception as e:
            print_error(f"Erro ao testar conexão: {e}")
        return False
    
    def get_connection_string(self) -> str:
        return f"postgresql://{self.user}:{self.password}@{self.host}:{self.port}/{self.db_name}"


class SQLServerInstaller(DatabaseInstaller):
    """Instalador para Microsoft SQL Server"""
    
    def default_port(self) -> int:
        return 1433
    
    def check_installation(self) -> bool:
        try:
            result = subprocess.run(['sqlcmd', '-?'], capture_output=True, text=True)
            if result.returncode == 0:
                print_success("SQL Server tools encontrado")
                return True
        except FileNotFoundError:
            pass
        
        print_warning("SQL Server não encontrado")
        self._print_install_instructions()
        return False
    
    def _print_install_instructions(self):
        system = platform.system()
        
        if system == 'Linux':
            print_info("""
Para instalar SQL Server no Linux:

# Ubuntu/Debian
curl https://packages.microsoft.com/keys/microsoft.asc | sudo apt-key add -
curl https://packages.microsoft.com/config/ubuntu/$(lsb_release -rs)/mssql-server-2022.list | sudo tee /etc/apt/sources.list.d/mssql-server-2022.list
sudo apt update
sudo apt install -y mssql-server
sudo /opt/mssql/bin/mssql-conf setup

# Instalar ferramentas cliente
sudo apt install -y mssql-tools18 unixodbc-dev
""")
        elif system == 'Windows':
            print_info("""
Baixe o SQL Server Express de:
https://www.microsoft.com/pt-br/sql-server/sql-server-downloads

Ou use: winget install Microsoft.SQLServer.2022.Express
""")
        elif system == 'Darwin':
            print_info("SQL Server não é suportado nativamente no macOS. Use Docker:")
            print_info("docker run -e 'ACCEPT_EULA=Y' -e 'SA_PASSWORD=YourStrong@Passw0rd' -p 1433:1433 -d mcr.microsoft.com/mssql/server:2022-latest")
    
    def create_user(self) -> bool:
        sql = f"""
USE master;
IF NOT EXISTS (SELECT * FROM sys.server_principals WHERE name = '{self.user}')
BEGIN
    CREATE LOGIN {self.user} WITH PASSWORD = '{self.password}';
END
"""
        return self._execute_sql(sql, "Usuário criado")
    
    def create_database(self) -> bool:
        sql = f"""
IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = '{self.db_name}')
BEGIN
    CREATE DATABASE {self.db_name};
END
GO
USE {self.db_name};
IF NOT EXISTS (SELECT * FROM sys.database_principals WHERE name = '{self.user}')
BEGIN
    CREATE USER {self.user} FOR LOGIN {self.user};
    ALTER ROLE db_owner ADD MEMBER {self.user};
END
"""
        return self._execute_sql(sql, f"Banco de dados '{self.db_name}' criado")
    
    def _execute_sql(self, sql: str, success_msg: str) -> bool:
        try:
            # Salvar SQL em arquivo temporário
            import tempfile
            with tempfile.NamedTemporaryFile(mode='w', suffix='.sql', delete=False) as f:
                f.write(sql)
                sql_file = f.name
            
            result = subprocess.run(
                ['sqlcmd', '-S', f'{self.host},{self.port}', 
                 '-U', 'sa', '-P', self.config.get('sa_password', 'YourStrong@Passw0rd'),
                 '-i', sql_file],
                capture_output=True, text=True
            )
            
            os.unlink(sql_file)
            
            if result.returncode == 0:
                print_success(success_msg)
                return True
            else:
                print_error(f"Erro: {result.stderr}")
                return False
                
        except Exception as e:
            print_error(f"Erro ao executar SQL: {e}")
            return False
    
    def run_migrations(self, migrations_dir: str) -> bool:
        # Converter migrations PostgreSQL para T-SQL seria necessário
        print_warning("Migrations para SQL Server requerem conversão manual do PostgreSQL")
        return True
    
    def test_connection(self) -> bool:
        try:
            result = subprocess.run(
                ['sqlcmd', '-S', f'{self.host},{self.port}', 
                 '-U', self.user, '-P', self.password,
                 '-Q', 'SELECT 1'],
                capture_output=True, text=True
            )
            if result.returncode == 0:
                print_success("Conexão com SQL Server OK")
                return True
        except Exception as e:
            print_error(f"Erro ao testar conexão: {e}")
        return False
    
    def get_connection_string(self) -> str:
        return f"mssql://{self.user}:{self.password}@{self.host}:{self.port}/{self.db_name}"


class OracleInstaller(DatabaseInstaller):
    """Instalador para Oracle Database"""
    
    def default_port(self) -> int:
        return 1521
    
    def check_installation(self) -> bool:
        try:
            result = subprocess.run(['sqlplus', '-V'], capture_output=True, text=True)
            if result.returncode == 0:
                print_success(f"Oracle encontrado: {result.stdout.strip()}")
                return True
        except FileNotFoundError:
            pass
        
        print_warning("Oracle Database não encontrado")
        self._print_install_instructions()
        return False
    
    def _print_install_instructions(self):
        print_info("""
Oracle Database requer instalação manual.

Opções:
1. Oracle Database XE (Express Edition) - Gratuito para desenvolvimento
   https://www.oracle.com/database/technologies/xe-downloads.html

2. Oracle Database Free (23c)
   https://www.oracle.com/database/free/

3. Docker:
   docker run -d -p 1521:1521 -e ORACLE_PASSWORD=YourPassword123 container-registry.oracle.com/database/free:latest
""")
    
    def create_user(self) -> bool:
        sql = f"""
CREATE USER {self.user} IDENTIFIED BY "{self.password}";
GRANT CONNECT, RESOURCE, DBA TO {self.user};
GRANT CREATE SESSION TO {self.user};
GRANT UNLIMITED TABLESPACE TO {self.user};
"""
        return self._execute_sql(sql, "Usuário Oracle criado")
    
    def create_database(self) -> bool:
        # Oracle usa tablespaces em vez de databases separados
        print_info("Oracle usa schemas em vez de databases separados")
        print_info(f"Será usado o schema do usuário '{self.user}'")
        return True
    
    def _execute_sql(self, sql: str, success_msg: str) -> bool:
        try:
            import tempfile
            with tempfile.NamedTemporaryFile(mode='w', suffix='.sql', delete=False) as f:
                f.write(sql)
                f.write("\nEXIT;\n")
                sql_file = f.name
            
            conn_string = f'{self.config.get("dba_user", "SYSTEM")}/{self.config.get("dba_password", "oracle")}@{self.host}:{self.port}/{self.config.get("service_name", "XEPDB1")}'
            
            result = subprocess.run(
                ['sqlplus', '-S', conn_string, f'@{sql_file}'],
                capture_output=True, text=True
            )
            
            os.unlink(sql_file)
            
            if 'ORA-' not in result.stdout and result.returncode == 0:
                print_success(success_msg)
                return True
            else:
                print_error(f"Erro: {result.stdout}")
                return False
                
        except Exception as e:
            print_error(f"Erro ao executar SQL: {e}")
            return False
    
    def run_migrations(self, migrations_dir: str) -> bool:
        print_warning("Migrations para Oracle requerem conversão manual do PostgreSQL")
        return True
    
    def test_connection(self) -> bool:
        try:
            conn_string = f'{self.user}/{self.password}@{self.host}:{self.port}/{self.config.get("service_name", "XEPDB1")}'
            result = subprocess.run(
                ['sqlplus', '-S', conn_string],
                input='SELECT 1 FROM DUAL;\nEXIT;\n',
                capture_output=True, text=True
            )
            if result.returncode == 0 and 'ORA-' not in result.stdout:
                print_success("Conexão com Oracle OK")
                return True
        except Exception as e:
            print_error(f"Erro ao testar conexão: {e}")
        return False
    
    def get_connection_string(self) -> str:
        service_name = self.config.get('service_name', 'XEPDB1')
        return f"oracle://{self.user}:{self.password}@{self.host}:{self.port}/{service_name}"


def create_env_file(connection_string: str, db_type: str, output_dir: str = '.'):
    """Cria arquivo .env.local com configurações do banco"""
    env_content = f"""# Configuração do Banco de Dados
# Gerado automaticamente pelo instalador SuperPonto
# Tipo: {db_type.upper()}

# Conexão com o banco
DATABASE_URL={connection_string}

# Configurações do Backend
API_PORT=3001
NODE_ENV=production

# JWT (ALTERE EM PRODUÇÃO!)
JWT_SECRET=superponto_jwt_secret_change_me_in_production_{os.urandom(8).hex()}
JWT_REFRESH_SECRET=superponto_refresh_secret_change_me_in_production_{os.urandom(8).hex()}

# Frontend
FRONTEND_URL=http://localhost:5173
VITE_API_URL=http://localhost:3001
"""
    
    env_path = Path(output_dir) / '.env.local'
    with open(env_path, 'w') as f:
        f.write(env_content)
    
    print_success(f"Arquivo de configuração criado: {env_path}")
    return env_path


def main():
    parser = argparse.ArgumentParser(description='SuperPonto - Instalador Multi-Database')
    parser.add_argument('--db', choices=['postgresql', 'sqlserver', 'oracle'], 
                        default='postgresql', help='Tipo de banco de dados')
    parser.add_argument('--host', default='localhost', help='Host do banco de dados')
    parser.add_argument('--port', type=int, help='Porta do banco de dados')
    parser.add_argument('--user', default='superponto', help='Usuário do banco')
    parser.add_argument('--password', default='SuperPonto@2024', help='Senha do banco')
    parser.add_argument('--database', default='superponto', help='Nome do banco de dados')
    parser.add_argument('--migrations', default='supabase/migrations', help='Diretório das migrations')
    parser.add_argument('--output', default='.', help='Diretório de saída para .env.local')
    parser.add_argument('--skip-install', action='store_true', help='Pular instalação do banco')
    parser.add_argument('--skip-migrations', action='store_true', help='Pular execução das migrations')
    
    args = parser.parse_args()
    
    print_header()
    
    config = {
        'host': args.host,
        'port': args.port,
        'user': args.user,
        'password': args.password,
        'database': args.database,
    }
    
    # Selecionar instalador
    installers = {
        'postgresql': PostgreSQLInstaller,
        'sqlserver': SQLServerInstaller,
        'oracle': OracleInstaller,
    }
    
    installer_class = installers.get(args.db)
    if not installer_class:
        print_error(f"Banco de dados não suportado: {args.db}")
        sys.exit(1)
    
    installer = installer_class(config)
    
    print(f"\n{Colors.BOLD}Configurando {args.db.upper()}...{Colors.ENDC}\n")
    
    # 1. Verificar/Instalar banco de dados
    if not args.skip_install:
        if not installer.check_installation():
            print_error("Falha ao verificar/instalar banco de dados")
            sys.exit(1)
    
    # 2. Criar usuário
    print_info("Criando usuário...")
    if not installer.create_user():
        print_warning("Continuando mesmo com erro na criação do usuário...")
    
    # 3. Criar banco de dados
    print_info("Criando banco de dados...")
    if not installer.create_database():
        print_error("Falha ao criar banco de dados")
        sys.exit(1)
    
    # 4. Executar migrations
    if not args.skip_migrations:
        print_info("Executando migrations...")
        if not installer.run_migrations(args.migrations):
            print_warning("Algumas migrations podem ter falhado")
    
    # 5. Testar conexão
    print_info("Testando conexão...")
    if not installer.test_connection():
        print_warning("Teste de conexão falhou, mas o banco pode estar configurado corretamente")
    
    # 6. Criar arquivo .env.local
    connection_string = installer.get_connection_string()
    create_env_file(connection_string, args.db, args.output)
    
    print(f"""
{Colors.GREEN}{Colors.BOLD}
╔═══════════════════════════════════════════════════════════════╗
║                  INSTALAÇÃO CONCLUÍDA!                        ║
╚═══════════════════════════════════════════════════════════════╝{Colors.ENDC}

{Colors.BLUE}Próximos passos:{Colors.ENDC}

1. Verifique o arquivo .env.local gerado
2. Inicie o backend:
   cd server && npm install && npm run dev

3. Inicie o frontend:
   npm run dev

4. Acesse: http://localhost:5173

{Colors.YELLOW}Importante: Altere os JWT secrets em produção!{Colors.ENDC}
""")


if __name__ == '__main__':
    main()
