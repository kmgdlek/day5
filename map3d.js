/* 3D 지도
 * 지형(한라산·오름·현무암 해안·밭 모자이크), 바다, 파도 거품, 숲, 구름, 배, 지명, 주변 국가는
 * Day_4 에서 만든 3D 제주 지도를 가져왔고, 그 위에 장소 120곳(핀·도장·찜 코스)을 올렸다.
 * 좌표는 1 unit ≈ 1 km. three.js 는 vendor/three-bundle.js 의 JT 로 불러 쓴다.
 * app.js 의 DATA, state, favs, stamped(), isVisible(), select(), prefs 를 읽는다.
 */
function createMap3D(box) {
  const T = JT;

  /* ---------- 좌표 · 난수 ---------- */
  const ANGLE = -0.236; // 섬의 장축은 동쪽이 약간 위(북)로 기울어져 있다
  const CA = Math.cos(ANGLE), SA = Math.sin(ANGLE);
  const lonLat = (lon, lat) => ({ x: (lon - 126.55) * 93, z: -(lat - 33.383) * 111 });
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const smooth = (a, b, t) => { const k = clamp((t - a) / (b - a), 0, 1); return k * k * (3 - 2 * k); };
  const hash = (a, b) => { const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return v - Math.floor(v); };
  function rng(seed) { let s = seed; return () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296; }
  const noise = (x, z) => Math.sin(x * 0.33 + 1.3) * Math.sin(z * 0.47 + 0.7) + 0.5 * Math.sin(x * 0.85 + z * 0.65 + 2) + 0.3 * Math.sin(x * 1.7 - z * 1.3);

  /* ---------- 지형 높이 ---------- */
  const SEA_LEVEL = 0.1, COAST = 0.15;
  const HALLA = lonLat(126.533, 33.362);
  // 지형 위에 솟는 봉우리(산방산·성산일출봉·오름)와 부속 섬(우도·비양도)
  const named = [
    [126.314, 33.239, 1.6, 0.9], [126.942, 33.458, 1.2, 0.8], [126.951, 33.506, 1.4, 1.3], [126.228, 33.42, 1.0, 0.9],
    [126.358, 33.364, 0.8, 1.0], [126.804, 33.482, 0.8, 0.9], [126.831, 33.446, 0.6, 0.9], [126.289, 33.205, 0.6, 0.8], [126.71, 33.447, 0.5, 1.0],
  ].map(([lon, lat, amp, sig]) => ({ ...lonLat(lon, lat), amp, sig }));
  const bumps = [...named];
  {
    const rand = rng(7);
    let tries = 0;
    while (bumps.length < named.length + 70 && tries++ < 2000) {
      const x = (rand() - 0.5) * 66, z = (rand() - 0.5) * 26;
      if (Math.hypot((x * CA + z * SA) / 37, (-x * SA + z * CA) / 15.5) > 0.82) continue;
      if (Math.hypot(x - HALLA.x, z - HALLA.z) < 6.5) continue;
      bumps.push({ x, z, amp: 0.25 + rand() * 0.45, sig: 0.7 + rand() * 0.6 });
    }
  }
  function heightAt(x, z) {
    const u = x * CA + z * SA, v = -x * SA + z * CA;
    const r = Math.hypot(u / 37, v / 15.5) * (1 + 0.045 * noise(x, z));
    let h = r < 1 ? COAST + 1.6 * Math.pow(1 - r, 0.9) : COAST - (r - 1) * 8;
    const dx = x - HALLA.x, dz = z - HALLA.z;
    const d2 = (dx * dx) / (2 * 5.4 * 5.4) + (dz * dz) / (2 * 4.4 * 4.4);
    h += 5 * Math.exp(-d2) + 0.9 * Math.exp(-d2 / 3);
    h -= 0.55 * Math.exp(-(dx * dx + dz * dz) / (2 * 0.5 * 0.5)); // 백록담
    for (const b of bumps) { const ex = x - b.x, ez = z - b.z; h += b.amp * Math.exp(-(ex * ex + ez * ez) / (2 * b.sig * b.sig)); }
    return h;
  }
  // 바다에 떨어진 좌표를 해안선 안쪽으로 끌어당긴다 (이 지형은 실제 해안선이 아니라 모양을 본뜬 것이라서)
  function snapToLand(x, z, min = 0.22) {
    let px = x, pz = z;
    for (let i = 0; i < 300 && heightAt(px, pz) < min; i++) {
      const len = Math.hypot(px, pz) || 1;
      px -= (px / len) * 0.15; pz -= (pz / len) * 0.15;
    }
    return { x: px, z: pz };
  }

  /* ---------- 색 (라이트 / 다크) ---------- */
  const isDark = () => document.documentElement.getAttribute('data-theme') === 'dark' ||
    (!document.documentElement.getAttribute('data-theme') && matchMedia('(prefers-color-scheme: dark)').matches);
  const STOPS = [
    [-3, '#2b6fa8'], [-2, '#3a8fc0'], [-1, '#58b3d6'], [-0.3, '#8fd8e4'], [0.05, '#b8eeea'], [0.1, '#eadfb4'], [0.3, '#dccf9a'],
    [0.55, '#a9c76a'], [1.4, '#78a54c'], [2.6, '#4d8341'], [3.6, '#6d7b46'], [4.6, '#8e7c5e'], [5.6, '#a58a76'], [7.2, '#ece7de'],
  ].map(([h, c]) => [h, new T.Color(c)]);
  const BASALT = new T.Color('#3b3b42');
  const FIELDS = ['#b9d36a', '#e6cf63', '#9ccc65', '#d9a066', '#f2d64b', '#7fb85a', '#c8dc7a'].map((c) => new T.Color(c));
  const GRASS = new T.Color('#cdb862');
  function colorAt(h, out) {
    if (h <= STOPS[0][0]) return out.copy(STOPS[0][1]);
    for (let i = 1; i < STOPS.length; i++) {
      if (h <= STOPS[i][0]) return out.copy(STOPS[i - 1][1]).lerp(STOPS[i][1], (h - STOPS[i - 1][0]) / (STOPS[i][0] - STOPS[i - 1][0]));
    }
    return out.copy(STOPS[STOPS.length - 1][1]);
  }
  function landOverlay(h, x, z, c) {
    c.lerp(BASALT, smooth(0.1, 0.16, h) * (1 - smooth(0.28, 0.5, h)) * clamp(noise(x * 1.1, z * 1.1) + 0.3, 0, 1) * 0.85); // 현무암 해안
    const field = smooth(0.45, 0.8, h) * (1 - smooth(1.5, 2.1, h)); // 밭 모자이크
    if (field > 0) c.lerp(FIELDS[Math.floor(hash(Math.floor(x / 1.5), Math.floor(z / 1.2)) * FIELDS.length)], field * 0.75);
    c.lerp(GRASS, smooth(0.8, 1.3, h) * (1 - smooth(2.6, 3.2, h)) * smooth(0.1, 0.9, noise(x * 0.6 + 5, z * 0.6 - 3)) * 0.65); // 억새 들판
    c.offsetHSL(0, 0, noise(x * 2.1, z * 2.1) * 0.025 * smooth(1.8, 2.6, h) * (1 - smooth(3.6, 4.4, h))); // 숲 얼룩
  }

  /* ---------- 장면 ---------- */
  const SKY = { light: 0xdbeaf3, dark: 0x0c1c25 };
  const scene = new T.Scene();
  scene.background = new T.Color(SKY.light);
  scene.fog = new T.Fog(SKY.light, 170, 440); // 먼 바다가 수평선으로 자연스럽게 사라진다
  const camera = new T.PerspectiveCamera(45, 1, 0.5, 1500);
  const renderer = new T.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, matchMedia('(max-width: 760px)').matches ? 1.5 : 2));
  box.prepend(renderer.domElement);
  const hemi = new T.HemisphereLight(0xffffff, 0x6b8e6b, 0.95);
  const sun = new T.DirectionalLight(0xffffff, 1.15);
  sun.position.set(30, 50, 20);
  scene.add(hemi, sun);

  // 지형 (색은 원본을 저장해 두고 테마에 따라 밝기만 바꾼다)
  const tg = new T.PlaneGeometry(96, 56, 260, 150);
  tg.rotateX(-Math.PI / 2);
  const tp = tg.attributes.position;
  const baseColors = new Float32Array(tp.count * 3);
  {
    const c = new T.Color(), lake = new T.Color('#3fa7c9');
    for (let i = 0; i < tp.count; i++) {
      const x = tp.getX(i), z = tp.getZ(i), h = Math.max(heightAt(x, z), -3);
      tp.setY(i, h < SEA_LEVEL ? SEA_LEVEL + (h - SEA_LEVEL) * 0.12 : h); // 수면 아래는 완만한 대륙붕
      colorAt(h, c);
      if (h >= SEA_LEVEL) landOverlay(h, x, z, c);
      if (Math.hypot(x - HALLA.x, z - HALLA.z) < 0.5) c.copy(lake); // 백록담
      baseColors.set([c.r, c.g, c.b], i * 3);
    }
  }
  tg.setAttribute('color', new T.BufferAttribute(new Float32Array(baseColors.length), 3));
  tg.computeVertexNormals();
  scene.add(new T.Mesh(tg, new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 })));

  // 바다: 지형 바깥을 끝없이 덮어 가장자리가 보이지 않게 한다 (지형 가장자리 수심 색과 같은 색)
  const oceanMat = new T.MeshStandardMaterial({ color: '#2b6fa8', roughness: 0.95, metalness: 0 });
  {
    const shape = new T.Shape();
    shape.moveTo(-900, -900); shape.lineTo(900, -900); shape.lineTo(900, 900); shape.lineTo(-900, 900); shape.lineTo(-900, -900);
    const hole = new T.Path();
    hole.moveTo(-48, -28); hole.lineTo(-48, 28); hole.lineTo(48, 28); hole.lineTo(48, -28); hole.lineTo(-48, -28);
    shape.holes.push(hole);
    const ocean = new T.Mesh(new T.ShapeGeometry(shape), oceanMat);
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.y = SEA_LEVEL + (-3 - SEA_LEVEL) * 0.12;
    scene.add(ocean);
  }

  /* ---------- 글자 스프라이트 ---------- */
  const FONT = '700 64px -apple-system, "Pretendard", "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", sans-serif';
  function makeLabel(text, { color = '#ffffff', stroke = 'rgba(15,40,55,.85)', w = 6, fog = true } = {}) {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 128;
    const g = c.getContext('2d');
    g.font = FONT; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 12; g.lineJoin = 'round';
    g.strokeStyle = stroke; g.strokeText(text, 256, 64);
    g.fillStyle = color; g.fillText(text, 256, 64);
    const tex = new T.CanvasTexture(c);
    tex.colorSpace = T.SRGBColorSpace;
    const sp = new T.Sprite(new T.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog }));
    sp.scale.set(w, w / 4, 1);
    sp.userData.base = w;
    return sp;
  }
  const regionLabels = [['한라산', 126.533, 33.362, 1.9], ['제주시', 126.53, 33.5, 1.2], ['서귀포시', 126.56, 33.255, 1.2], ['성산', 126.9, 33.44, 1.2], ['우도', 126.951, 33.506, 1.8], ['한림', 126.27, 33.41, 1.2], ['대정', 126.25, 33.22, 1.2]].map(([name, lon, lat, lift]) => {
    const p = lonLat(lon, lat), s = makeLabel(name, { w: 6 });
    s.position.set(p.x, Math.max(heightAt(p.x, p.z), 0.15) + lift, p.z);
    scene.add(s);
    return s;
  });

  /* ---------- 주변 국가 (흐릿한 실루엣) ---------- */
  const xy = (lon, lat) => new T.Vector2((lon - 126.55) * 93, (lat - 33.383) * 111);
  const worldMats = [];
  function landmass(coords) {
    const pts = coords.map(([lo, la]) => xy(lo, la));
    const mat = new T.MeshBasicMaterial({ color: '#b9c7bd', transparent: true, opacity: 0.55, fog: false, depthWrite: false, side: T.DoubleSide });
    worldMats.push(mat);
    const mesh = new T.Mesh(new T.ShapeGeometry(new T.Shape(pts)), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.05;
    scene.add(mesh);
  }
  landmass([[126.12, 34.55], [126.45, 34.28], [126.8, 34.42], [127.3, 34.5], [127.7, 34.65], [128.1, 34.9], [128.7, 34.82], [129.1, 35.05], [129.4, 35.6], [129.45, 36.2], [129.4, 37.0], [129.2, 38.0], [126.0, 38.0], [126.5, 37.0], [126.2, 36.2], [126.5, 35.6], [126.4, 35.1]]);
  landmass([[129.6, 33.6], [130.9, 33.95], [131.8, 33.6], [131.6, 32.4], [131.4, 31.4], [130.7, 31.0], [130.2, 31.3], [130.2, 32.6], [129.8, 33.0]]);
  landmass([[129.2, 34.65], [129.5, 34.7], [129.45, 34.1], [129.2, 34.2]]);
  landmass([[123.0, 29.5], [122.2, 30.6], [121.9, 31.5], [120.9, 32.2], [120.4, 34.0], [119.2, 35.0], [120.5, 36.1], [121.0, 37.0], [122.5, 37.4], [122.7, 37.0], [112, 38], [112, 29.5]]);
  for (const [name, lon, lat] of [['대한민국', 127.3, 35.6], ['일본', 130.8, 32.8], ['중국', 119.5, 33.2]]) {
    const s = makeLabel(name, { color: '#64748b', stroke: 'rgba(255,255,255,.85)', w: 60, fog: false });
    const p = xy(lon, lat);
    s.position.set(p.x, 3, -p.y);
    scene.add(s);
  }

  /* ---------- 장식: 파도 거품 · 숲 · 구름 · 배 ---------- */
  function coastLoop(level, n) {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const t = (i / n) * Math.PI * 2;
      for (let k = 1.06; k > 0.2; k -= 0.005) { // 1.06 부터 시작해 우도·비양도 같은 부속 섬은 건너뛴다
        const u = 37 * k * Math.cos(t), v = 15.5 * k * Math.sin(t);
        const x = u * CA - v * SA, z = u * SA + v * CA, h = heightAt(x, z);
        if (h > level) { pts.push(new T.Vector3(x, h + 0.12, z)); break; }
      }
    }
    return pts;
  }
  const foam = new T.Mesh(
    new T.TubeGeometry(new T.CatmullRomCurve3(coastLoop(0.115, 720), true, 'catmullrom', 0.5), 1400, 0.055, 5, true),
    new T.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.7 }),
  );
  foam.position.y = -0.08;
  scene.add(foam);

  {
    const rand = rng(33), pts = [];
    for (let t = 0; t < 12000 && pts.length < 700; t++) {
      const x = -34 + rand() * 68, z = -14 + rand() * 28, h = heightAt(x, z);
      if (h < 1.7 || h > 4.3 || Math.hypot(x - HALLA.x, z - HALLA.z) < 1.3) continue;
      pts.push({ x, z, h, s: 0.8 + rand() * 0.6, c: rand() });
    }
    const mesh = new T.InstancedMesh(new T.ConeGeometry(0.16, 0.5, 6), new T.MeshStandardMaterial({ flatShading: true }), pts.length);
    const m4 = new T.Matrix4(), col = new T.Color(), greens = ['#2e6b3c', '#3b7d3f', '#4f8a3a'];
    pts.forEach((p, i) => { m4.makeScale(p.s, p.s, p.s).setPosition(p.x, p.h + 0.2 * p.s, p.z); mesh.setMatrixAt(i, m4); mesh.setColorAt(i, col.set(greens[Math.floor(p.c * 3)])); });
    scene.add(mesh);
  }

  const cloudMat = new T.MeshStandardMaterial({ color: '#ffffff', roughness: 1, flatShading: true, transparent: true, opacity: 0.85, emissive: '#ffffff', emissiveIntensity: 0.5 });
  const clouds = [];
  {
    const rand = rng(5);
    for (let i = 0; i < 7; i++) {
      const c = new T.Group(), n = 4 + Math.floor(rand() * 3);
      for (let k = 0; k < n; k++) {
        const s = new T.Mesh(new T.IcosahedronGeometry(0.9 + rand() * 0.9, 1), cloudMat);
        s.position.set((k - n / 2) * 1.3, rand() * 0.5, (rand() - 0.5) * 1.2);
        s.scale.y = 0.6;
        c.add(s);
      }
      c.scale.setScalar(0.7 + rand() * 0.5);
      c.userData = { a: rand() * Math.PI * 2, rx: 52 + rand() * 14, rz: 29 + rand() * 9, y: 11 + rand() * 4, speed: 0.01 + rand() * 0.008 };
      clouds.push(c);
      scene.add(c);
    }
  }
  const boats = [];
  {
    const white = new T.MeshStandardMaterial({ color: '#f8fafc' }), blue = new T.MeshStandardMaterial({ color: '#2563eb' });
    const gray = new T.MeshStandardMaterial({ color: '#475569' }), sailM = new T.MeshStandardMaterial({ color: '#fff7ed' });
    for (let i = 0; i < 6; i++) {
      const g = new T.Group();
      const hull = new T.Mesh(new T.BoxGeometry(0.34, 0.16, 1.0), white); hull.position.y = 0.08;
      const stripe = new T.Mesh(new T.BoxGeometry(0.36, 0.04, 1.02), blue); stripe.position.y = 0.12;
      const mast = new T.Mesh(new T.CylinderGeometry(0.015, 0.015, 0.9, 6), gray); mast.position.y = 0.6;
      const sail = new T.Mesh(new T.ConeGeometry(0.28, 0.8, 3), sailM); sail.scale.z = 0.1; sail.position.set(0, 0.6, 0);
      g.add(hull, stripe, mast, sail);
      g.scale.setScalar(1.5);
      g.userData = { a: (i / 6) * Math.PI * 2, k: 1.14 + (i % 3) * 0.06, dir: i % 2 ? 1 : -1, speed: 0.012 + (i % 3) * 0.003 };
      boats.push(g);
      scene.add(g);
    }
  }
  function animateScenery(t) {
    clouds.forEach((c) => { const d = c.userData, a = d.a + t * d.speed; c.position.set(d.rx * Math.cos(a), d.y, d.rz * Math.sin(a)); });
    boats.forEach((b) => {
      const d = b.userData, a = d.a + t * d.speed * d.dir;
      const u = 37 * d.k * Math.cos(a), v = 15.5 * d.k * Math.sin(a);
      b.position.set(u * CA - v * SA, 0.0, u * SA + v * CA);
      const du = -37 * d.k * Math.sin(a) * d.dir, dv = 15.5 * d.k * Math.cos(a) * d.dir;
      b.rotation.y = Math.atan2(du * CA - dv * SA, du * SA + dv * CA);
    });
  }

  /* ---------- 테마 (라이트 / 다크) ---------- */
  function retheme() {
    const dark = isDark(), k = dark ? 0.5 : 1;
    const col = tg.attributes.color;
    for (let i = 0; i < col.count; i++) col.setXYZ(i, baseColors[i * 3] * k, baseColors[i * 3 + 1] * k, baseColors[i * 3 + 2] * k);
    col.needsUpdate = true;
    oceanMat.color.set('#2b6fa8').multiplyScalar(k);
    const sky = dark ? SKY.dark : SKY.light;
    scene.background.set(sky);
    scene.fog.color.set(sky);
    hemi.intensity = dark ? 0.55 : 0.95;
    sun.intensity = dark ? 0.6 : 1.15;
    cloudMat.opacity = dark ? 0.35 : 0.85;
    cloudMat.emissiveIntensity = dark ? 0.15 : 0.5;
    worldMats.forEach((m) => { m.color.set(dark ? '#3a4a52' : '#b9c7bd'); });
    foam.material.opacity = dark ? 0.35 : 0.7;
  }

  /* ---------- 장소 핀 (120곳) ---------- */
  const COL = { '민속': 0x0d9488, '확장분야': 0xd97706 };
  const stemG = new T.CylinderGeometry(0.035, 0.035, 1.0, 8); stemG.translate(0, 0.5, 0);
  const ballG = new T.SphereGeometry(0.3, 20, 16);
  const ringG = new T.RingGeometry(0.34, 0.42, 24);
  const goldRingG = new T.RingGeometry(0.5, 0.62, 28);
  const hitG = new T.SphereGeometry(0.85, 8, 6);
  const whiteM = new T.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8 });
  const ringM = new T.MeshBasicMaterial({ color: '#ffffff', side: T.DoubleSide });
  const goldM = new T.MeshBasicMaterial({ color: '#f59e0b', side: T.DoubleSide });
  const hitM = new T.MeshBasicMaterial({ visible: false });
  const sprite = (draw, w, h, sw, sh) => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const tex = new T.CanvasTexture(c);
    tex.colorSpace = T.SRGBColorSpace;
    const sp = new T.Sprite(new T.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }));
    sp.scale.set(sw, sh, 1);
    return sp;
  };
  const starSp = () => sprite((g, w, h) => { g.font = `${h * 0.9}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#f59e0b'; g.strokeStyle = '#fff'; g.lineWidth = 8; g.strokeText('★', w / 2, h / 2 + 4); g.fillText('★', w / 2, h / 2 + 4); }, 96, 96, 1.0, 1.0);
  const numSp = (n) => sprite((g, w, h) => { g.fillStyle = '#be185d'; g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 6, 0, 7); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 8; g.stroke(); g.fillStyle = '#fff'; g.font = `700 ${h * 0.55}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(n), w / 2, h / 2 + 4); }, 96, 96, 1.0, 1.0);

  const pins = new Map();
  DATA.forEach((p) => {
    const q = lonLat(p.lng, p.lat), s = snapToLand(q.x, q.z), y = Math.max(heightAt(s.x, s.z), 0.15);
    const g = new T.Group();
    g.position.set(s.x, y, s.z);
    const ballM = new T.MeshStandardMaterial({ color: COL[p.cat] || 0x64748b, roughness: 0.8, emissive: COL[p.cat] || 0x64748b, emissiveIntensity: 0.2 });
    const stem = new T.Mesh(stemG, whiteM);
    const ball = new T.Mesh(ballG, ballM); ball.position.y = 1.15;
    const ring = new T.Mesh(ringG, ringM); ring.position.y = 1.15;
    const gold = new T.Mesh(goldRingG, goldM); gold.position.y = 1.15; gold.visible = false;
    const hit = new T.Mesh(hitG, hitM); hit.position.y = 1.15; hit.userData.id = p.id;
    g.add(stem, ball, ring, gold, hit);
    scene.add(g);
    pins.set(p.id, { p, g, ball, ballM, ring, gold, hit, star: null, badge: null, x: s.x, y, z: s.z, vis: true });
  });

  /* ---------- 선택 표시 · 답사 코스 ---------- */
  const selRing = new T.Mesh(new T.RingGeometry(0.6, 0.78, 40), new T.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9, side: T.DoubleSide, depthWrite: false }));
  selRing.rotation.x = -Math.PI / 2;
  selRing.visible = false;
  scene.add(selRing);
  let nameTag = null, nameTagFor = null;

  let courseMesh = null, courseKey = '', route = [], routeLen = [];
  const runner = new T.Mesh(new T.SphereGeometry(0.26, 14, 10), new T.MeshBasicMaterial({ color: '#ffffff' }));
  runner.visible = false;
  scene.add(runner);
  function buildCourse() {
    const key = favs.join(',');
    if (key === courseKey) return;
    courseKey = key;
    if (courseMesh) { scene.remove(courseMesh); courseMesh.geometry.dispose(); courseMesh = null; }
    route = []; routeLen = [];
    const ids = favs.filter((id) => pins.has(id));
    if (ids.length < 2) { runner.visible = false; return; }
    for (let i = 0; i < ids.length - 1; i++) {
      const a = pins.get(ids[i]), b = pins.get(ids[i + 1]), dist = Math.hypot(b.x - a.x, b.z - a.z);
      for (let s = 0; s < 24; s++) {
        const t = s / 24, x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t;
        const base = a.y + 1.15 + (b.y - a.y) * t;
        route.push(new T.Vector3(x, Math.max(base, heightAt(x, z) + 1.0) + Math.sin(t * Math.PI) * (0.9 + dist * 0.07), z));
      }
    }
    const last = pins.get(ids[ids.length - 1]);
    route.push(new T.Vector3(last.x, last.y + 1.15, last.z));
    let acc = 0;
    routeLen = route.map((v, i) => (i ? (acc += v.distanceTo(route[i - 1])) : 0));
    courseMesh = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(route, false, 'centripetal'), route.length * 2, 0.11, 6, false), new T.MeshBasicMaterial({ color: '#ec4899' }));
    scene.add(courseMesh);
    runner.visible = true;
  }

  /* 화면 상태(필터·도장·찜·선택) → 3D 반영 */
  function sync() {
    pins.forEach((o) => {
      const p = o.p, order = favs.indexOf(p.id) + 1;
      o.vis = isVisible(p);
      o.ballM.transparent = !o.vis;
      o.ballM.opacity = o.vis ? 1 : 0.15;
      o.gold.visible = stamped(p.id) && o.vis;
      if (stamped(p.id) && !o.star) { o.star = starSp(); o.star.position.set(-0.55, 2.15, 0); o.g.add(o.star); }
      if (o.star) o.star.visible = stamped(p.id) && o.vis;
      if (order && (!o.badge || o.badge.userData.n !== order)) {
        if (o.badge) o.g.remove(o.badge);
        o.badge = numSp(order);
        o.badge.userData.n = order;
        o.badge.position.set(0.55, 2.15, 0);
        o.g.add(o.badge);
      }
      if (!order && o.badge) { o.g.remove(o.badge); o.badge = null; }
      if (o.badge) o.badge.visible = o.vis;
    });
    buildCourse();
    const sel = state.sel != null ? pins.get(state.sel) : null;
    selRing.visible = !!sel;
    if (sel) {
      selRing.position.set(sel.x, sel.y + 0.06, sel.z);
      if (nameTagFor !== sel.p.id) {
        if (nameTag) scene.remove(nameTag);
        nameTag = makeLabel(sel.p.name, { w: 8, fog: false });
        nameTagFor = sel.p.id;
        scene.add(nameTag);
      }
      nameTag.visible = true;
    } else if (nameTag) nameTag.visible = false;
  }

  /* ---------- 카메라 ---------- */
  const controls = new T.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.minDistance = 6;
  controls.maxDistance = 280;
  controls.maxPolarAngle = Math.PI * 0.47;
  controls.autoRotateSpeed = 1.4; // 약 45초에 한 바퀴 (시간 기준)
  if (matchMedia('(pointer: coarse)').matches) renderer.domElement.style.touchAction = 'pan-y'; // 세로 스와이프는 페이지 스크롤
  const home = () => { // 세로로 긴 화면(폰)에서는 섬이 잘리지 않도록 카메라를 더 멀리 둔다
    const f = camera.aspect < 1.3 ? Math.min(1.45 / camera.aspect, 2.8) : 1;
    return new T.Vector3(0, 46 * f, 58 * f);
  };
  let fly = null, spinOn = prefs.spin, resume = 0, userBusy = false;
  controls.addEventListener('start', () => { fly = null; userBusy = true; clearTimeout(resume); });
  controls.addEventListener('end', () => { clearTimeout(resume); resume = setTimeout(() => { userBusy = false; }, 3000); });
  const focus = (id) => {
    const o = pins.get(id);
    if (!o) return;
    const target = new T.Vector3(o.x, o.y, o.z);
    fly = { target, pos: target.clone().add(new T.Vector3(0, 8, 11)) };
  };
  const resetView = () => { fly = { target: new T.Vector3(0, 0, 0), pos: home() }; };
  const setSpin = (on) => { spinOn = on; };

  /* ---------- 핀 누르기 / 마우스 올리기 ---------- */
  const ray = new T.Raycaster(), ndc = new T.Vector2(), tip = document.getElementById('tip3');
  function pick(ev) {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects([...pins.values()].filter((o) => o.vis).map((o) => o.hit), false);
    return hits.length ? hits[0].object.userData.id : null;
  }
  let down = null;
  renderer.domElement.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: Date.now() }; });
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y), quick = Date.now() - down.t < 600;
    down = null;
    if (moved < 6 && quick) { const id = pick(e); if (id != null) select(id); }
  });
  renderer.domElement.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || e.buttons) { tip.style.opacity = 0; return; }
    const id = pick(e), r = box.getBoundingClientRect();
    renderer.domElement.style.cursor = id != null ? 'pointer' : 'grab';
    if (id == null) { tip.style.opacity = 0; return; }
    tip.textContent = byId.get(id).name;
    tip.style.left = `${e.clientX - r.left}px`;
    tip.style.top = `${e.clientY - r.top}px`;
    tip.style.opacity = 1;
  });
  renderer.domElement.addEventListener('pointerleave', () => { tip.style.opacity = 0; });

  /* ---------- 그리기 루프 (화면에 안 보이면 멈춘다) ---------- */
  const clock = new T.Clock();
  let raf = 0, active = false, inView = true;
  function frame() {
    raf = 0;
    if (!active || !inView) return;
    const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
    if (fly) { // 선택하면 그 장소로 날아가고, 닫으면 전체 보기로 돌아온다
      const k = 1 - Math.exp(-dt * 4.5);
      controls.target.lerp(fly.target, k);
      camera.position.lerp(fly.pos, k);
      if (camera.position.distanceTo(fly.pos) < 0.2) fly = null;
    }
    animateScenery(t);
    controls.autoRotate = spinOn && !fly && !userBusy;
    for (const l of regionLabels) { const k = clamp(camera.position.distanceTo(l.position) / 60, 0.5, 1.6) * l.userData.base; l.scale.set(k, k / 4, 1); }
    pins.forEach((o) => { // 핀은 줌 거리에 맞춰 크기를 보정해 항상 비슷한 크기로 보이게 한다
      const k = clamp(camera.position.distanceTo(o.g.position) / 60, 0.45, 1.4) * (state.sel === o.p.id ? 1.6 : o.vis ? 1 : 0.55);
      o.g.scale.setScalar(k);
      o.ring.quaternion.copy(camera.quaternion);
      o.gold.quaternion.copy(camera.quaternion);
    });
    const sel = state.sel != null ? pins.get(state.sel) : null;
    if (sel) {
      const k = (t % 1.4) / 1.4;
      selRing.scale.setScalar((1 + k * 2.4) * clamp(camera.position.distanceTo(selRing.position) / 60, 0.45, 1.4));
      selRing.material.opacity = 0.9 * (1 - k);
      const dk = clamp(camera.position.distanceTo(sel.g.position) / 60, 0.45, 1.4);
      nameTag.position.set(sel.x, sel.y + 3.6 * dk, sel.z);
      const tw = 8 * clamp(dk, 0.4, 1.3); // 가까이서는 이름표도 작게
      nameTag.scale.set(tw, tw / 4, 1);
    }
    if (runner.visible && routeLen.length) { // 코스를 따라 달리는 점
      const total = routeLen[routeLen.length - 1], d = (t * 9) % total;
      let i = 1;
      while (i < routeLen.length - 1 && routeLen[i] < d) i++;
      runner.position.lerpVectors(route[i - 1], route[i], clamp((d - routeLen[i - 1]) / (routeLen[i] - routeLen[i - 1] || 1), 0, 1));
    }
    controls.update(dt);
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }
  const start = () => { if (!raf && active && inView) { clock.getDelta(); raf = requestAnimationFrame(frame); } };
  new IntersectionObserver((en) => { inView = en[0].isIntersecting; start(); }).observe(box);
  let homed = false;
  function resize() {
    const w = box.clientWidth, h = box.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (!homed) { camera.position.copy(home()); homed = true; }
  }
  new ResizeObserver(resize).observe(box);
  const setActive = (on) => { active = on; if (on) { resize(); start(); } };

  retheme();
  sync();
  return { sync, focus, retheme, resetView, setSpin, setActive, camera };
}
