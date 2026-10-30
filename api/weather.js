// GET /api/weather?lat=33.5&lng=126.5 — 기상청 초단기실황을 그 지점의 격자로 바꿔 조회한다.
import { fetchNowcast } from '../server/kma.js'
import { toGrid } from '../server/grid.js'

const num = (v) => {
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : 0 // "강수없음" 같은 글자는 0
}

export default async function handler(req, res) {
  const lat = Number(req.query.lat)
  const lng = Number(req.query.lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 32 || lat > 39 || lng < 124 || lng > 132) {
    return res.status(400).json({ error: 'lat, lng 값이 올바르지 않아요.' })
  }

  const { nx, ny } = toGrid(lat, lng)
  const { status, body } = await fetchNowcast(process.env.WEATHER_API_KEY, String(nx), String(ny))
  if (status !== 200) return res.status(status).json({ error: body.error || `기상청 오류 (${status})` })

  const header = body.response?.header
  if (header?.resultCode !== '00') {
    return res.status(502).json({ error: `기상청 오류 ${header?.resultCode ?? ''}: ${header?.resultMsg ?? '응답 형식이 올바르지 않아요.'}` })
  }
  const items = body.response.body.items?.item ?? []
  if (!items.length) return res.status(502).json({ error: '아직 관측 자료가 없어요. 잠시 후 다시 시도해 주세요.' })

  const v = Object.fromEntries(items.map((i) => [i.category, i.obsrValue]))
  const { baseDate, baseTime } = items[0]
  res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=300')
  return res.status(200).json({
    nx,
    ny,
    observedAt: `${baseDate.slice(0, 4)}-${baseDate.slice(4, 6)}-${baseDate.slice(6, 8)} ${baseTime.slice(0, 2)}:${baseTime.slice(2, 4)}`,
    temperature: num(v.T1H),
    humidity: Math.round(num(v.REH)),
    rainfall: num(v.RN1),
    windSpeed: num(v.WSD),
    windDirection: Math.round(num(v.VEC)),
    precipType: Math.round(num(v.PTY)),
  })
}
