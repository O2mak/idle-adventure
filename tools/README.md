# 밸런스 도구

- `node tools/sim.js <하루 접속 시간> <일수> <직업> <시드>` : 효율적으로 플레이하는 가상 플레이어를 돌려서 지역별 클리어 시각/레벨을 출력 (예: `node tools/sim.js 3 14 melee 1`)
- `node tools/calibrate.js <반복 횟수>` : 지역별 몬스터 강도(`tune.hp/atk`)와 경험치(`tune.exp`)를 목표 시간표/레벨표에 맞게 자동 조정.
  결과는 `tools/tune.json`에 저장되며, 값을 `client/js/config.js`의 `tune`에 옮겨 넣으면 됩니다. 목표 시간표(`DUR`)와 레벨표(`LV`)는 파일 위쪽에서 바꿀 수 있어요.
