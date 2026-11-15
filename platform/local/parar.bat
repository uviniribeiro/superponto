@echo off
cd /d "%~dp0"
docker compose --env-file .env down
pause
