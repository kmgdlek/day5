// Supabase REST(PostgREST) 호출 도우미 — 서버 함수 안에서만 쓴다.
// 환경변수 이름은 두 가지를 모두 받는다 (Day_4 에서 등록해 둔 VITE_ 이름도 그대로 사용 가능).
export function supabaseEnv() {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim().replace(/\/$/, '')
  const key = (process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '').trim()
  return { url, key }
}

export async function sbSelect(table, query = 'select=*') {
  const { url, key } = supabaseEnv()
  if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_ANON_KEY 환경변수가 없습니다.')
  const res = await fetch(`${url}/rest/v1/${table}?${query}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${text.slice(0, 200)}`)
  return JSON.parse(text)
}
