# 인수인계 (HANDOFF)

새 세션은 이 파일을 먼저 읽고 시작합니다. 결정한 것, 설정한 것, 빠지기 쉬운 함정만 적습니다. 작업이 끝날 때마다 바뀐 부분만 갱신합니다. **비밀의 값은 절대 적지 않습니다(이름만).** 자세한 변경 이력은 `기획서.md`(번호 붙은 절)에 있습니다. 지금까지 66번.

## 배포 구조 (GitHub 브랜치 → 자동 배포)
| 브랜치 | 서버 | 주소 | Worker 이름 | DB(D1) | 시즌 |
|---|---|---|---|---|---|
| `develop` | 베타(테스트) | https://develop-idlegame.bangchi.workers.dev | `develop-idlegame` | `idlegame-dev` | 테스트 6시간 (아직 브랜치를 만들지 않음) |
| `cloudflare` | 라이브(친구들이 사용) | https://idlegame.bangchi.workers.dev | `idlegame` | `idlegame` | 테스트 시즌: 시즌 3을 2026-11-15 06:00까지 유지 (624시간, 번호 +2). 정식 운영 때 정리 |
| `main` | 보관용 (배포 안 됨) | - | - | - | - |

- 배포는 GitHub Actions(`.github/workflows/deploy-develop.yml`, `deploy-live.yml`)가 합니다. 순서: `npm ci` → `npm run sync`(화면·서버 공유 코드 복사) → DB 표 적용(`schema.sql`, 이미 있으면 그대로) → `wrangler deploy`. 라이브는 앞에 서버 테스트(임시 로컬 서버, 114개)가 통과해야 합니다.
- push 규칙: `CLAUDE.md` 참고. 올리기 전에 항상 "1 라이브 / 2 베타"를 묻습니다. 1이면 `git push origin main:cloudflare`, 2이면 `main:develop`.
- 서버 하나(Worker)가 화면(`client` 폴더)과 서버(`/api/*`)를 같이 서빙합니다. 화면만 바꿔도 같은 Worker가 다시 올라갑니다.
- 라이브 배포의 테스트 시즌 값(`deploy-live.yml`): `FIRST_SEASON_START=2026-10-20T06:00:00+09:00`, `TEST_SEASON_HOURS=624`, `TEST_SEASON_OFFSET=2`. 이 값이면 시즌 3이 11/15 06:00에 끝나고 시즌 4가 이어집니다. **정식 운영을 시작할 때 이 세 `--var`를 지우고 `server/wrangler.toml`의 `FIRST_SEASON_START`(2026-12-01 06:00)를 확정해야 합니다.** 시즌 길이만 바꾸면 시즌 번호가 다시 1부터 계산되니 `TEST_SEASON_OFFSET`으로 번호를 맞춰야 합니다.

## 저장 공간 분리
- 서버가 쓰는 저장 공간은 D1(SQLite) 하나뿐입니다. 라이브(`idlegame`)와 베타(`idlegame-dev`)는 서로 다른 DB입니다.

## 비밀(Secret) 이름 목록 (값은 적지 않음)
- Cloudflare Worker 비밀: `ADMIN_KEY` (라이브와 베타에 각각 등록됨). 선택: `DISCORD_WEBHOOK`(미등록)
- GitHub Actions 비밀: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` (등록됨)
- PC에 있는 키 파일(깃 제외): `운영자키.txt`, `픽셀랩키.txt`, `픽셀러키.txt`(pixler.dev), `제미나이키.txt`, `server/.dev.vars`

## 지금 게임의 그림 구성 (제미나이·그림 AI로 만든 그림을 칸 격자로 줄여 사용)
- 영웅(고양이·코기): `client/img/{cat,dog}_{east,idle,walk,attack}.png`(96x96칸). 부위(머리·몸통·팔·다리·꼬리·스카프)를 칸 단위로 움직여 동작을 만듦. 만드는 도구와 원본: `tools/hero-anim/`(`anim.mjs`, `grid.mjs`, `topng.mjs`, `weapons.mjs`, `strip.mjs`, `README.md`).
- 캐릭터·몬스터는 화면에서 2배(`render.js`의 `HS`, `MS`). 몬스터는 화면에서만 오른쪽으로 띄움(`enemyPad`). 전투 거리·밸런스는 그대로.
- 몬스터·배경: `client/js/monsters.js`의 `ART_SET`. 1~6지역(한국·일본·중국·인도·이집트·이탈리아)은 제미나이 그림(일반 2종+보스), 7~10지역은 이전 코드 그림.
- 몬스터 시트 작업 순서(`tools/monster-gen/`, `docs/몬스터_시트_프롬프트.md`): 제미나이 앱에서 나라당 한 장 받음 → `node slice.mjs <그림> <지역>`(붙은 몬스터는 `cut:x1,y1,x2`로 나눔) → hero-anim에서 `node grid.mjs ../monster-gen/out/mon_<지역>_<0|1|boss>.png mon_<지역>_<..> 10.65` → `node build.mjs <지역>`(크기 맞춤) → `out/final`을 `client/img`로 복사 → `ART_SET` 연결 → `node shot.mjs <지역>`·`montage.mjs`로 화면 확인. 제미나이 API 키(`제미나이키.txt`)는 이미지 생성 한도가 0이라 못 씀(유료 연결 필요).
- 무기 22종: `client/img/weapons/`(48x48칸). 일반은 직업×등급(`melee_0`~`mage_3`), 전설은 `legend_이름.png`. 없으면 코드로 그린 예전 무기를 씀.
- 가까운 풍경 띠 10개: `client/img/near_1~10.png`. 먼 배경보다 빠르게 흐름. 구조물 간격을 `nearSpread`(`NEAR_GAP=1.8`)가 넓힘. 끝에 걸친 물체는 이음매를 옮기거나 지움, `nearMirror`는 좌우 뒤집어 이음.
- 그림 AI에게 요청하는 문장: `docs/몬스터_프롬프트.md`, `docs/무기_프롬프트.md`, `docs/배경_프롬프트.md`. 바탕화면에 참고용 폴더 `몬스터_참고그림`, `무기_참고그림`, `배경_참고그림`이 있음.
- 새 그림을 받으면: 큰 그림을 `tools/hero-anim/grid.mjs`(캐릭터·몬스터)나 `strip.mjs`(풍경 띠)로 칸 크기를 찾아 줄이고, 자홍색(#FF00FF) 배경을 지운 뒤 `client/img/`에 넣고 `ART_SET`에 연결. 넣은 뒤 반드시 게임 화면 사진으로 확인(예: puppeteer 스크립트, 작업 폴더에 있었음).

## 규칙·기능 메모 (최근)
- 합성: 무기 / 방어구(모자+옷) / 장신구 세 묶음(`CFG.merge.groups`). 무기는 무기만, 모자·옷은 섞여서 모자나 옷, 장신구는 장신구만. 결과 직업은 랜덤.
- 보관함 정렬: 지금 직업이 착용할 수 있는 장비 → 등급 높은 순 → 부위 → 점수.
- 스테이지를 직접 골라 이동하면 체력 가득. 자동으로 다음 라운드로 갈 때는 그대로.
- 분리(작은 창): 영상 PiP(주소창 없음, 보기 전용). 지원 안 하는 브라우저는 예전 문서 PiP로 열림.
- 서버는 룰렛 보너스 시간을 "이전 저장값보다 늘어난 양"만 검사함(탭이 뒤에 있어도 저장 거부 안 됨).

## 알아 둘 함정
- `server/src/shared/game.generated.js`는 자동 생성 파일(깃 제외)입니다. 화면 규칙(`client/js/config.js`, `game.js`)을 바꾸면 `npm run sync`가 필요합니다. Actions는 이 단계를 자동으로 실행합니다.
- 서버 테스트(`server/test/api.test.mjs`)는 로컬 서버(`npm run dev`)가 떠 있어야 돌아갑니다. 테스트 후 wrangler 프로세스를 꼭 종료.
- PowerShell 5.1: 따옴표·정규식이 깨지니 파일 수정은 Edit 도구나 node 스크립트로. PowerShell 안에서 한글 문자열을 웹 응답과 비교하면 틀릴 수 있어서 영문 표식으로 확인.
- 이미 열려 있는 게임 화면(옛 버전)이 저장하면 옛 형식으로 덮어쓸 수 있으니 라이브 배포 후 새로고침을 안내합니다.
- 테스트용 브라우저는 매번 저장을 비워야(`localStorage.clear`) 이전 동물·장비가 남지 않습니다.

## 아직 남은 일
- 7 프랑스·8 영국·9 미국·10 브라질 몬스터(일반 2종+보스)를 새 그림으로 교체(제미나이 앱에서 시트 받아 넣기)
- 캐릭터 공격 동작은 그림이 만들어져 있으나 게임은 때리는 순간 내지르기·마무리 두 장만 사용. 힘 모으기 장면은 미사용.
- 무기 칼 휘두르기는 코드로 흔드는 방식(그림 동작 아님)
- 정식 운영 준비: 테스트 시즌 설정 정리, 시즌 시작일 확정, 시즌 랭킹 보상/광고 연결(도메인 필요), 도메인 구입 여부 결정
- 베타 서버(`develop` 브랜치)는 아직 만들지 않음. 처음 베타로 올릴 때 만들기
