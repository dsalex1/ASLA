export const chordRegex = /^[A-H][b#]?(m|min|maj|M|dim|aug)?(sus|sus2|sus4)?([0-9]{1,2})?([b#][0-9])?((\+|-))?(\/[A-H][b#]?)?$/;

export function isChordToken(token: string): boolean {
    return chordRegex.test(token);
}

export function isChordLine(line: string): boolean {
    if (!line.trim()) return false;

    // Remove markers that are irrelevant to classifying the line as chords or lyrics
    let cleanedLine = line
        .replace(/\[.*?\]/g, '') // Remove section markers like [Intro] or [Chorus]
        .replace(/\|/g, '')      // Remove bar lines
        .replace(/x\d+/gi, '')   // Remove multipliers like x4
        .trim();

    if (!cleanedLine) {
        // If the line was entirely section markers or bar lines, it's not a chord line (e.g., "[Verse 1]").
        return false;
    }

    const tokens = cleanedLine.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return false;

    let chordCount = 0;
    for (const token of tokens) {
        if (isChordToken(token)) {
            chordCount++;
        }
    }

    // If a line is mostly chords, classify it as a chord line.
    return chordCount / tokens.length >= 0.6;
}

export function lyricsHasChords(lyrics?: string) {
    if (!lyrics) return 0;
    const lines = lyrics.split('\n');
    return lines.filter(isChordLine).length >= 5;
}

export function parseLyricsLine(line: string) {
    const isChord = isChordLine(line);
    return {
        original: line,
        isChord,
        // When we want to trim lyrics lines as requested
        lyricsTrimmed: isChord ? '' : line.trim(),
    };
}

export function tokenizeChordLine(line: string) {
    const parts = line.split(/(\s+|\||\[|\])/);
    return parts.map(part => {
        if (!part) return { text: '', isChord: false };
        if (part.trim() === '') return { text: part, isChord: false };
        return { text: part, isChord: isChordToken(part) };
    });
}
