// 비밀번호 해시 / 세션 토큰 (Web Crypto)
const enc = new TextEncoder();
const ITERATIONS = 100000; // Workers가 지원하는 PBKDF2 최대치

const toB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

async function derive(password, salt) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS }, key, 256);
}

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { hash: toB64(await derive(password, salt)), salt: toB64(salt) };
}

export async function verifyPassword(password, hashB64, saltB64) {
  const got = new Uint8Array(await derive(password, fromB64(saltB64)));
  const want = fromB64(hashB64);
  if (got.length !== want.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got[i] ^ want[i]; // 시간차 공격을 막기 위한 비교
  return diff === 0;
}

export function randomToken() {
  return toHex(crypto.getRandomValues(new Uint8Array(32)));
}

export async function sha256Hex(text) {
  return toHex(await crypto.subtle.digest('SHA-256', enc.encode(text)));
}
