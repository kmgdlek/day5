// GET /api/weather?lat=33.5&lng=126.5 — Open-Meteo(키가 필요 없는 무료 날씨 API)로 현재 날씨를 조회한다.
// Day_2 에서 쓴 방식과 같고, 서버 함수가 대신 불러서 10분 동안 캐시해 준다.

// 날씨 코드(WMO) → 아이콘 · 글자
function describe(code) {
  if (code >= 95) return { icon: '⛈️', label: '뇌우' }
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return { icon: '🌧️', label: '비' }
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { icon: '❄️', label: '눈' }
  if (code === 45 || code === 48) return { icon: '🌫️', label: '안개' }
  if (code === 0 || code === 1) return { icon: '☀️', label: '맑음' }
  return { icon: '⛅', label: code === 2 ? '구름 조금' : '흐림' }
}

export default async function handler(req, res) {
  const lat = Number(req.query.lat)
  const lng = Number(req.query.lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 32 || lat > 39 || lng < 124 || lng > 132) {
    return res.status(400).json({ error: 'lat, lng 값이 올바르지 않아요.' })
  }

  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    current: 'temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_direction_10m',
    wind_speed_unit: 'ms',
    timezone: 'Asia/Seoul',
  })

  try {
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { signal: AbortSignal.timeout(8000) })
    if (!r.ok) return res.status(502).json({ error: `날씨 서버 오류 (${r.status})` })
    const c = (await r.json()).current
    if (!c) return res.status(502).json({ error: '날씨 자료가 비어 있어요.' })

    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=300')
    return res.status(200).json({
      observedAt: String(c.time).replace('T', ' '),
      temperature: Math.round(c.temperature_2m * 10) / 10,
      humidity: Math.round(c.relative_humidity_2m),
      rainfall: c.precipitation,
      windSpeed: Math.round(c.wind_speed_10m * 10) / 10,
      windDirection: Math.round(c.wind_direction_10m),
      code: c.weather_code,
      ...describe(c.weather_code),
    })
  } catch {
    return res.status(502).json({ error: '날씨 서버에 연결하지 못했어요.' })
  }
}
