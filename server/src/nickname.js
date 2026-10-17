// 닉네임 / 아이디 / 비밀번호 규칙. 규칙은 느슨하게: 욕설과 운영자 사칭만 막고, 나머지는 나중에 운영자가 걸러냄
const BAD_WORDS = [
  '시발', '씨발', '씨바', '시바', '병신', '븅신', '개새끼', '지랄', '좆', '존나', '염병', '미친놈', '미친년', '썅', '창녀', '섹스',
  'fuck', 'shit', 'bitch', 'asshole', 'dick', 'pussy', 'nigger',
];
const RESERVED = ['운영자', '관리자', '관리인', 'admin', 'gm', 'system', '시스템'];

// 띄어쓰기/기호로 우회하는 경우를 막기 위해 글자만 남겨서 비교
const squash = (s) => s.toLowerCase().replace(/[^0-9a-z가-힣ㄱ-ㅎㅏ-ㅣ]/g, '');

export function checkNickname(raw) {
  const nick = String(raw ?? '').trim();
  if (nick.length < 2 || nick.length > 12) return { ok: false, message: '닉네임은 2~12자로 정해 주세요.' };
  if (/[\u0000-\u001f<>]/.test(nick)) return { ok: false, message: '사용할 수 없는 문자가 들어 있어요.' };
  const flat = squash(nick);
  if (BAD_WORDS.some((w) => flat.includes(w))) return { ok: false, message: '사용할 수 없는 단어가 들어 있어요.' };
  if (RESERVED.some((w) => flat === w || flat.startsWith(w))) return { ok: false, message: '사용할 수 없는 닉네임이에요.' };
  return { ok: true, nickname: nick };
}

export function checkLoginId(raw) {
  const id = String(raw ?? '').trim();
  if (id.length < 2 || id.length > 24) return { ok: false, message: '아이디는 2~24자로 정해 주세요.' };
  if (/\s/.test(id)) return { ok: false, message: '아이디에는 공백을 넣을 수 없어요.' };
  return { ok: true, loginId: id };
}

export function checkPassword(raw) {
  const pw = String(raw ?? '');
  if (pw.length < 4) return { ok: false, message: '비밀번호는 4자 이상으로 정해 주세요.' };
  if (pw.length > 100) return { ok: false, message: '비밀번호가 너무 길어요.' };
  return { ok: true, password: pw };
}

