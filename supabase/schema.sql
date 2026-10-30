-- 제주 역사문화 스탬프 투어 : Supabase 테이블
-- Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 Run 하세요. (여러 번 실행해도 안전합니다)
-- 실행 순서: 1) 이 파일(schema.sql)  →  2) seed.sql (데이터 120건)

-- 위치정보 (제주특별자치도_제주역사문화위치정보)
create table if not exists public.jeju_location (
  id           integer primary key,           -- 데이터 고유번호
  name         text not null,                 -- 장소명
  lat          double precision not null,     -- 위도
  lng          double precision not null,     -- 경도
  zip          text,                          -- 우편번호
  addr         text,                          -- 위치(주소)
  coord_system text,                          -- 좌표계값
  detail_url   text,                          -- 데이터 상세보기 URL
  base_date    date                           -- 데이터기준일자
);

-- 일반정보 (제주특별자치도_제주역사문화일반정보) : 위치정보와 id 로 연결
create table if not exists public.jeju_general (
  id          integer primary key references public.jeju_location(id) on delete cascade,
  category    text,   -- 분류 (민속 / 확장분야)
  dir1        text,   -- 디렉토리1 (자연, 사회, 의식주 …)
  dir2        text,   -- 디렉토리2
  title       text,   -- 제목
  subtitle    text,   -- 부제목
  author      text,   -- 저작자
  subject     text,   -- 주제
  content     text,   -- 내용
  toc         text,   -- 목차
  abstract    text,   -- 초록
  publisher   text,   -- 발행자
  pub_date    text,   -- 발행일
  kind        text,   -- 자료유형
  form        text,   -- 자료형태
  language    text,
  scope       text,
  source      text,   -- 출처
  contributor text,
  refs        text,   -- 참고문헌
  base_date   date
);

-- 두 테이블을 합쳐서 보여 주는 뷰 : API(/api/places)가 이것만 읽는다
create or replace view public.jeju_places with (security_invoker = true) as
select l.id, l.name, l.lat, l.lng, l.zip, l.addr,
       g.category as cat, g.dir1 as d1, g.dir2 as d2, g.title, g.subtitle, g.author, g.subject,
       g.content, g.toc, g.abstract, g.pub_date as pubdate, g.kind, g.source, l.detail_url as url
from public.jeju_location l
join public.jeju_general g on g.id = l.id;

-- 보안(RLS): 누구나 읽기만 가능, 쓰기는 대시보드/서비스 키로만
alter table public.jeju_location enable row level security;
alter table public.jeju_general  enable row level security;

drop policy if exists "jeju_location_read" on public.jeju_location;
create policy "jeju_location_read" on public.jeju_location for select using (true);
drop policy if exists "jeju_general_read" on public.jeju_general;
create policy "jeju_general_read" on public.jeju_general for select using (true);

grant select on public.jeju_places to anon, authenticated;

notify pgrst, 'reload schema';
