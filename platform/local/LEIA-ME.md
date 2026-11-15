# SuperPonto — versão local (no seu computador)

Roda o sistema completo no seu computador para testar antes de publicar: banco de dados, API,
site e uma caixa de e-mail de teste. Nada aqui afeta o sistema publicado.

## 1. Instale uma vez

- **Docker Desktop**: https://www.docker.com/products/docker-desktop/ (Windows ou Mac). Abra o
  Docker Desktop e espere ele indicar que está rodando.
- **O projeto**: no GitHub, botão verde **Code › Download ZIP** e descompacte; ou
  `git clone https://github.com/uviniribeiro/superponto.git`.

## 2. Inicie

- **Windows**: abra a pasta `superponto\platform\local` e dê dois cliques em **iniciar.bat**.
- **Mac / Linux**: no Terminal, `cd superponto/platform/local` e `./iniciar.sh`.

Na primeira vez ele pergunta o e-mail e a senha do administrador e monta tudo (leva alguns
minutos). Depois abre o navegador sozinho.

| Endereço | O que é |
|---|---|
| http://localhost:3001 | O sistema (entre com o e-mail e a senha que você escolheu) |
| http://localhost:8025 | Caixa de e-mail de teste: convites e "esqueci minha senha" chegam aqui |
| http://localhost:3000/docs | Documentação da API |

## 3. No dia a dia

- **Parar**: `parar.bat` (Windows) ou `./parar.sh`. Os dados ficam guardados.
- **Atualizar para a versão mais nova**: baixe o projeto de novo (ou `git pull`) e rode o iniciar:
  ele recompila e aplica as mudanças do banco automaticamente.
- **Começar do zero** (apaga os dados de teste): `docker compose --env-file .env down -v` nesta
  pasta e apague o arquivo `.env`.

As senhas e chaves desta versão ficam em `local/.env`, gerado na primeira execução e nunca enviado
ao GitHub. Não use esta versão como servidor de produção.
