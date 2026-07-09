import { Song } from '@/types';

// Ultimate Guitar has no CORS API, so pages are fetched through the
// r.jina.ai reader proxy, which returns them as markdown with CORS enabled.
const JINA = 'https://r.jina.ai/';

export type UgSearchResult = { title: string; artist: string; url: string };
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
    for (const [, text, url] of md.matchAll(linkRe)) {
        const clean = text.replace(/\*\*/g, '').trim();
        if (url.includes('/artist/')) artist = clean;
        else if (/-chords-\d+$/.test(url)) results.push({ title: clean, artist, url });
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
    // the tab body is the first fenced code block of the reader output
    const block = md.match(/```\r?\n([\s\S]*?)```/);
    const bpm = md.match(/(\d{2,3})\s*bpm/i);
    const key = md.match(/Key[:\s]+([A-G][b#]?m?)\b/);
    return {
        lyrics: block ? block[1].replace(/\r/g, '').replace(/[ \t]+$/gm, '').trim() : '',
        bpm: bpm ? parseInt(bpm[1]) : undefined,
        key_signature: key ? (key[1] as Song['key_signature']) : undefined,
    };
}
