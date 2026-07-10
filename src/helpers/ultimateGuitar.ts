import { Song } from '@/types';

// Scrapes ultimate-guitar.com via the r.jina.ai reader proxy, which bypasses
// Cloudflare and sends CORS headers (plain CORS proxies get challenge pages).
const JINA = 'https://r.jina.ai/';

export type UgSearchResult = { title: string; artist: string; url: string; votes?: number };
export type UgSearch = { results: UgSearchResult[]; duration?: number };
export type UgTab = { lyrics: string; bpm?: number; key_signature?: Song['key_signature'] };

async function fetchMarkdown(url: string): Promise<string> {
    const res = await fetch(JINA + url);
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    return await res.text();
}

export async function searchUltimateGuitar(query: string): Promise<UgSearch> {
    const md = await fetchMarkdown(
        `https://www.ultimate-guitar.com/search.php?title=${encodeURIComponent(query)}&type=300`
    );
    const results: UgSearchResult[] = [];
    let artist = '';
    const linkRe = /\[([^\]]+)\]\((https?:\/\/(?:www\.ultimate-guitar\.com\/artist\/|tabs\.ultimate-guitar\.com\/tab\/)[^)\s]+)\)/g;
    for (const match of md.matchAll(linkRe)) {
        const [full, text, url] = match;
        const clean = text.replace(/\*\*/g, '').trim();
        if (url.includes('/artist/')) {
            artist = clean;
        } else if (/(?:-chords-|\/tab\/)\d+$/.test(url)) {
            // matches both slug URLs (…/junge-chords-4585979) and the bare
            // numeric ones UG uses for some tabs (…/tab/751634)
            // vote count follows the link, e.g. ")*\n\n10,793\n\nChords"
            const votes = md.slice(match.index! + full.length, match.index! + full.length + 40).match(/([\d,]+)\s+Chords/);
            results.push({ title: clean, artist, url, votes: votes ? parseInt(votes[1].replace(/,/g, '')) : undefined });
        }
    }
    // track length shown next to the official version, e.g. ")4:08"
    const duration = md.match(/\)(\d{1,2}):(\d{2})\b/);
    return {
        results,
        duration: duration ? parseInt(duration[1]) * 60 + parseInt(duration[2]) : undefined,
    };
}

export async function fetchUltimateGuitarTab(url: string): Promise<UgTab> {
    const md = await fetchMarkdown(url);
    // the tab body is the largest fenced code block of the reader output
    const blocks = [...md.matchAll(/```\r?\n([\s\S]*?)```/g)].map((m) => m[1]);
    const block = blocks.length ? blocks.reduce((a, b) => (b.length > a.length ? b : a)) : '';
    const bpm = md.match(/(\d{2,3})\s*bpm/i);
    const key = md.match(/Key[:\s]+([A-G][b#]?m?)\b/);
    return {
        // trailing "X": the reader renders UG's chord-diagram close button into the code block
        lyrics: block.replace(/\r/g, '').replace(/[ \t]+$/gm, '').trim().replace(/\nX$/, ''),
        bpm: bpm ? parseInt(bpm[1]) : undefined,
        key_signature: key ? (key[1] as Song['key_signature']) : undefined,
    };
}
