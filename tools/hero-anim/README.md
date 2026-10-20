# 영웅 동작 만들기 (고양이·강아지)

`src/`의 64x64 도트 원본 그림을 부위(머리, 몸통, 팔, 다리, 꼬리, 스카프/망토)로 나눈 뒤, 칸 단위로 옮겨서 동작 프레임을 만듭니다. 결과는 96x96 칸 그림입니다.

1. `node read.mjs` : 원본 그림을 칸 격자로 읽어서 `out/<cat|dog>_grid.json`으로 저장 (puppeteer-core와 크롬 필요)
2. `node anim.mjs cat` / `node anim.mjs dog` : `out/`에 east(서 있기), idle(대기 8장), walk(걷기 6장), attack(공격 3장) 그림과 확인용 확대본(`*_x3.png`, 부위 색칠 `*_parts_x6.png`)을 만듦
3. 마음에 들면 `out/<동물>_{east,idle,walk,attack}.png`를 `client/img/`로 복사

- 부위 나누는 범위는 `anim.mjs`의 `PARTS`, 동작 크기는 아래쪽 `pose(...)` 값으로 조절합니다.
- 무기를 쥐는 손 위치는 `client/js/chars.js`의 `HEROES`(hand, far)와 `HERO_WALK_HAND`, `HERO_ATK_HAND`에 있습니다. `anim.mjs`가 만드는 `out/*_hands.json` 값을 절반으로 나눈 것입니다.
