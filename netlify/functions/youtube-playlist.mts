const PLAYLIST_ID = 'PLrHok9wh3BEBopCGgpSnm_Q8V04KL877C'
type Video = { id: string; title: string; thumbnail: string }
function findVideos(value: unknown, found: Video[], seen: Set<string>) {
  if (!value || typeof value !== 'object') return
  const object = value as Record<string, unknown>
  const renderer = object.playlistVideoRenderer as Record<string, any> | undefined
  const lockup = object.lockupViewModel as Record<string, any> | undefined
  if (renderer?.videoId && !seen.has(renderer.videoId)) {
    const title = renderer.title?.runs?.map((part: { text?: string }) => part.text ?? '').join('') || renderer.title?.simpleText
    if (title) { seen.add(renderer.videoId); found.push({ id: renderer.videoId, title, thumbnail: `https://i.ytimg.com/vi/${renderer.videoId}/hqdefault.jpg` }) }
  }
  // YouTube currently serves playlist items with this newer view model.
  if (lockup?.contentId && !seen.has(lockup.contentId)) {
    const title = lockup.metadata?.lockupMetadataViewModel?.title?.content
    if (title) {
      seen.add(lockup.contentId)
      found.push({ id: lockup.contentId, title, thumbnail: `https://i.ytimg.com/vi/${lockup.contentId}/hqdefault.jpg` })
    }
  }
  for (const child of Object.values(object)) Array.isArray(child) ? child.forEach(item => findVideos(item, found, seen)) : findVideos(child, found, seen)
}
function extractInitialData(html: string): unknown {
  for (const marker of ['var ytInitialData = ', 'window["ytInitialData"] = ', 'ytInitialData = ']) {
    const start = html.indexOf(marker); if (start < 0) continue
    const jsonStart = html.indexOf('{', start + marker.length); if (jsonStart < 0) continue
    let depth = 0, quoted = false, escaped = false
    for (let i = jsonStart; i < html.length; i++) { const c = html[i]; if (quoted) { if (escaped) escaped = false; else if (c === '\\') escaped = true; else if (c === '"') quoted = false } else if (c === '"') quoted = true; else if (c === '{') depth++; else if (c === '}' && --depth === 0) return JSON.parse(html.slice(jsonStart, i + 1)) }
  }
  throw new Error('YouTube page data was not found')
}
export default async () => {
  try {
    const response = await fetch(`https://www.youtube.com/playlist?list=${PLAYLIST_ID}`, { headers: { 'Accept-Language': 'th-TH,th;q=0.9,en;q=0.7' } })
    if (!response.ok) throw new Error(`YouTube returned ${response.status}`)
    const videos: Video[] = []; findVideos(extractInitialData(await response.text()), videos, new Set())
    return Response.json({ playlistId: PLAYLIST_ID, videos }, { headers: { 'Cache-Control': 'public, max-age=300, s-maxage=600, stale-while-revalidate=86400' } })
  } catch (error) { console.error('Playlist fetch failed', error instanceof Error ? error.message : 'Unknown error'); return Response.json({ error: 'Unable to load playlist' }, { status: 502 }) }
}
export const config = { path: '/api/youtube-playlist', method: 'GET' }
