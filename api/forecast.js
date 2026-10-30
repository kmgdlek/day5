// GET /api/forecast?lat=33.5&lng=126.5 — Open-Meteo 로 "내일부터 7일" 예보를 조회한다 (키 필요 없음).
// Open-Meteo 는 최대 16일 뒤까지 예보를 주지만, 일주일 넘게 뒤는 정확도가 떨어져서 7일만 보여 준다.
import { describe } from '../server/wmo.js'

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토']

export default async function handler(req, res) {
  const lat = Number(req.query.lat)
  const lng = Number(req.query.lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 32 || lat > 39 || lng < 124 || lng > 132) {
    return res.status(400).json({ error: 'lat, lng 값이 올바르지 않아요.' })
  }

  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max',
    forecast_days: '8', // 오늘 + 앞으로 7일 (오늘은 아래에서 뺀다)
    wind_speed_unit: 'ms',
    timezone: 'Asia/Seoul',
  })

  try {
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { signal: AbortSignal.timeout(8000) })
    if (!r.ok) return res.status(502).json({ error: `날씨 서버 오류 (${r.status})` })
    const d = (await r.json()).daily
    if (!d?.time?.length) return res.status(502).json({ error: '예보 자료가 비어 있어요.' })

    const days = d.time.slice(1, 8).map((date, k) => {
      const i = k + 1 // 0번(오늘)은 건너뛴다
      const [, m, day] = date.split('-').map(Number)
      return {
        date,
        md: `${m}/${day}`,
        weekday: WEEKDAY[new Date(`${date}T12:00:00Z`).getUTCDay()],
        max: Math.round(d.temperature_2m_max[i]),
        min: Math.round(d.temperature_2m_min[i]),
        rain: d.precipitation_probability_max?.[i] ?? null, // 비 올 확률(%)
        wind: Math.round(d.wind_speed_10m_max[i] * 10) / 10,
        code: d.weather_code[i],
        ...describe(d.weather_code[i]),
      }
    })

    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=600')
    return res.status(200).json({ days })
  } catch {
    return res.status(502).json({ error: '날씨 서버에 연결하지 못했어요.' })
  }
}
