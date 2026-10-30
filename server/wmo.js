// 날씨 코드(WMO) → 아이콘 · 글자. /api/weather 와 /api/forecast 가 함께 쓴다.
export function describe(code) {
  if (code >= 95) return { icon: '⛈️', label: '뇌우' }
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return { icon: '🌧️', label: '비' }
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { icon: '❄️', label: '눈' }
  if (code === 45 || code === 48) return { icon: '🌫️', label: '안개' }
  if (code === 0 || code === 1) return { icon: '☀️', label: '맑음' }
  return { icon: '⛅', label: code === 2 ? '구름 조금' : '흐림' }
}
