# 제주 역사문화 스탬프 투어 (2단계: API 호출 버전)

1단계(파일 데이터)를 **API 호출 방식**으로 바꾼 버전입니다.

```
브라우저(index.html + app.js)
   ├─ GET /api/places   → Supabase DB (jeju_location + jeju_general 을 합친 뷰)
   ├─ GET /api/photos   → Pixabay 사진 검색
   └─ GET /api/weather  → 기상청 초단기실황 (좌표 → 격자 변환)
```

비밀 키는 모두 **서버 함수(`api/*.js`)에서만** 쓰고, 브라우저에는 내려가지 않습니다.

## 1. 환경변수

| 이름 | 용도 | 어디서 얻나 |
|---|---|---|
| `WEATHER_API_KEY` | 기상청 날씨 | 공공데이터포털 → 마이페이지 → 일반 인증키 |
| `PIXABAY_API_KEY` | 사진 검색 | https://pixabay.com/api/docs/ |
| `SUPABASE_URL` | DB 주소 | Supabase → Project Settings → API |
| `SUPABASE_ANON_KEY` | DB 읽기 키(읽기 전용) | 같은 곳의 anon / publishable key |

* `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` 이름으로 이미 등록해 두었다면 그대로 써도 됩니다.
* **로컬**: `.env.example` 을 `.env` 로 복사해서 값을 채웁니다. (`.env` 는 `.gitignore` 에 들어 있어 GitHub 에 올라가지 않아요)
* **Vercel**: Project → Settings → Environment Variables 에 같은 이름으로 등록 → **Redeploy**.
* `service_role` 키는 쓰지 않습니다. 절대 넣지 마세요.

## 2. Supabase 준비 (한 번만)

SQL Editor 에서 아래 파일을 **순서대로** 붙여넣고 Run 합니다.

1. `supabase/schema.sql` — 테이블 2개 + 합친 뷰 `jeju_places` + 읽기 전용 보안(RLS)
2. `supabase/seed_1_location.sql` — 위치정보 120건
3. `supabase/seed_2_general_1.sql`, `_2.sql`, `_3.sql` — 일반정보 120건 (40건씩)

DB 에 연결하지 못하면 `/api/places` 가 `data/places.json`(같은 내용)으로 대신 답하고,
화면 아래에 "자료: 백업 파일"이라고 표시합니다. DB 에서 오면 "자료: Supabase DB"가 보입니다.

CSV 를 바꾸면 `python3 -I scripts/make_seed.py` 로 SQL 과 백업 파일을 다시 만듭니다.

## 3. 내 컴퓨터에서 실행

```bash
node dev-server.mjs
```

→ http://localhost:3000  (Vercel 과 같은 방식으로 `/api/*` 가 동작합니다)

## 4. GitHub → Vercel 배포

```bash
cd 김민기_2단계
git init -b main
git add .
git status          # ← .env 가 목록에 없는지 꼭 확인!
git commit -m "2단계: API 호출 버전"
git remote add origin https://github.com/kmgdlek/day5.git
git push -u origin main
```

1. Vercel → Add New Project → GitHub 의 `day5` 저장소 선택 (Framework Preset: **Other**, Build Command 비움)
2. Environment Variables 4개 등록 후 Deploy
3. **시크릿 창**(`Cmd + Shift + N`)에서 Vercel 링크를 열어 확인: 목록, 3D 지도, 날씨, 사진이 보이면 성공

## 5. 키가 올라가지 않았는지 확인

```bash
git ls-files | grep -i "\.env"        # .env.example 만 나와야 해요
git grep -n -i "serviceKey\|api_key" -- . ':!.env.example' ':!README.md'
```
