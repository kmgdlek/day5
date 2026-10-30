"""data/ 폴더의 CSV 2개(위치정보 + 일반정보)로 아래 두 파일을 만든다.

  supabase/seed_*.sql  Supabase SQL Editor 에 순서대로 붙여넣어 실행하면 DB에 데이터가 들어간다
  data/places.json    DB에 연결하지 못할 때 API 가 대신 내려주는 백업 데이터

사용: python3 -I scripts/make_seed.py   (프로젝트 폴더에서 실행)
"""
import csv
import io
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LOC = ROOT / 'data' / '제주특별자치도_제주역사문화위치정보_20221209.csv'
GEN = ROOT / 'data' / '제주특별자치도_제주역사문화일반정보_20221209.csv'


def load(path):
    with io.open(path, encoding='cp949', newline='') as f:  # 원본은 EUC-KR(CP949)
        return list(csv.DictReader(f))


def q(v):
    """SQL 문자열 (달러 인용이라 따옴표를 따로 처리할 필요가 없다)"""
    v = (v or '').strip()
    if not v:
        return 'null'
    assert '$jq$' not in v
    return f'$jq${v}$jq$'


def clean(v):
    v = (v or '').strip()
    return '' if v in ('', '해당없음') else v


loc_rows = load(LOC)
gen_rows = {r['데이터 고유번호']: r for r in load(GEN)}

HEAD = '-- make_seed.py 로 만든 파일입니다. 여러 번 실행해도 안전합니다 (같은 id는 덮어씀).\n\n'
TAIL = "\nnotify pgrst, 'reload schema';\n"
OUT = ROOT / 'supabase'
for old in OUT.glob('seed*.sql'):
    old.unlink()

# 1) 위치정보
loc_sql = ['insert into public.jeju_location (id, name, lat, lng, zip, addr, coord_system, detail_url, base_date) values']
loc_sql.append(',\n'.join(
    f"({int(r['데이터 고유번호'])}, {q(r['장소명'])}, {float(r['위도'])}, {float(r['경도'])}, {q(r['우편번호'])}, "
    f"{q(r['위치'])}, {q(r['좌표계값'])}, {q(r['데이터 상세보기 URL'])}, {q(r['데이터기준일자'])}::date)"
    for r in loc_rows))
loc_sql.append("""on conflict (id) do update set name = excluded.name, lat = excluded.lat, lng = excluded.lng, zip = excluded.zip,
  addr = excluded.addr, coord_system = excluded.coord_system, detail_url = excluded.detail_url, base_date = excluded.base_date;""")
(OUT / 'seed_1_location.sql').write_text(HEAD + '\n'.join(loc_sql) + TAIL, encoding='utf-8')

# 2) 일반정보 (글이 길어서 40건씩 나눈다 — SQL Editor 에 붙여넣기 쉽게)
cols = ['id', 'category', 'dir1', 'dir2', 'title', 'subtitle', 'author', 'subject', 'content', 'toc', 'abstract', 'publisher',
        'pub_date', 'kind', 'form', 'language', 'scope', 'source', 'contributor', 'refs', 'base_date']
src = ['데이터 고유번호', '분류', '디렉토리1', '디렉토리2', '제목', '부제목', '저작자', '주제', '내용', '목차', '초록', '발행자',
       '발행일', '자료유형', '자료형태', '언어', '범위', '출처', '기여자', '참고문헌', '데이터기준일자']
values = []
for r in loc_rows:
    g = gen_rows[r['데이터 고유번호']]
    values.append('(' + ', '.join([str(int(g['데이터 고유번호']))] + [q(g[k]) for k in src[1:-1]] + [f"{q(g['데이터기준일자'])}::date"]) + ')')
upd = 'on conflict (id) do update set ' + ', '.join(f'{c} = excluded.{c}' for c in cols[1:]) + ';'
CHUNK = 40
files = ['seed_1_location.sql']
for n, i in enumerate(range(0, len(values), CHUNK), start=1):
    name = f'seed_2_general_{n}.sql'
    files.append(name)
    body = f"insert into public.jeju_general ({', '.join(cols)}) values\n" + ',\n'.join(values[i:i + CHUNK]) + '\n' + upd
    (OUT / name).write_text(HEAD + body + TAIL, encoding='utf-8')
print('seed files:', ', '.join(files))

places = []
for r in loc_rows:
    g = gen_rows[r['데이터 고유번호']]
    places.append({
        'id': int(r['데이터 고유번호']), 'name': r['장소명'].strip(), 'lat': float(r['위도']), 'lng': float(r['경도']),
        'zip': clean(r['우편번호']), 'addr': clean(r['위치']), 'cat': g['분류'].strip(),
        'd1': clean(g['디렉토리1']), 'd2': clean(g['디렉토리2']), 'title': clean(g['제목']), 'subtitle': clean(g['부제목']),
        'author': clean(g['저작자']), 'subject': [s.strip() for s in re.split(r'[.,]', g['주제']) if clean(s)],
        'content': clean(g['내용']), 'toc': clean(g['목차']), 'abstract': clean(g['초록']), 'pubdate': clean(g['발행일']),
        'kind': clean(g['자료유형']), 'source': clean(g['출처']), 'url': r['데이터 상세보기 URL'].strip(),
    })
(ROOT / 'data' / 'places.json').write_text(json.dumps(places, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
print(len(places), 'places -> data/places.json')
