# 인수인계 (HANDOFF)

새 세션은 이 파일을 먼저 읽고 시작합니다. 결정한 것, 설정한 것, 빠지기 쉬운 함정만 적습니다. 작업이 끝날 때마다 바뀐 부분만 갱신합니다. **비밀의 값은 절대 적지 않습니다(이름만).**

## 배포 구조 (GitHub 브랜치 → 자동 배포)
| 브랜치 | 서버 | 주소 | Worker 이름 | DB(D1) | 시즌 |
|---|---|---|---|---|---|
| `develop` | 베타(테스트) | https://develop-idlegame.bangchi.workers.dev | `develop-idlegame` | `idlegame-dev` | 테스트 6시간 |
| `cloudflare` | 라이브(친구들이 사용) | https://idlegame.bangchi.workers.dev | `idlegame` | `idlegame` | 테스트 시즌: 시즌 3을 2026-11-15 06:00까지 유지 (624시간, 번호 +2. 정식 운영 때 정리) |
| `main` | 보관용 (배포 안 됨) | - | - | - | - |

- 배포는 GitHub Actions(`.github/workflows/deploy-develop.yml`, `deploy-live.yml`)가 합니다. 순서: `npm ci` → `npm run sync`(화면·서버 공유 코드 복사) → DB 표 적용(`schema.sql`, 이미 있으면 그대로) → `wrangler deploy`. 라이브는 앞에 서버 테스트(임시 로컬 서버)가 통과해야 합니다.
- 서버 하나(Worker)가 화면(`client` 폴더)과 서버(`/api/*`)를 같이 서빙합니다. 화면만 바꿔도 같은 Worker가 다시 올라갑니다. 실시간 연결(웹소켓)은 없습니다.
- 라이브 배포에는 테스트 시즌용 값 두 개(`FIRST_SEASON_START=2026-10-16T06:00:00+09:00`, `TEST_SEASON_HOURS=48`)가 `deploy-live.yml`에 들어 있습니다. **정식 운영을 시작할 때 이 두 `--var`를 지우고 `server/wrangler.toml`의 `FIRST_SEASON_START`(2026-12-01 06:00)를 확정해야 합니다.**
- 예전 방식(PC에서 `배포.bat`, `개발서버올리기.bat`)도 남아 있지만 이제는 쓰지 않습니다.

## 저장 공간 분리
- 서버가 쓰는 저장 공간은 D1(SQLite) 하나뿐입니다. 라이브(`idlegame`)와 베타(`idlegame-dev`)는 서로 다른 DB라서 섞이지 않습니다. Durable Objects와 KV는 쓰지 않습니다.

## 비밀(Secret) 이름 목록 (값은 적지 않음)
- Cloudflare Worker 비밀: `ADMIN_KEY` (라이브 `idlegame`와 베타 `develop-idlegame`에 **각각** 등록됨). 선택: `DISCORD_WEBHOOK` (의견 알림, 지금은 미등록)
- GitHub Actions 비밀: `CLOUDFLARE_API_TOKEN`(Workers 편집 + D1 편집 권한), `CLOUDFLARE_ACCOUNT_ID`
- PC에 있는 키 파일(깃 제외): `운영자키.txt`, `픽셀랩키.txt`(PixelLab API 키), `server/.dev.vars`(로컬 테스트용)

## 알아 둘 함정
- `server/src/shared/game.generated.js`는 자동 생성 파일(깃 제외)입니다. 화면 규칙(`client/js/config.js`, `game.js`)을 바꾸면 `npm run sync`가 필요합니다. Actions는 이 단계를 자동으로 실행합니다.
- 서버 테스트(`server/test/api.test.mjs`)는 로컬 서버(`npm run dev`)가 떠 있어야 돌아갑니다.
- PixelLab 무료 체험 한도는 모두 사용했습니다. 그림 추가는 유료 구독이 필요합니다. 그림 목록은 `client/js/monsters.js`의 `ART_SET`입니다.
- 이미 열려 있는 게임 화면(옛 버전)이 저장하면 옛 형식으로 덮어쓸 수 있으니 라이브 배포 후 새로고침을 안내합니다.

## 아직 남은 일
- 2~10지역 일반 몬스터, 5~10지역 보스, 강아지를 PixelLab 그림으로 교체 (유료 구독 필요)
- 정식 운영 준비: 테스트 시즌 설정 정리, 시즌 시작일 확정, 시즌 랭킹/광고 연결(도메인 필요)