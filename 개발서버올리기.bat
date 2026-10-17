@echo off
chcp 65001 >nul
rem 개발 서버(develop-idlegame)에 올립니다. 라이브(친구들이 쓰는 서버)는 건드리지 않습니다.
rem 주소: https://develop-idlegame.idlegame-server.workers.dev  (운영자 화면: /admin.html)
cd /d "%~dp0server"
call npm run sync
call npx wrangler d1 execute idlegame-dev --remote --file=schema.sql --yes
call npx wrangler deploy --env develop
pause
