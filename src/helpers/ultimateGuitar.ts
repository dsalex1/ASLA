// Scrapes ultimate-guitar.com via the r.jina.ai reader proxy, which bypasses
// Cloudflare and sends CORS headers (plain CORS proxies get challenge pages).
const PROXY = 'https://r.jina.ai/'

export type UGVersion = {
  title: string
  artist: string
  url: string
  votes: number
}

async function fetchViaProxy(url: string): Promise<string> {
  const res = await fetch(PROXY + url)
  if (!res.ok) throw new Error(`Ultimate Guitar fetch failed: ${res.status}`)
  return res.text()
}

function titleCase(slug: string): string {
  return slug.replace(/-\d+$/, '').replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

// Search results render as: [**Title** suffix](https://tabs.ultimate-guitar.com/tab/artist/slug-id)  votes  type
export async function searchUltimateGuitar(name: string): Promise<UGVersion[]> {
  const md = await fetchViaProxy(
    `https://www.ultimate-guitar.com/search.php?search_type=title&value=${encodeURIComponent(name)}`
  )
  const versions: UGVersion[] = []
  const re =
    /\[\*\*(.+?)\*\*(.*?)\]\((https:\/\/tabs\.ultimate-guitar\.com\/tab\/([^/\s)]+)\/[^\s)]+)\)\*?\s+([\d,]+)\s+(\w+)/g
  for (const m of md.matchAll(re)) {
    if (m[6] !== 'Chords') continue
    versions.push({
      title: (m[1] + m[2]).trim(),
      artist: titleCase(m[4]),
      url: m[3],
      votes: parseInt(m[5].replace(/,/g, '')),
    })
  }
  return versions
}

// Tab pages render the chord sheet as the page's only fenced code block.
export async function fetchUltimateGuitarTab(url: string): Promise<string> {
  const md = await fetchViaProxy(url)
  const blocks = [...md.matchAll(/```\n([\s\S]*?)```/g)].map((m) => m[1])
  if (blocks.length === 0) throw new Error('No tab content found on page')
  return blocks.reduce((a, b) => (b.length > a.length ? b : a)).trim()
}
