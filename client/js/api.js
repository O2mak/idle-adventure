// 서버와 통신. 같은 주소(/api/...)로 요청하므로 서버가 게임 화면도 함께 서비스해야 동작합니다.
const API = {
  token: null,
  tokenKey: 'idlegame_token',

  load() { try { this.token = localStorage.getItem(this.tokenKey) || null; } catch (e) { this.token = null; } },
  setToken(t) {
    this.token = t;
    try { if (t) localStorage.setItem(this.tokenKey, t); else localStorage.removeItem(this.tokenKey); } catch (e) { /* 무시 */ }
  },

  async call(method, path, body, keepalive) {
    let res;
    try {
      res = await fetch(path, {
        method,
        headers: { 'content-type': 'application/json', ...(this.token ? { authorization: 'Bearer ' + this.token } : {}) },
        body: body ? JSON.stringify(body) : undefined,
        keepalive: !!keepalive,
      });
    } catch (e) {
      throw { status: 0, code: 'network', message: '서버에 연결할 수 없어요. 인터넷 연결을 확인해 주세요.' };
    }
    let data = null;
    try { data = await res.json(); } catch (e) { /* 본문 없음 */ }
    if (!res.ok) throw { status: res.status, code: data && data.error, message: (data && data.message) || '요청에 실패했어요.' };
    return data;
  },

  async register(loginId, password, nickname, animal, cls) {
    const d = await this.call('POST', '/api/register', { loginId, password, nickname, animal, cls });
    this.setToken(d.token); return d;
  },
  async login(loginId, password) {
    const d = await this.call('POST', '/api/login', { loginId, password });
    this.setToken(d.token); return d;
  },
  me() { return this.call('GET', '/api/me'); },
  save(save, keepalive) { return this.call('PUT', '/api/save', { save }, keepalive); },
  ranking() { return this.call('GET', '/api/ranking'); },
  profile(nickname) { return this.call('GET', '/api/profile?nickname=' + encodeURIComponent(nickname)); },
  feedback(category, body, context) { return this.call('POST', '/api/feedback', { category, body, context }); },
  nickname(nickname) { return this.call('POST', '/api/nickname', { nickname }); },
  password(oldPassword, newPassword) { return this.call('POST', '/api/password', { oldPassword, newPassword }); },
  async logout() { try { await this.call('POST', '/api/logout'); } finally { this.setToken(null); } },
};

