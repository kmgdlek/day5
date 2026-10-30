/* 2단계: 데이터는 /api/places (Supabase)에서 받아 와서 window.__PLACES__ 에 들어 있습니다 */
document.querySelector('main').classList.remove('loading');
document.getElementById('boot').hidden = true;
const DATA = window.__PLACES__;
const SOURCE = window.__SOURCE__ || '';

const COLORS = { '민속': '#0d9488', '확장분야': '#d97706' };
const catClass = (c) => (c === '민속' ? 'minsok' : 'ext');
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const state = { cat: '', d1: '', q: '', sel: null, favOnly: false, stampF: '', city: '', sub: '' };

/* 내 메모·별점 { 장소id: { memo, rating, at } } 과 화면 설정(테마·글자 크기) — 브라우저에 저장 */
let notes = {};
try { notes = JSON.parse(localStorage.getItem('jeju-notes') || '{}'); } catch (e) { notes = {}; }
const saveNotes = () => { try { localStorage.setItem('jeju-notes', JSON.stringify(notes)); } catch (e) { /* 무시 */ } };
const prefs = { theme: 'auto', font: 0, view: '3d', spin: true };
try { Object.assign(prefs, JSON.parse(localStorage.getItem('jeju-prefs') || '{}')); } catch (e) { /* 무시 */ }
const savePrefs = () => { try { localStorage.setItem('jeju-prefs', JSON.stringify(prefs)); } catch (e) { /* 무시 */ } };

/* 도장 { 장소id: 찍은 시각 } — 브라우저에 저장해서 새로고침해도 남는다 */
let stamps = {};
try { stamps = JSON.parse(localStorage.getItem('jeju-stamps') || '{}'); } catch (e) { stamps = {}; }
const saveStamps = () => { try { localStorage.setItem('jeju-stamps', JSON.stringify(stamps)); } catch (e) { /* 저장 불가 환경이면 무시 */ } };
const stamped = (id) => String(id) in stamps;
const byId = new Map(DATA.map((p) => [p.id, p]));
// 주소에서 지역 뽑기: "제주특별자치도 제주시 용담일동 …" → 시 = 제주시, 읍·면·동 = 용담일동
DATA.forEach((p) => {
  const t = p.addr.split(/\s+/);
  p.city = /시$/.test(t[1] || '') ? t[1] : '';
  p.sub = p.city ? (t[2] || '') : '';
});

/* 찜한 장소의 id를 "고른 순서대로" 담는다. 브라우저에 저장해서 새로고침해도 남는다. */
let favs = [];
try { favs = JSON.parse(localStorage.getItem('jeju-favs') || '[]').filter((id) => byId.has(id)); } catch (e) { favs = []; }
const saveFavs = () => { try { localStorage.setItem('jeju-favs', JSON.stringify(favs)); } catch (e) { /* 저장 불가 환경이면 무시 */ } };

const isVisible = (p) => {
  if (state.city && p.city !== state.city) return false;
  if (state.sub && p.sub !== state.sub) return false;
  if (state.favOnly && !favs.includes(p.id)) return false;
  if (state.stampF === 'done' && !stamped(p.id)) return false;
  if (state.stampF === 'todo' && stamped(p.id)) return false;
  if (state.cat && p.cat !== state.cat) return false;
  if (state.d1 && p.d1 !== state.d1) return false;
  const q = state.q.trim().toLowerCase();
  if (!q) return true;
  return [p.name, p.title, p.subtitle, p.d1, p.d2, p.addr, p.subject.join(' ')].join(' ').toLowerCase().includes(q);
};
const visibleList = () => DATA.filter(isVisible).sort((a, b) => a.name.localeCompare(b.name, 'ko'));

/* ---------- 상단 통계 / 칩 ---------- */
function countBy(key) {
  const m = new Map();
  DATA.forEach((p) => p[key] && m.set(p[key], (m.get(p[key]) || 0) + 1));
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}
function renderStats() {
  const cats = countBy('cat');
  $('#stats').innerHTML =
    `<span class="stat"><b>${DATA.length}</b>장소</span>` +
    cats.map(([c, n]) => `<span class="stat"><b>${n}</b>${esc(c)}</span>`).join('') +
    `<span class="stat"><b>${countBy('d1').length}</b>주제 구분</span>`;
}
function renderChips() {
  const mk = (label, n, on, attrs, extra = '') =>
    `<button class="chip ${extra} ${on ? 'on' : ''}" ${attrs}>${esc(label)}${n != null ? `<small>${n}</small>` : ''}</button>`;
  $('#catChips').innerHTML =
    mk('전체', DATA.length, !state.cat, 'data-cat=""') +
    countBy('cat').map(([c, n]) => mk(c, n, state.cat === c, `data-cat="${esc(c)}"`, catClass(c))).join('');
  $('#d1Chips').innerHTML =
    mk('전체', null, !state.d1, 'data-d1=""') +
    countBy('d1').map(([c, n]) => mk(c, n, state.d1 === c, `data-d1="${esc(c)}"`)).join('');
  $('#cityChips').innerHTML =
    mk('전체', null, !state.city, 'data-city=""') +
    countBy('city').map(([c, n]) => mk(c, n, state.city === c, `data-city="${esc(c)}"`)).join('');
  const sel = $('#subSel');
  if (!state.city) {
    sel.disabled = true;
    sel.innerHTML = '<option value="">읍·면·동 (먼저 시를 선택하세요)</option>';
  } else {
    sel.disabled = false;
    const subs = new Map();
    DATA.filter((p) => p.city === state.city && p.sub).forEach((p) => subs.set(p.sub, (subs.get(p.sub) || 0) + 1));
    const arr = [...subs.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ko'));
    const opt = ([k, n]) => `<option value="${esc(k)}" ${state.sub === k ? 'selected' : ''}>${esc(k)} (${n})</option>`;
    const em = arr.filter(([k]) => /(읍|면)$/.test(k)), dg = arr.filter(([k]) => !/(읍|면)$/.test(k));
    sel.innerHTML = `<option value="">전체 읍·면·동 (${DATA.filter((p) => p.city === state.city).length})</option>` +
      (em.length ? `<optgroup label="읍·면">${em.map(opt).join('')}</optgroup>` : '') +
      (dg.length ? `<optgroup label="동·기타">${dg.map(opt).join('')}</optgroup>` : '');
  }
  const nDone = DATA.filter((p) => stamped(p.id)).length;
  $('#stampChips').innerHTML =
    mk('전체', null, !state.stampF, 'data-sf=""') +
    mk('✅ 도장 찍은 곳', nDone, state.stampF === 'done', 'data-sf="done"') +
    mk('⬜ 아직 안 간 곳', DATA.length - nDone, state.stampF === 'todo', 'data-sf="todo"');
  $('#legend').innerHTML = countBy('cat').map(([c, n]) => `<span><i style="background:${COLORS[c] || '#64748b'}"></i>${esc(c)} ${n}곳</span>`).join('') +
    `<span><i style="background:#7a6a55;border-radius:2px"></i>한라산(참고)</span>`;
}

/* ---------- 지도 (SVG) : 위도·경도를 그대로 좌표로 그린다 ---------- */
const NS = 'http://www.w3.org/2000/svg';
const mk = (tag, attrs = {}) => { const e = document.createElementNS(NS, tag); Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v)); return e; };
const pts = new Map();
let project;
let map3d = null; // 3D 지도 (처음 3D를 볼 때 만든다)
let hullPoly = [];
let mapDims = { W: 1000, H: 600 };

function hull(points) {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  p.forEach((q) => { while (lo.length > 1 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); });
  [...p].reverse().forEach((q) => { while (up.length > 1 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); });
  return lo.slice(0, -1).concat(up.slice(0, -1));
}

function buildMap() {
  const svg = $('#map');
  const lats = DATA.map((p) => p.lat), lngs = DATA.map((p) => p.lng);
  const pad = 0.04;
  const minLat = Math.min(...lats) - pad, maxLat = Math.max(...lats) + pad;
  const minLng = Math.min(...lngs) - pad, maxLng = Math.max(...lngs) + pad;
  const k = Math.cos(((minLat + maxLat) / 2) * Math.PI / 180); // 경도 1도의 실제 길이 보정
  const W = 1000, scale = W / ((maxLng - minLng) * k), H = (maxLat - minLat) * scale;
  project = (lat, lng) => [(lng - minLng) * k * scale, (maxLat - lat) * scale];
  mapDims = { W, H };
  svg.setAttribute('viewBox', `0 0 ${W} ${H.toFixed(0)}`);

  // 눈금선
  for (let g = Math.ceil(minLng * 10) / 10; g < maxLng; g += 0.1) {
    const x = project(minLat, g)[0];
    svg.append(mk('line', { x1: x, y1: 0, x2: x, y2: H, class: 'grid-line' }));
    const t = mk('text', { x: x + 4, y: H - 6, class: 'grid-text' }); t.textContent = g.toFixed(1) + '°E'; svg.append(t);
  }
  for (let g = Math.ceil(minLat * 10) / 10; g < maxLat; g += 0.1) {
    const y = project(g, minLng)[1];
    svg.append(mk('line', { x1: 0, y1: y, x2: W, y2: y, class: 'grid-line' }));
    const t = mk('text', { x: 6, y: y - 4, class: 'grid-text' }); t.textContent = g.toFixed(1) + '°N'; svg.append(t);
  }

  // 섬 모양(점들을 감싸는 외곽을 둥글게 부풀린 것 — 대략적인 위치 참고용)
  let poly = hull(DATA.map((p) => project(p.lat, p.lng)));
  for (let r = 0; r < 3; r++) { // 모서리를 둥글게 깎는다 (Chaikin 방식)
    const next = [];
    poly.forEach((a, i) => {
      const b = poly[(i + 1) % poly.length];
      next.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    });
    poly = next;
  }
  hullPoly = poly;
  const d = 'M' + poly.map((q) => q.map((v) => v.toFixed(1)).join(',')).join('L') + 'Z';
  svg.append(mk('path', { d, class: 'land' }), mk('path', { d, class: 'land-inner' }));
  svg.append(mk('g', { id: 'courseG' })); // 답사 코스 선 (점보다 아래에 그린다)

  // 한라산
  const [hx, hy] = project(33.3617, 126.5292);
  svg.append(mk('path', { d: `M${hx - 11},${hy + 8}L${hx},${hy - 12}L${hx + 11},${hy + 8}Z`, class: 'mt' }));
  const ht = mk('text', { x: hx + 16, y: hy + 6, class: 'mt-label' }); ht.textContent = '한라산'; svg.append(ht);

  // 장소 점
  DATA.forEach((p) => {
    const [x, y] = project(p.lat, p.lng);
    const c = mk('circle', { cx: x, cy: y, r: 7, fill: COLORS[p.cat] || '#64748b', class: 'pt', tabindex: 0, role: 'button', 'aria-label': p.name });
    c.addEventListener('click', () => select(p.id));
    c.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(p.id); } });
    c.addEventListener('mouseenter', () => showTip(p, x, y, W, H));
    c.addEventListener('mouseleave', () => ($('#tip').style.opacity = 0));
    svg.append(c);
    pts.set(p.id, c);
  });
  svg.append(mk('g', { id: 'stampG' })); // 도장 찍은 곳의 별
  svg.append(mk('g', { id: 'badgeG', 'pointer-events': 'none' })); // 순서 번호
  svg.append(mk('circle', { id: 'ring', r: 11, class: 'ring', display: 'none' }));
}
function showTip(p, x, y, W, H) {
  const tip = $('#tip');
  tip.textContent = `${p.name} · ${p.d1 || p.cat}`;
  tip.style.left = `${(x / W) * 100}%`;
  tip.style.top = `${(y / H) * 100}%`;
  tip.style.opacity = 1;
}

/* ---------- 카드 목록 ---------- */
function renderCards() {
  const list = visibleList();
  $('#count').textContent = `${list.length}곳 표시 중 (전체 ${DATA.length}곳)`;
  $('#empty').hidden = list.length > 0;
  $('#cards').innerHTML = list.map((p) => `
    <div class="card ${catClass(p.cat)} ${state.sel === p.id ? 'sel' : ''} ${stamped(p.id) ? 'stamped' : ''}" data-id="${p.id}" tabindex="0" role="button">
      ${thumbHtml(p)}
      ${stamped(p.id) ? '<span class="stampmark">✓ 도장</span>' : ''}
      <button class="fav ${favs.includes(p.id) ? 'on' : ''}" data-fav="${p.id}">${favs.includes(p.id) ? '♥ 찜' : '♡ 찜'}</button>
      <h3>${esc(p.name)}</h3>
      <div class="t">${esc(p.title)}</div>
      <div class="m">${esc(p.cat)}${p.d1 ? ' · ' + esc(p.d1) : ''}${p.d2 ? ' · ' + esc(p.d2) : ''}</div>
      <div class="m">${esc(p.addr.replace('제주특별자치도 ', ''))}</div>
      ${noteMark(p.id)}
    </div>`).join('');
  hydratePhotos();
  DATA.forEach((p) => pts.get(p.id)?.classList.toggle('dim', !isVisible(p)));
  if (map3d) map3d.sync();
}

/* ---------- 상세 패널 ---------- */
function renderDrawer(p) {
  if (memoFlush) memoFlush(); // 입력 중이던 메모를 먼저 저장
  const list = visibleList();
  const i = list.findIndex((x) => x.id === p.id);
  const row = (k, v) => (v ? `<dt>${k}</dt><dd>${esc(v)}</dd>` : '');
  $('#drawer').innerHTML = `
    <div class="d-head">
      <div class="d-top">
        <span><span class="badge ${catClass(p.cat)}">${esc(p.cat)}</span>${p.d1 ? `<span class="badge gray">${esc(p.d1)}</span>` : ''}${p.d2 ? `<span class="badge gray">${esc(p.d2)}</span>` : ''}</span>
        <span class="d-nav">
          <button id="prev" ${i <= 0 ? 'disabled' : ''} aria-label="이전">◀</button>
          <button id="next" ${i < 0 || i >= list.length - 1 ? 'disabled' : ''} aria-label="다음">▶</button>
          <button class="d-close" id="close" aria-label="닫기">✕</button>
        </span>
      </div>
      <h2>${esc(p.name)}</h2>
      <button class="fav inline ${favs.includes(p.id) ? 'on' : ''}" data-fav="${p.id}">${favs.includes(p.id) ? '♥ 찜' : '♡ 찜'}</button>
      <div class="stampbox ${stamped(p.id) ? 'done' : ''}">
        ${stamped(p.id) ? '<div class="seal">제주<br>스탬프<br>완료</div>' : ''}
        <button class="stampbtn" data-stamp="${p.id}">${stamped(p.id) ? '도장 취소' : '📍 여기 도장 찍기'}</button>
        ${stamped(p.id) ? `<span class="stamped-at">${new Date(stamps[p.id]).toLocaleString('ko-KR')}에 방문</span>` : ''}
      </div>
    </div>
    <div class="d-body">
      <div class="hero" id="hero"><span>${catEmoji(p)}</span></div>
      <p class="big">${esc(p.title)}</p>
      ${p.subtitle ? `<p>${esc(p.subtitle)}</p>` : ''}
      <h4>내 별점 · 메모</h4>
      <div class="rate" id="rate">${[1, 2, 3, 4, 5].map((i) => `<button type="button" data-rate="${i}" class="${i <= getNote(p.id).rating ? 'on' : ''}" aria-label="${i}점">★</button>`).join('')}</div>
      <textarea class="memo" id="memo" maxlength="300" placeholder="다녀온 느낌이나 메모를 남겨 보세요 (자동 저장)">${esc(getNote(p.id).memo)}</textarea>
      <div class="memo-meta"><span id="memoState">${notes[p.id] ? '저장됨 ✓' : ''}</span><span id="memoLen">${getNote(p.id).memo.length}/300</span></div>
      ${p.subject.length ? `<h4>주제어</h4><div class="tags">${p.subject.map((s) => `<span>${esc(s)}</span>`).join('')}</div>` : ''}
      <h4>이곳의 현재 날씨</h4>
      <div class="wx-box" id="wxBox">날씨를 불러오는 중…</div>
      <h4>위치</h4>
      <dl>${row('주소', p.addr)}${row('우편번호', p.zip)}${row('좌표', `${p.lat}, ${p.lng} (WGS 84)`)}</dl>
      ${p.abstract ? `<h4>초록</h4><p>${esc(p.abstract)}</p>` : ''}
      ${p.content ? `<h4>내용</h4><p>${esc(p.content)}</p>` : ''}
      ${p.toc ? `<h4>목차</h4><p>${esc(p.toc)}</p>` : ''}
      <h4>자료 정보</h4>
      <dl>${row('저작자', p.author)}${row('발행일', p.pubdate)}${row('자료유형', p.kind)}${row('출처', p.source)}</dl>
      <a class="btn" href="${esc(p.url)}" target="_blank" rel="noopener">제주 디지털 콘텐츠 원문 보기 ↗</a>
    </div>`;
  $('#close').onclick = closeDrawer;
  $('#prev').onclick = () => select(list[i - 1].id);
  $('#next').onclick = () => select(list[i + 1].id);
  $('#drawer .d-body').scrollTop = 0;
  bindMemo(p.id);
  loadDrawerExtras(p);
}
function select(id) {
  state.sel = id;
  const p = byId.get(id);
  renderDrawer(p);
  $('#drawer').classList.add('on');
  $('#shade').classList.add('on');
  $('#drawer').setAttribute('aria-hidden', 'false');
  pts.forEach((c, k) => c.classList.toggle('sel', k === id));
  const ring = $('#ring'), [x, y] = project(p.lat, p.lng);
  ring.setAttribute('cx', x); ring.setAttribute('cy', y); ring.removeAttribute('display');
  document.querySelectorAll('.card').forEach((c) => c.classList.toggle('sel', Number(c.dataset.id) === id));
  if (map3d) { map3d.sync(); map3d.focus(id); }
  setHash('#' + id);
}
function closeDrawer() {
  if (memoFlush) memoFlush();
  state.sel = null;
  $('#drawer').classList.remove('on');
  $('#shade').classList.remove('on');
  $('#drawer').setAttribute('aria-hidden', 'true');
  pts.forEach((c) => c.classList.remove('sel'));
  $('#ring').setAttribute('display', 'none');
  document.querySelectorAll('.card.sel').forEach((c) => c.classList.remove('sel'));
  if (map3d) { map3d.sync(); map3d.resetView(); }
  setHash('');
}
// 주소창의 #번호 갱신 (막힌 환경에서도 화면이 멈추지 않도록 실패는 무시한다)
function setHash(h) {
  try { history.replaceState(null, '', location.pathname + location.search + h); } catch (e) { /* 무시 */ }
}

/* ---------- 찜 · 답사 코스 ---------- */
const km = (a, b) => { // 두 지점 사이의 직선거리(km)
  const R = 6371, rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

function toggleFav(id) {
  favs = favs.includes(id) ? favs.filter((x) => x !== id) : [...favs, id]; // 누른 순서대로 뒤에 붙는다
  saveFavs();
  updateFavUI();
}
function moveFav(id, dir) {
  const i = favs.indexOf(id), j = i + dir;
  if (j < 0 || j >= favs.length) return;
  [favs[i], favs[j]] = [favs[j], favs[i]];
  saveFavs();
  updateFavUI();
}

function renderCourse() {
  const list = favs.map((id) => byId.get(id));
  const line = $('#courseG'), badges = $('#badgeG');
  line.innerHTML = '';
  badges.innerHTML = '';
  if (list.length > 1) { // 고른 순서대로 이어지는 선
    const d = 'M' + list.map((p) => project(p.lat, p.lng).map((v) => v.toFixed(1)).join(',')).join('L');
    line.append(mk('path', { d, class: 'course-line' }));
  }
  list.forEach((p, i) => { // 점 옆에 순서 번호
    const [x, y] = project(p.lat, p.lng);
    badges.append(mk('circle', { cx: x + 11, cy: y - 11, r: 10, class: 'badge-c' }));
    const t = mk('text', { x: x + 11, y: y - 11, class: 'badge-t' });
    t.textContent = i + 1;
    badges.append(t);
  });
  pts.forEach((c, id) => c.classList.toggle('fav', favs.includes(id)));
  if (map3d) map3d.sync();

  let total = 0;
  for (let i = 1; i < list.length; i++) total += km(list[i - 1], list[i]);
  $('#courseMeta').textContent = list.length ? `${list.length}곳 · 직선거리 합 약 ${total.toFixed(1)}km` : '';
  $('#clearCourse').hidden = list.length === 0;
  $('#courseList').innerHTML = list.length
    ? list.map((p, i) => `
      <li>
        <span class="n">${i + 1}</span>
        <span class="nm" data-id="${p.id}">${esc(p.name)}<small>${esc(p.title)}${i > 0 ? ` · 앞 장소에서 ${km(list[i - 1], p).toFixed(1)}km` : ''}</small></span>
        <span class="ops">
          <button data-up="${p.id}" ${i === 0 ? 'disabled' : ''} aria-label="앞으로">▲</button>
          <button data-down="${p.id}" ${i === list.length - 1 ? 'disabled' : ''} aria-label="뒤로">▼</button>
          <button data-fav="${p.id}" aria-label="찜 해제">✕</button>
        </span>
      </li>`).join('')
    : '<li class="none">아직 찜한 곳이 없어요. 아래 카드의 ♡ 찜을 눌러 보세요.</li>';
}
function updateFavUI() {
  renderCourse();
  document.querySelectorAll('.fav[data-fav]').forEach((b) => {
    const on = favs.includes(Number(b.dataset.fav));
    if (b.closest('.clist')) return; // 코스 목록의 ✕ 버튼은 그대로
    b.classList.toggle('on', on);
    b.textContent = on ? '♥ 찜' : '♡ 찜';
  });
  $('#favOnlyBtn').textContent = `♥ 찜한 곳만 (${favs.length})`;
  $('#favOnlyBtn').classList.toggle('on', state.favOnly);
  if (state.favOnly) renderCards();
}

/* ---------- 스탬프 투어 ---------- */
const RANKS = [
  [0, '🧳', '여행 준비생'], [1, '🌱', '새내기 여행자'], [10, '🧭', '탐험가'],
  [30, '🥾', '베테랑 탐험가'], [60, '🗿', '제주 해설사'], [100, '🏅', '제주 박사'], [120, '🏆', '제주 마스터'],
];
const stampCount = () => DATA.filter((p) => stamped(p.id)).length;
const rankOf = (n) => RANKS.filter((r) => n >= r[0]).pop();

let toastTimer = 0;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('on'), 2400);
}

function toggleStamp(id) {
  const had = stamped(id);
  const before = rankOf(stampCount());
  if (had) delete stamps[id]; else stamps[id] = Date.now();
  saveStamps();
  updateStampUI();
  if (!had) {
    const n = stampCount(), after = rankOf(n);
    toast(after[2] !== before[2] ? `🎉 등급 UP! ${after[1]} ${after[2]}` : `📍 ${byId.get(id).name} 도장 완료! (${n} / ${DATA.length})`);
  }
}

function renderStampPanel() {
  const n = stampCount(), total = DATA.length;
  const r = rankOf(n), next = RANKS.find((x) => x[0] > n);
  $('#rank').innerHTML = `<span class="fw-emoji">${r[1]}</span> <span class="fw-name">${r[2]}</span>`;
  $('#rankSub').textContent = next ? `다음 등급 「${next[2]}」까지 ${next[0] - n}곳 남았어요` : '모든 장소를 정복했어요! 축하합니다 🎉';
  $('#spCount').innerHTML = `<b>${n}</b> / ${total}곳`;
  $('#barFill').style.width = `${(n / total) * 100}%`;

  const part = (label, key, val) => {
    const all = DATA.filter((p) => p[key] === val), got = all.filter((p) => stamped(p.id)).length;
    return `<span class="sc ${got === all.length ? 'full' : got ? 'has' : ''}">${esc(label)} ${got}/${all.length}</span>`;
  };
  $('#spCats').innerHTML = countBy('cat').map(([c]) => part(c, 'cat', c)).join('') + countBy('d1').map(([c]) => part(c, 'd1', c)).join('');

  // 가장 최근에 찍은 곳에서 가장 가까운, 아직 안 가 본 곳을 추천
  const todo = DATA.filter((p) => !stamped(p.id));
  if (!todo.length) { $('#spNext').textContent = ''; }
  else if (!n) { $('#spNext').textContent = '지도의 점이나 아래 카드를 눌러 장소를 열고 「도장 찍기」를 눌러 보세요.'; }
  else {
    const lastId = Number(Object.entries(stamps).sort((a, b) => b[1] - a[1])[0][0]);
    const last = byId.get(lastId);
    const near = todo.map((p) => [p, km(last, p)]).sort((a, b) => a[1] - b[1])[0];
    $('#spNext').innerHTML = `다음 추천: <button data-goto="${near[0].id}">${esc(near[0].name)}</button> <small>(${esc(last.name)}에서 ${near[1].toFixed(1)}km)</small>`;
  }
  $('#resetStamps').hidden = n === 0;
  renderNoteStat();
}

function renderMapStamps() {
  const g = $('#stampG');
  g.innerHTML = '';
  DATA.filter((p) => stamped(p.id)).forEach((p) => {
    const [x, y] = project(p.lat, p.lng);
    const s = mk('text', { x: x - 11, y: y - 11, class: 'star' });
    s.textContent = '★';
    g.append(s);
  });
  pts.forEach((c, id) => c.classList.toggle('stamped', stamped(id)));
  if (map3d) map3d.sync();
}

function updateStampUI() {
  renderStampPanel();
  renderMapStamps();
  renderChips();
  renderCards();
  if (state.sel != null) renderDrawer(byId.get(state.sel)); // 열려 있는 상세 화면의 버튼도 갱신
}

/* ---------- 이벤트 ---------- */
function refresh() { renderChips(); renderCards(); updateFavUI(); renderStampPanel(); renderMapStamps(); }
$('#stampChips').addEventListener('click', (e) => { const b = e.target.closest('[data-sf]'); if (b) { state.stampF = b.dataset.sf; refresh(); } });
$('#resetStamps').addEventListener('click', () => {
  if (window.confirm('찍은 도장을 모두 지울까요?')) { stamps = {}; saveStamps(); updateStampUI(); toast('도장을 모두 지웠어요'); }
});
document.addEventListener('click', (e) => {
  const st = e.target.closest('[data-stamp]'); if (st) { toggleStamp(Number(st.dataset.stamp)); return; }
  const go = e.target.closest('[data-goto]'); if (go) select(Number(go.dataset.goto));
});
$('#favOnlyBtn').addEventListener('click', () => { state.favOnly = !state.favOnly; refresh(); });
$('#clearCourse').addEventListener('click', () => { favs = []; saveFavs(); updateFavUI(); });
document.addEventListener('click', (e) => {
  const f = e.target.closest('[data-fav]'); if (f) { toggleFav(Number(f.dataset.fav)); return; }
  const up = e.target.closest('[data-up]'); if (up) { moveFav(Number(up.dataset.up), -1); return; }
  const dn = e.target.closest('[data-down]'); if (dn) { moveFav(Number(dn.dataset.down), 1); return; }
  const nm = e.target.closest('.clist .nm'); if (nm) select(Number(nm.dataset.id));
});
$('#cards').addEventListener('keydown', (e) => {
  const c = e.target.closest('.card');
  if (c && e.target === c && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); select(Number(c.dataset.id)); }
});
$('#q').addEventListener('input', (e) => { state.q = e.target.value; renderCards(); });
$('#catChips').addEventListener('click', (e) => { const b = e.target.closest('[data-cat]'); if (b) { state.cat = b.dataset.cat; refresh(); } });
$('#d1Chips').addEventListener('click', (e) => { const b = e.target.closest('[data-d1]'); if (b) { state.d1 = b.dataset.d1; refresh(); } });
$('#cards').addEventListener('click', (e) => { const c = e.target.closest('.card'); if (c && !e.target.closest('.fav')) select(Number(c.dataset.id)); });
$('#shade').addEventListener('click', closeDrawer);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDrawer(); });

/* ---------- 화면 설정 : 테마 · 글자 크기 ---------- */
function applyPrefs() {
  const root = document.documentElement;
  if (prefs.theme === 'auto') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', prefs.theme);
  root.style.fontSize = ['16px', '18px', '20px'][prefs.font] || '16px';
  $('#themeBtn').textContent = { auto: '🌓 자동', light: '☀️ 라이트', dark: '🌙 다크' }[prefs.theme];
  $('#fontDown').disabled = prefs.font <= 0;
  $('#fontUp').disabled = prefs.font >= 2;
  if (map3d) map3d.retheme();
}
$('#themeBtn').addEventListener('click', () => { prefs.theme = { auto: 'light', light: 'dark', dark: 'auto' }[prefs.theme]; savePrefs(); applyPrefs(); });
$('#fontDown').addEventListener('click', () => { prefs.font = Math.max(0, prefs.font - 1); savePrefs(); applyPrefs(); });
$('#fontUp').addEventListener('click', () => { prefs.font = Math.min(2, prefs.font + 1); savePrefs(); applyPrefs(); });
applyPrefs();

/* ---------- 지역 필터 ---------- */
$('#cityChips').addEventListener('click', (e) => { const b = e.target.closest('[data-city]'); if (b) { state.city = b.dataset.city; state.sub = ''; refresh(); } });
$('#subSel').addEventListener('change', (e) => { state.sub = e.target.value; refresh(); });

/* ---------- 오늘 어디 갈까? (랜덤 추천) ---------- */
let rolling = false;
function randomPick() {
  if (rolling) return;
  let pool = visibleList().filter((p) => !stamped(p.id)); // 지금 필터 안에서, 아직 안 가 본 곳 우선
  let what = '안 가 본 곳 중에서';
  if (!pool.length) { pool = visibleList(); what = '조건에 맞는 곳 중에서'; }
  if (!pool.length) { toast('조건에 맞는 장소가 없어요. 필터를 바꿔 보세요'); return; }
  rolling = true;
  $('#fab').classList.add('spin');
  const final = pool[Math.floor(Math.random() * pool.length)];
  const steps = Math.min(14, pool.length * 2);
  let i = 0;
  const tick = () => {
    if (i < steps) { toast('🎲 ' + pool[Math.floor(Math.random() * pool.length)].name + ' …'); i += 1; setTimeout(tick, 60 + i * 14); return; }
    rolling = false;
    $('#fab').classList.remove('spin');
    toast(`🎯 ${what} 골랐어요: ${final.name}`);
    select(final.id);
  };
  tick();
}
$('#randBtn').addEventListener('click', randomPick);
$('#fab').addEventListener('click', randomPick);

/* ---------- 내 별점 · 메모 ---------- */
const getNote = (id) => notes[id] || { memo: '', rating: 0 };
let memoFlush = null;
function saveNote(id, patch) {
  const n = { ...getNote(id), ...patch, at: Date.now() };
  if (!n.memo.trim() && !n.rating) delete notes[id]; else notes[id] = n;
  saveNotes();
  renderCards();
  renderNoteStat();
}
function noteMark(id) {
  const n = notes[id];
  if (!n) return '';
  const memo = n.memo.trim();
  return `<div class="cardnote">${n.rating ? '★'.repeat(n.rating) + '☆'.repeat(5 - n.rating) : ''}${memo ? ` 📝 ${esc(memo.length > 28 ? memo.slice(0, 28) + '…' : memo)}` : ''}</div>`;
}
function renderNoteStat() {
  const all = Object.values(notes), memos = all.filter((n) => n.memo.trim()).length, rated = all.filter((n) => n.rating);
  $('#noteStat').textContent = all.length
    ? `📝 메모 ${memos}개 · ⭐ 별점 ${rated.length}곳${rated.length ? ` (평균 ${(rated.reduce((a, n) => a + n.rating, 0) / rated.length).toFixed(1)})` : ''}`
    : '다녀온 곳에 별점과 메모를 남겨 보세요.';
}
function bindMemo(id) {
  const ta = $('#memo'), state2 = $('#memoState');
  memoFlush = null;
  document.querySelectorAll('#rate button').forEach((b) => b.addEventListener('click', () => {
    const r = Number(b.dataset.rate);
    const v = getNote(id).rating === r ? 0 : r; // 같은 별을 다시 누르면 해제
    saveNote(id, { rating: v });
    document.querySelectorAll('#rate button').forEach((x) => x.classList.toggle('on', Number(x.dataset.rate) <= v));
    state2.textContent = notes[id] ? '저장됨 ✓' : '';
  }));
  let timer = 0;
  const flush = () => { clearTimeout(timer); memoFlush = null; saveNote(id, { memo: ta.value }); state2.textContent = notes[id] ? '저장됨 ✓' : ''; };
  ta.addEventListener('input', () => {
    $('#memoLen').textContent = `${ta.value.length}/300`;
    state2.textContent = '저장 중…';
    clearTimeout(timer);
    memoFlush = flush;
    timer = setTimeout(flush, 400);
  });
}

/* ---------- 기록 저장 · 불러오기 (폰 ↔ PC 옮기기) ---------- */
let ioTimer = 0;
function ioMsg(text, warn = false) {
  const el = $('#ioMsg');
  el.textContent = text;
  el.classList.toggle('warn', warn);
  clearTimeout(ioTimer);
  ioTimer = setTimeout(() => (el.textContent = ''), 8000);
}
function exportData() {
  const data = { app: 'jeju-stamp-tour', version: 1, exportedAt: new Date().toISOString(), stamps, favs, notes };
  const d = new Date(), pad = (n) => String(n).padStart(2, '0');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  a.download = `제주스탬프투어_기록_${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}.json`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  ioMsg(`✅ 도장 ${stampCount()}개 · 찜 ${favs.length}곳 · 메모 ${Object.keys(notes).length}개를 파일로 저장했어요. 다른 기기에서 「기록 불러오기」로 열 수 있어요.`);
}
function importData(text) {
  let data;
  try { data = JSON.parse(text); } catch (e) { ioMsg('⚠️ 읽을 수 없는 파일이에요. 「기록 저장」으로 만든 .json 파일을 골라 주세요.', true); return; }
  if (!data || data.app !== 'jeju-stamp-tour') { ioMsg('⚠️ 이 앱의 기록 파일이 아니에요.', true); return; }
  let s = 0, f = 0, n = 0;
  Object.entries(data.stamps && typeof data.stamps === 'object' ? data.stamps : {}).forEach(([k, v]) => {
    const id = Number(k), t = Number(v);
    if (!byId.has(id) || !Number.isFinite(t)) return;
    if (!stamped(id)) { stamps[id] = t; s += 1; } else stamps[id] = Math.min(Number(stamps[id]), t);
  });
  (Array.isArray(data.favs) ? data.favs : []).map(Number).forEach((id) => { if (byId.has(id) && !favs.includes(id)) { favs.push(id); f += 1; } });
  Object.entries(data.notes && typeof data.notes === 'object' ? data.notes : {}).forEach(([k, v]) => {
    const id = Number(k);
    if (!byId.has(id) || !v || typeof v !== 'object') return;
    const note = { memo: String(v.memo || '').slice(0, 300), rating: Math.max(0, Math.min(5, Math.round(Number(v.rating) || 0))), at: Number(v.at) || 0 };
    if (!note.memo.trim() && !note.rating) return;
    if (!notes[id]) { notes[id] = note; n += 1; } else if (note.at > (notes[id].at || 0)) notes[id] = note; // 더 최근에 쓴 메모가 이긴다
  });
  saveStamps(); saveFavs(); saveNotes();
  updateStampUI();
  updateFavUI();
  ioMsg(`✅ 불러왔어요: 도장 +${s}, 찜 +${f}, 메모 +${n} (지금 기록은 지우지 않고 합쳤어요)`);
}
$('#exportBtn').addEventListener('click', exportData);
$('#importBtn').addEventListener('click', () => $('#importFile').click());
$('#importFile').addEventListener('change', (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) { ioMsg('⚠️ 파일이 너무 커요 (2MB 이하만 가능).', true); return; }
  const r = new FileReader();
  r.onload = () => importData(String(r.result));
  r.onerror = () => ioMsg('⚠️ 파일을 읽지 못했어요.', true);
  r.readAsText(file);
});

/* ---------- 지도 보기 방식 (3D / 2D) ---------- */
function applyView() {
  const want3d = prefs.view === '3d';
  if (want3d && !map3d) {
    try { map3d = createMap3D($('#map3d')); } catch (e) { map3d = null; prefs.view = '2d'; toast('이 기기에서는 3D를 쓸 수 없어 2D로 보여 드려요'); }
  }
  const is3d = prefs.view === '3d' && !!map3d;
  $('#map3d').hidden = !is3d;
  $('#map').style.display = is3d ? 'none' : ''; // SVG 는 hidden 속성이 먹지 않아 display 로 숨긴다
  $('#spinBtn').hidden = !is3d;
  $('#resetCam').hidden = !is3d;
  document.querySelectorAll('.seg button').forEach((b) => b.classList.toggle('on', b.dataset.view === (is3d ? '3d' : '2d')));
  $('#spinBtn').textContent = prefs.spin ? '⏸ 자동 회전' : '▶ 자동 회전';
  if (map3d) { map3d.setActive(is3d); if (is3d) map3d.sync(); }
}
document.querySelectorAll('.seg button').forEach((b) => b.addEventListener('click', () => { prefs.view = b.dataset.view; savePrefs(); applyView(); }));
$('#spinBtn').addEventListener('click', () => { prefs.spin = !prefs.spin; savePrefs(); if (map3d) map3d.setSpin(prefs.spin); applyView(); });
$('#resetCam').addEventListener('click', () => { if (map3d) map3d.resetView(); });
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => { if (map3d) map3d.retheme(); });

/* ---------- 사진 (Pixabay · /api/photos) ---------- */
// 장소 이름/주제에 맞는 영어 검색어를 고른다 (위에서부터 먼저 맞는 규칙이 쓰인다)
const PHOTO_RULES = [
  [/오름|분화구|굼부리/, 'oreum volcanic crater jeju'], [/폭포/, 'waterfall korea'], [/동굴|굴$/, 'lava cave'],
  [/등대/, 'lighthouse coast'], [/해녀|불턱/, 'haenyeo woman diver'], [/올레/, 'jeju olle trail'],
  [/곶자왈|숲|산림|휴양림/, 'forest trail korea'], [/포구|항$|어촌|선착장/, 'fishing harbor boats'],
  [/해안|해변|바다|돌담|갯/, 'jeju coast basalt rocks'], [/성$|성곽|진성|읍성|방호소|환해장성|봉수|연대/, 'old stone fortress wall korea'],
  [/묘|무덤|고분|비$|비석/, 'korean tomb stone'], [/당$|신당|본향|할망|굿/, 'korean shrine ritual'],
  [/사$|절|암$/, 'buddhist temple korea'], [/물|샘|천$|우물|용천|연못/, 'spring water stone korea'],
  [/목장|마장/, 'horse ranch'], [/돌하르방|하르방/, 'dolhareubang statue'], [/초가|민속촌|민가/, 'thatched house korea'],
  [/시장/, 'korean traditional market'], [/감귤|귤/, 'tangerine orchard'], [/박물관|전시|기념관|도서관/, 'museum korea'],
  [/서원|향교|서당|재$/, 'korean confucian academy'],
];
const PHOTO_BY_DIR = {
  '자연': 'jeju nature landscape', '역사': 'korean historic site', '무속': 'korean shrine ritual', '민간신앙': 'korean shrine ritual',
  '통과의례': 'korean traditional ceremony', '생산기술': 'traditional farming korea', '의식주': 'korean traditional food',
  '관광': 'jeju travel', '사회': 'korean village', '문화': 'korean culture', '신화/전설': 'jeju legend', '민속공예': 'korean handicraft',
};
const photoQuery = (p) => (PHOTO_RULES.find(([re]) => re.test(p.name)) || [])[1] || PHOTO_BY_DIR[p.d1] || 'jeju island';
const catEmoji = (p) => ({ '자연': '🌿', '역사': '🏯', '무속': '⛩️', '민간신앙': '🙏', '통과의례': '🎎', '생산기술': '🌾', '의식주': '🍲', '관광': '🧭', '사회': '🏘️', '문화': '🎭', '신화/전설': '🐉', '방언': '💬', '민속공예': '🧶' }[p.d1] || (p.cat === '민속' ? '🏛️' : '📍'));

const photoReq = new Map(); // 검색어 → 요청(같은 검색어는 한 번만 부른다)
const photoMeta = new Map(); // 장소 id → 고른 사진
let photosOff = false;
function photoHits(q) {
  if (photoReq.has(q)) return photoReq.get(q);
  let saved = null;
  try { saved = JSON.parse(sessionStorage.getItem('jeju-ph:' + q) || 'null'); } catch (e) { /* 무시 */ }
  const pr = saved ? Promise.resolve(saved) : fetch(`/api/photos?q=${encodeURIComponent(q)}&per_page=12`)
    .then(async (r) => {
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || `사진 API 오류 (${r.status})`);
      try { sessionStorage.setItem('jeju-ph:' + q, JSON.stringify(d.hits || [])); } catch (e) { /* 무시 */ }
      return d.hits || [];
    });
  photoReq.set(q, pr);
  pr.catch(() => photoReq.delete(q));
  return pr;
}
async function photoFor(p) {
  if (photosOff) return null;
  if (photoMeta.has(p.id)) return photoMeta.get(p.id);
  try {
    const hits = await photoHits(photoQuery(p));
    if (!hits.length) return null;
    const h = hits[(p.id * 2654435761 >>> 0) % hits.length]; // 같은 검색어여도 장소마다 다른 사진이 나오게
    const meta = { url: h.webformatURL, user: h.user, pageURL: h.pageURL };
    photoMeta.set(p.id, meta);
    return meta;
  } catch (e) {
    if (!photosOff) showPhotoNote(e.message);
    photosOff = true;
    return null;
  }
}
function showPhotoNote(msg) {
  const n = $('#photoNote');
  n.hidden = false;
  n.innerHTML = `📷 사진을 불러오지 못했어요 (${esc(msg)}) <button type="button" id="photoRetry">다시 시도</button>`;
  $('#photoRetry').onclick = () => { photosOff = false; n.hidden = true; hydratePhotos(); };
}
function thumbHtml(p) {
  const m = photoMeta.get(p.id);
  return `<div class="thumb${m ? '' : ' ph'}" data-pid="${p.id}">${m ? `<img src="${esc(m.url)}" alt="" loading="lazy">` : `<span>${catEmoji(p)}</span>`}</div>`;
}
let thumbIO = null;
function hydratePhotos() { // 화면에 보이는 카드만 사진을 불러온다
  if (thumbIO) thumbIO.disconnect();
  if (photosOff) return;
  thumbIO = new IntersectionObserver((entries) => entries.forEach((en) => {
    if (!en.isIntersecting) return;
    thumbIO.unobserve(en.target);
    photoFor(byId.get(Number(en.target.dataset.pid))).then((m) => {
      if (m && en.target.isConnected) { en.target.classList.remove('ph'); en.target.innerHTML = `<img src="${esc(m.url)}" alt="" loading="lazy">`; }
    });
  }), { rootMargin: '300px' });
  document.querySelectorAll('.thumb.ph').forEach((el) => thumbIO.observe(el));
}

/* ---------- 날씨 (Open-Meteo · /api/weather) ---------- */
const wxCache = new Map();
async function fetchWeather(lat, lng) {
  const key = `${lat.toFixed(2)},${lng.toFixed(2)}`;
  const c = wxCache.get(key);
  if (c && Date.now() - c.t < 10 * 60 * 1000) return c.data;
  const r = await fetch(`/api/weather?lat=${lat}&lng=${lng}`);
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || `날씨 API 오류 (${r.status})`);
  wxCache.set(key, { t: Date.now(), data: d });
  return d;
}
const wxIcon = (d) => d.icon;
const wxLine = (d) => `${d.icon} <b>${d.temperature}℃</b> · ${esc(d.label)} · 습도 ${d.humidity}% · 바람 ${d.windSpeed}m/s`;
const WX_SPOTS = [['제주시', 33.4996, 126.5312], ['서귀포', 33.2541, 126.5601]];
async function loadWidgetWeather() {
  const rows = await Promise.all(WX_SPOTS.map(async ([name, lat, lng]) => {
    try { return [name, await fetchWeather(lat, lng)]; } catch (e) { return [name, null, e.message]; }
  }));
  const ok = rows.find((r) => r[1]);
  $('#fwWx').innerHTML = ok ? `${wxIcon(ok[1])} ${esc(ok[0])} <b>${ok[1].temperature}℃</b> · ${esc(ok[1].label)}` : '날씨를 불러오지 못했어요';
  $('#fwWxList').innerHTML = rows.map(([n, d, err]) => `<div class="wxrow"><span>${esc(n)}</span>${d ? wxLine(d) : esc('불러오지 못했어요: ' + err)}</div>`).join('') +
    (ok ? `<div class="sp-note">Open-Meteo ${esc(ok[1].observedAt)} 기준</div>` : '');
}

/* ---------- 상세 화면의 사진 · 날씨 ---------- */
function loadDrawerExtras(p) {
  const hero = $('#hero'), box = $('#wxBox');
  photoFor(p).then((m) => {
    if (!m || !hero.isConnected) return;
    hero.insertAdjacentHTML('beforeend', `<img src="${esc(m.url)}" alt="${esc(p.name)} 관련 사진"><a class="credit" href="${esc(m.pageURL)}" target="_blank" rel="noopener">사진: ${esc(m.user)} · Pixabay</a>`);
  });
  fetchWeather(p.lat, p.lng).then((d) => {
    if (box.isConnected) box.innerHTML = `${wxLine(d)}<small>Open-Meteo · ${esc(d.observedAt)} 기준</small>`;
  }).catch((e) => { if (box.isConnected) box.textContent = '날씨를 불러오지 못했어요: ' + e.message; });
}

/* ---------- 오른쪽 가운데에서 천천히 따라오는 스탬프 칸 ---------- */
(function followWidget() {
  const fw = $('#fw'), header = document.querySelector('header');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let cur = null, raf = 0, last = 0;
  const targetY = () => { // 화면 세로 가운데. 머리글 아래 ~ 문서 끝 사이로 제한
    const want = window.scrollY + (innerHeight - fw.offsetHeight) / 2;
    const min = header.offsetHeight + 10;
    const max = Math.max(min, document.documentElement.scrollHeight - fw.offsetHeight - 10);
    return Math.max(min, Math.min(max, want));
  };
  const place = (y) => { fw.style.transform = `translateY(${y.toFixed(1)}px)`; };
  function step(now) {
    raf = 0;
    const t = targetY(), dt = Math.min((now - last) / 1000 || 0.016, 0.1);
    last = now;
    if (cur === null || reduce) cur = t;
    else cur += (t - cur) * (1 - Math.exp(-dt * 2.4)); // 시간 기준으로 천천히(약 0.4초) 따라간다
    place(cur);
    if (!reduce && Math.abs(t - cur) > 0.5) raf = requestAnimationFrame(step); else { cur = t; place(t); }
  }
  const kick = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(step); } };
  addEventListener('scroll', kick, { passive: true });
  addEventListener('resize', kick);
  new ResizeObserver(kick).observe(fw);
  new ResizeObserver(kick).observe(document.body);
  $('#fwHead').addEventListener('click', () => {
    const open = fw.classList.toggle('open');
    $('#fwPanel').hidden = !open;
    $('#fwHead').setAttribute('aria-expanded', String(open));
    kick();
  });
  kick();
})();

loadWidgetWeather();
setInterval(loadWidgetWeather, 10 * 60 * 1000);

/* ---------- 제주 사진 슬라이드 (2초마다 넘어간다) ---------- */
(function slideshow() {
  // [이름, Pixabay 검색어, 사진이 오기 전에 보일 아이콘, 바탕색 1, 바탕색 2]
  const SLIDES = [
    ['한라산', 'hallasan mountain jeju', '🏔️', '#0e7490', '#14b8a6'], ['성산일출봉', 'seongsan ilchulbong jeju', '🌅', '#f97316', '#facc15'],
    ['제주 바다', 'jeju island coast sea', '🌊', '#0369a1', '#38bdf8'], ['오름', 'oreum jeju volcanic cone', '⛰️', '#15803d', '#86efac'],
    ['주상절리', 'jusangjeolli cliff jeju', '🪨', '#475569', '#94a3b8'], ['감귤', 'jeju tangerine orchard', '🍊', '#ea580c', '#fdba74'],
    ['해녀', 'haenyeo diver jeju', '🤿', '#1d4ed8', '#60a5fa'], ['돌하르방', 'dolhareubang jeju stone statue', '🗿', '#57534e', '#a8a29e'],
    ['폭포', 'jeongbang waterfall jeju', '💧', '#0f766e', '#5eead4'],
  ];
  const N = SLIDES.length;
  const track = $('#ssTrack'), dots = $('#ssDots'), cap = $('#ssCap'), credit = $('#ssCredit'), box = $('#slideshow');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let cur = 0, busy = false, hover = false, inView = true, timer = 0;

  const els = SLIDES.map(([, , emoji, c1, c2], i) => {
    const d = document.createElement('div');
    d.className = 'ss-slide';
    d.style.setProperty('--c1', c1);
    d.style.setProperty('--c2', c2);
    d.style.transform = i === 0 ? 'translateX(0)' : 'translateX(100%)';
    d.innerHTML = `<span>${emoji}</span>`;
    track.append(d);
    return d;
  });
  const meta = SLIDES.map(() => null);
  const dotEls = SLIDES.map(([name], i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('aria-label', `${i + 1}번 사진: ${name}`);
    b.addEventListener('click', () => { go(i, i > cur ? 1 : -1); sync(); });
    dots.append(b);
    return b;
  });

  function showInfo() {
    cap.textContent = SLIDES[cur][0];
    const m = meta[cur];
    credit.hidden = !m;
    if (m) { credit.href = m.pageURL; credit.textContent = `사진: ${m.user} · Pixabay`; }
    dotEls.forEach((b, i) => b.classList.toggle('on', i === cur));
  }
  function go(to, dir = 1) { // 지금 사진은 옆으로 밀려 나가고, 다음 사진이 들어온다 (끝에서 처음으로도 이어진다)
    if (busy || to === cur) return;
    busy = true;
    const a = els[cur], b = els[to], t = reduce ? 'none' : 'transform .55s ease';
    b.style.transition = 'none';
    b.style.transform = `translateX(${100 * dir}%)`;
    void b.offsetWidth;
    a.style.transition = t; b.style.transition = t;
    a.style.transform = `translateX(${-100 * dir}%)`;
    b.style.transform = 'translateX(0)';
    cur = to;
    showInfo();
    setTimeout(() => { a.style.transition = 'none'; a.style.transform = 'translateX(100%)'; busy = false; }, reduce ? 0 : 600);
  }
  const next = () => go((cur + 1) % N, 1);
  function sync() { // 마우스를 올렸거나, 화면에 안 보이거나, 탭이 숨겨지면 멈춘다
    clearInterval(timer);
    timer = 0;
    if (!hover && inView && !document.hidden) timer = setInterval(next, 2000);
  }
  $('#ssNext').addEventListener('click', () => { next(); sync(); });
  $('#ssPrev').addEventListener('click', () => { go((cur - 1 + N) % N, -1); sync(); });
  box.addEventListener('mouseenter', () => { hover = true; sync(); });
  box.addEventListener('mouseleave', () => { hover = false; sync(); });
  document.addEventListener('visibilitychange', sync);
  new IntersectionObserver((en) => { inView = en[0].isIntersecting; sync(); }).observe(box);

  // 사진은 Pixabay 에서 받아 와서 빈 아이콘 자리를 채운다 (못 받아도 슬라이드는 그대로 돌아간다)
  const used = new Set();
  SLIDES.forEach(([name, q], i) => photoHits(q).then((hits) => {
    const h = hits.find((x) => !used.has(x.id) && /jeju|hallasan|korea/i.test(x.tags)) || hits.find((x) => !used.has(x.id));
    if (!h) return;
    used.add(h.id);
    const img = new Image();
    img.alt = `${name} 사진`;
    img.onload = () => { els[i].append(img); meta[i] = { user: h.user, pageURL: h.pageURL }; if (i === cur) showInfo(); };
    img.src = h.webformatURL;
  }).catch(() => {}));

  showInfo();
  sync();
})();

/* ---------- 앞으로 7일 날씨: 내일부터 (Open-Meteo · /api/forecast) ---------- */
(function forecast() {
  const list = $('#fcList'), sub = $('#fcSub'), tabs = [...document.querySelectorAll('.fc-tabs button')];
  const cache = new Map();
  let want = 0;
  async function load(i) {
    want = i;
    const [name, lat, lng] = WX_SPOTS[i];
    tabs.forEach((b, k) => b.classList.toggle('on', k === i));
    list.innerHTML = '<li class="fc-load">불러오는 중…</li>';
    try {
      let c = cache.get(i);
      if (!c || Date.now() - c.t > 30 * 60 * 1000) {
        const r = await fetch(`/api/forecast?lat=${lat}&lng=${lng}`);
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || `예보 API 오류 (${r.status})`);
        c = { t: Date.now(), days: j.days };
        cache.set(i, c);
      }
      if (want !== i) return; // 그 사이 다른 탭을 눌렀으면 그 결과만 보여 준다
      list.innerHTML = c.days.map((x, n) => `
        <li class="${x.rain != null && x.rain >= 60 ? 'wet' : ''}">
          <span class="fc-day"><b>${n === 0 ? '내일' : esc(x.weekday)}</b><small>${esc(x.md)}${n === 0 ? ' (' + esc(x.weekday) + ')' : ''}</small></span>
          <span class="fc-ic" title="${esc(x.label)}">${x.icon}</span>
          <span class="fc-t"><b>${x.max}°</b><i>${x.min}°</i></span>
          <span class="fc-rain" title="비 올 확률">${x.rain == null ? '' : '💧' + x.rain + '%'}</span>
        </li>`).join('');
      sub.textContent = `${name} · 내일부터 7일 · Open-Meteo 예상`;
    } catch (e) {
      if (want === i) list.innerHTML = `<li class="fc-load">예보를 불러오지 못했어요<br><small>${esc(e.message)}</small></li>`;
    }
  }
  tabs.forEach((b, k) => b.addEventListener('click', () => load(k)));
  load(0);
})();
$('#srcNote').textContent = SOURCE === 'supabase' ? '자료: Supabase DB' : '자료: 백업 파일 (Supabase 연결 전)';
if (window.__WARNING__) console.warn('[/api/places]', window.__WARNING__);

renderStats();
buildMap();
refresh();
applyView();
const first = Number(location.hash.slice(1));
if (byId.has(first)) select(first);
