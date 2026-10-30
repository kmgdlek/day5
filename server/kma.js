// 기상청 초단기실황(getUltraSrtNcst) 호출 로직 — 개발 서버(vite.config.js)와 Vercel 함수(api/weather.js)가 함께 쓴다.
// 인증키는 서버에서만 사용하므로 브라우저 번들에 들어가지 않는다.
const ENDPOINT = 'https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst'

const pad = (n) => String(n).padStart(2, '0')

// 초단기실황은 매시 정각 기준 자료가 40분 이후에 제공된다.
// 한국 시간(KST) 기준으로 40분 전이면 한 시간 전 자료를 요청한다.
export function kstBase(now = new Date()) {
  const kst = new Date(now.getTime() + 9 * 3600 * 1000)
  if (kst.getUTCMinutes() < 40) kst.setUTCHours(kst.getUTCHours() - 1)
  return {
    base_date: `${kst.getUTCFullYear()}${pad(kst.getUTCMonth() + 1)}${pad(kst.getUTCDate())}`,
    base_time: `${pad(kst.getUTCHours())}00`,
  }
}

export async function fetchNowcast(key, nx = '52', ny = '33') {
  if (!key) return { status: 500, body: { error: 'WEATHER_API_KEY 환경변수가 없습니다.' } }

  const x = Number(nx)
  const y = Number(ny)
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 1 || x > 149 || y < 1 || y > 253) {
    return { status: 400, body: { error: 'nx(1~149), ny(1~253)는 정수여야 합니다.' } }
  }

  // 공공데이터포털의 Encoded 키(%2B 등 포함)와 Decoded 키 둘 다 받아 준다.
  const serviceKey = key.includes('%') ? decodeURIComponent(key) : key
  const params = new URLSearchParams({
    serviceKey,
    numOfRows: '20',
    pageNo: '1',
    dataType: 'JSON',
    ...kstBase(),
    nx: String(x),
    ny: String(y),
  })

  try {
    const r = await fetch(`${ENDPOINT}?${params}`)
    const text = await r.text()
    try {
      return { status: r.ok ? 200 : r.status, body: JSON.parse(text) }
    } catch {
      // 키 오류 등은 JSON이 아니라 XML로 내려오는 경우가 있다.
      return { status: 502, body: { error: `기상청 응답 오류: ${text.replace(/<[^>]+>/g, ' ').trim().slice(0, 200)}` } }
    }
  } catch {
    return { status: 502, body: { error: '기상청 서버에 연결하지 못했습니다.' } }
  }
}
