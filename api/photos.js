// GET /api/photos?q=검색어&per_page=12 — Pixabay 사진 검색 (API 키는 서버에서만 사용)
export default async function handler(req, res) {
  const key = process.env.PIXABAY_API_KEY
  if (!key) return res.status(500).json({ error: 'PIXABAY_API_KEY 환경변수가 없습니다.' })

  const q = String(req.query.q || 'jeju island').slice(0, 100)
  const perPage = Math.min(Math.max(Number(req.query.per_page) || 12, 3), 30)
  const params = new URLSearchParams({
    key,
    q,
    image_type: 'photo',
    orientation: 'horizontal',
    safesearch: 'true',
    per_page: String(perPage),
  })

  try {
    const r = await fetch(`https://pixabay.com/api/?${params}`)
    if (!r.ok) return res.status(r.status).json({ error: `Pixabay 오류 ${r.status}` })
    const data = await r.json()
    // pixabay.com/get/... 주소는 다른 사이트에서 불러오면 429(Too Many Requests)가 나므로,
    // 공식 CDN(cdn.pixabay.com)의 크기별 주소를 previewURL(_150)에서 만들어 쓴다.
    const sized = (h, size) => h.previewURL.replace('_150.', `_${size}.`)
    const hits = (data.hits || []).map((h) => ({
      id: h.id,
      tags: h.tags,
      user: h.user,
      pageURL: h.pageURL,
      webformatURL: sized(h, 640),
      largeImageURL: sized(h, 1280),
    }))
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=3600')
    return res.status(200).json({ query: q, total: data.totalHits, hits })
  } catch {
    return res.status(502).json({ error: 'Pixabay 서버에 연결하지 못했습니다.' })
  }
}
