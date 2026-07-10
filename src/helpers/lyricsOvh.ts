// Plain-lyrics fallback when Ultimate Guitar has nothing. Genius/LyricFind/
// lyricsondemand are Cloudflare-walled even through the jina reader proxy;
// lyrics.ovh is a free CORS-enabled API (Deezer-backed search + lyrics DB).
export type OvhResult = { title: string; artist: string; duration?: number };

export async function searchLyricsOvh(query: string): Promise<OvhResult[]> {
    const res = await fetch('https://api.lyrics.ovh/suggest/' + encodeURIComponent(query));
    if (!res.ok) return [];
    const data: { data?: { title: string; duration?: number; artist: { name: string } }[] } = await res.json();
    const seen = new Set<string>();
    return (data.data ?? [])
        .filter((d) => {
            const key = `${d.artist.name}|${d.title}`.toLowerCase();
            return seen.has(key) ? false : (seen.add(key), true);
        })
        .slice(0, 10)
        .map((d) => ({ title: d.title, artist: d.artist.name, duration: d.duration }));
}

export async function fetchLyricsOvh(artist: string, title: string): Promise<string> {
    const res = await fetch(`https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`);
    if (!res.ok) throw new Error(`No lyrics found (${res.status})`);
    const lyrics = ((await res.json()).lyrics || '').replace(/\r/g, '').trim();
    if (!lyrics) throw new Error('No lyrics found');
    return lyrics;
}
