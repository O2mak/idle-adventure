@echo off
chcp 65001 >nul
rem 라이브 서버(친구들이 쓰는 서버)에 올립니다. 먼저 개발 서버에서 확인한 뒤에만 사용하세요. (먼저 한 번 `npx wrangler login` 필요)
rem 테스트 시즌: 아래 두 값으로 시즌을 짧게 돌립니다. 정식 운영을 시작할 때는 두 --var 줄을 지우고 wrangler.toml의 FIRST_SEASON_START를 확정하세요.
echo.
echo  *** 라이브 서버(친구들이 지금 쓰는 서버)에 올립니다 ***
echo  개발 서버에서 충분히 확인했나요?
set /p OK=계속하려면 yes 를 입력하세요: 
if /i not "%OK%"=="yes" (echo 취소했어요. & pause & exit /b)
cd /d "%~dp0server"
call npm run sync
call npx wrangler d1 execute idlegame --remote --file=schema.sql --yes
call npx wrangler deploy --var FIRST_SEASON_START:2026-10-16T06:00:00+09:00 --var TEST_SEASON_HOURS:48
pause
