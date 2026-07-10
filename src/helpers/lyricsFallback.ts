// Plain-lyrics fallback when Ultimate Guitar has nothing. Genius/LyricFind/
// lyricsondemand are Cloudflare-walled even through the jina reader proxy, and
// lyrics.ovh's lyrics DB misses many songs its search finds. lrclib.net is a
// free CORS API whose search results already include the plain lyrics, so an
// entry we list can always be imported.
export type LyricsFallbackResult = { title: string; artist: string; lyrics: string; duration?: number };

export async function searchLyricsFallback(query: string): Promise<LyricsFallbackResult[]> {
    const res = await fetch('https://lrclib.net/api/search?q=' + encodeURIComponent(query));
    if (!res.ok) return [];
    const data: { trackName: string; artistName: string; plainLyrics?: string; duration?: number }[] =
        await res.json();
    const seen = new Set<string>();
    return data
        .filter((d) => {
            if (!d.plainLyrics) return false;
            const key = `${d.artistName}|${d.trackName}`.toLowerCase();
            return seen.has(key) ? false : (seen.add(key), true);
        })
        .slice(0, 10)
        .map((d) => ({
            title: d.trackName,
            artist: d.artistName,
            lyrics: d.plainLyrics!.replace(/\r/g, '').trim(),
            duration: d.duration ? Math.round(d.duration) : undefined,
        }));
}
