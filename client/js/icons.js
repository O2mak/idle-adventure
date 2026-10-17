// 글자 옆에 붙이는 작은 도트 아이콘 (12x12, 코드로 그림). 사용: mi('heart')
const MINI_ICONS = {
  heart: (s) => { _ell(s, 3.6, 4, 2.9, 2.7, _pal('#ff5a6a')); _ell(s, 8.4, 4, 2.9, 2.7, _pal('#ff5a6a')); _tri(s, 0.8, 5, 11.2, 5, 6, 11, '#e8404f'); _px(s, 3, 3, '#ffc0c8'); },
  sword: (s) => { for (let i = 0; i < 8; i++) { _px(s, 2 + i, 9 - i, '#eef3fb'); _px(s, 3 + i, 9 - i, '#aab6c8'); } _rect(s, 1, 8, 4, 1, '#e8b83a'); _rect(s, 3, 6, 1, 4, '#e8b83a'); _px(s, 1, 10, '#8a5a2a'); _px(s, 2, 9, '#8a5a2a'); },
  magic: (s) => { _rect(s, 5, 1, 2, 10, '#ffd65a'); _rect(s, 1, 5, 10, 2, '#ffd65a'); _rect(s, 3, 3, 6, 6, '#7ab8ff'); _px(s, 3, 3, '#fff'); _px(s, 8, 8, '#4a8ae0'); },
  shield: (s) => { _rect(s, 2, 1, 8, 6, '#5a9aff'); _tri(s, 2, 6, 10, 6, 6, 11.5, '#5a9aff'); _rect(s, 5, 1, 2, 9, '#cfe2ff'); _rect(s, 2, 4, 8, 1, '#cfe2ff'); },
  bolt: (s) => { _tri(s, 7, 0.5, 2, 7, 6, 7, '#ffd23a'); _tri(s, 6, 5, 5, 11.5, 10.5, 4.5, '#ffd23a'); },
  coin: (s) => { _ell(s, 6, 6, 5, 5, _pal('#ffcf3a')); _ell(s, 6, 6, 3, 3, { b: '#ffe58a' }); _rect(s, 5, 4, 2, 4, '#d49a1a'); },
  gift: (s) => { _rect(s, 1, 4, 10, 7, '#e8505f'); _rect(s, 1, 2, 10, 3, '#ff7a86'); _rect(s, 5, 2, 2, 9, '#ffe066'); _tri(s, 6, 2, 2, 0, 5, 3, '#ffe066'); _tri(s, 6, 2, 10, 0, 7, 3, '#ffe066'); },
  growth: (s) => { _tri(s, 6, 0.5, 1, 6.5, 11, 6.5, '#5ae06a'); _rect(s, 4, 6, 4, 5, '#3ab84a'); },
  hat: (s) => { _tri(s, 6, 0, 1.5, 8.5, 10.5, 8.5, '#c47bff'); _rect(s, 0, 8, 12, 3, '#e0b8ff'); _px(s, 6, 4, '#fff'); },
  star: (s) => { _rect(s, 5, 0, 2, 12, '#ffd23a'); _rect(s, 0, 5, 12, 2, '#ffd23a'); _rect(s, 3, 3, 6, 6, '#ffe58a'); _px(s, 4, 4, '#fff'); },
  flag: (s) => { _rect(s, 2, 0, 1, 12, '#9a6a3a'); _tri(s, 3, 1, 3, 7, 11, 4, '#ff5a5a'); _px(s, 4, 3, '#ffb0b0'); },
  tower: (s) => { _rect(s, 3, 3, 6, 8, '#b8c0d0'); for (const x of [3, 5, 7]) _rect(s, x, 1, 2, 3, '#b8c0d0'); _rect(s, 5, 7, 2, 4, '#4a5a78'); _px(s, 4, 5, '#4a5a78'); _px(s, 7, 5, '#4a5a78'); },
  gem: (s) => { _tri(s, 1, 4, 11, 4, 6, 11.5, '#38c8e8'); _tri(s, 1, 4, 4, 0.5, 8, 0.5, '#8ae8ff'); _rect(s, 1, 3, 10, 2, '#8ae8ff'); _rect(s, 4, 0, 4, 4, '#8ae8ff'); _px(s, 4, 5, '#d8f8ff'); },
  gear: (s) => { _ell(s, 6, 6, 4.2, 4.2, _pal('#a8b2c4')); for (const [x, y] of [[5, 0], [5, 10], [0, 5], [10, 5]]) _rect(s, x, y, 2, 2, '#a8b2c4'); _ell(s, 6, 6, 1.8, 1.8, { b: '#1d212b' }); },
  crown: (s) => { _rect(s, 1, 6, 10, 4, '#ffd23a'); for (const x of [1, 5, 9]) _tri(s, x, 6, x + 2, 6, x + 1, 1.5, '#ffd23a'); _px(s, 6, 8, '#ff5a5a'); },
  clock: (s) => { _ell(s, 6, 6, 5, 5, _pal('#e8eef8')); _rect(s, 6, 3, 1, 4, '#3a4258'); _rect(s, 6, 6, 3, 1, '#3a4258'); },
};
const _miCache = {};
function miniIconUrl(name) {
  if (_miCache[name]) return _miCache[name];
  const s = _mk(12, 12);
  if (MINI_ICONS[name]) MINI_ICONS[name](s);
  _outline(s, '#1a1620');
  return (_miCache[name] = s.c.toDataURL());
}
function mi(name) { return `<img class="mi" src="${miniIconUrl(name)}" alt="">`; }
