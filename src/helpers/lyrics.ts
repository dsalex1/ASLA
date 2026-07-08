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

const NOTE_VALUES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11, H: 11 };
const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

function transposeNote(note: string, semitones: number): string {
    const value = NOTE_VALUES[note[0]] + (note[1] === '#' ? 1 : note[1] === 'b' ? -1 : 0);
    const names = semitones < 0 ? FLAT_NAMES : SHARP_NAMES;
    return names[(((value + semitones) % 12) + 12) % 12];
}

export function transposeChord(chord: string, semitones: number): string {
    if (!semitones) return chord;
    const match = chord.match(/^([A-H][b#]?)([^/]*)(?:\/([A-H][b#]?))?$/);
    if (!match) return chord;
    const [, root, quality, bass] = match;
    return transposeNote(root, semitones) + quality + (bass ? '/' + transposeNote(bass, semitones) : '');
}

// Transpose chord tokens while shrinking/growing the following whitespace so
// later chords keep their column above the lyrics line.
export function transposeTokens(tokens: ReturnType<typeof tokenizeChordLine>, semitones: number) {
    if (!semitones) return tokens;
    let drift = 0; // chars emitted so far minus original chars
    return tokens.map(token => {
        if (token.isChord) {
            const text = transposeChord(token.text, semitones);
            drift += text.length - token.text.length;
            return { ...token, text };
        }
        if (drift !== 0 && /^ +$/.test(token.text)) {
            const length = Math.max(1, token.text.length - drift);
            drift -= token.text.length - length;
            return { ...token, text: ' '.repeat(length) };
        }
        return token;
    });
}

// Replace one token of a chord line, absorbing the length change into the
// following whitespace so later chords keep their column.
export function replaceChordInLine(line: string, tokenIdx: number, newText: string): string {
    const tokens = tokenizeChordLine(line);
    let drift = newText.length - tokens[tokenIdx].text.length;
    tokens[tokenIdx] = { text: newText, isChord: isChordToken(newText) };
    for (let i = tokenIdx + 1; i < tokens.length && drift !== 0; i++) {
        if (!/^ +$/.test(tokens[i].text)) continue;
        const length = Math.max(1, tokens[i].text.length - drift);
        drift -= tokens[i].text.length - length;
        tokens[i] = { text: ' '.repeat(length), isChord: false };
    }
    return tokens.map(t => t.text).join('');
}
