// GET /api/places — Supabase 의 jeju_places 뷰(위치정보 + 일반정보)를 읽어 내려준다.
// Supabase 에 연결하지 못하면 data/places.json(같은 내용의 백업)으로 대신 답하고, source 로 알려 준다.
import fs from 'node:fs'
import { sbSelect } from '../server/supabase.js'

const toPlace = (r) => ({
  id: r.id,
  name: (r.name || '').trim(),
  lat: r.lat,
  lng: r.lng,
  zip: clean(r.zip),
  addr: clean(r.addr),
  cat: (r.cat || '').trim(),
  d1: clean(r.d1),
  d2: clean(r.d2),
  title: clean(r.title),
  subtitle: clean(r.subtitle),
  author: clean(r.author),
  subject: (r.subject || '').split(/[.,]/).map((s) => s.trim()).filter((s) => clean(s)),
  content: clean(r.content),
  toc: clean(r.toc),
  abstract: clean(r.abstract),
  pubdate: clean(r.pubdate),
  kind: clean(r.kind),
  source: clean(r.source),
  url: (r.url || '').trim(),
})

function clean(v) {
  const s = (v || '').trim()
  return s === '해당없음' ? '' : s
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600')
  try {
    const rows = await sbSelect('jeju_places', 'select=*&order=id')
    if (!rows.length) throw new Error('jeju_places 가 비어 있습니다. supabase/seed_*.sql 을 실행했는지 확인하세요.')
    return res.status(200).json({ source: 'supabase', count: rows.length, places: rows.map(toPlace) })
  } catch (e) {
    const places = JSON.parse(fs.readFileSync(new URL('../data/places.json', import.meta.url), 'utf8'))
    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).json({ source: 'fallback', warning: e.message, count: places.length, places })
  }
}
