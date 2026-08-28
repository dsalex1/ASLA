// Seeds the local Firebase emulators (npm run emulators) with a test user and songs.
// Safe by construction: demo- project id + explicit emulator hosts, never touches prod.
import { initializeApp } from 'firebase/app'
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth } from 'firebase/auth'
import { connectFirestoreEmulator, doc, getFirestore, setDoc } from 'firebase/firestore'
import { connectStorageEmulator, getStorage, ref, uploadBytes } from 'firebase/storage'
import { createHash } from 'node:crypto'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

const app = initializeApp({
  apiKey: 'fake-api-key',
  projectId: 'demo-asla',
  storageBucket: 'demo-asla.appspot.com',
})
const auth = getAuth(app)
const db = getFirestore(app)
const storage = getStorage(app)
connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
connectFirestoreEmulator(db, '127.0.0.1', 8080)
connectStorageEmulator(storage, '127.0.0.1', 9199)

async function makePdf(title, pages) {
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.HelveticaBold)
  for (let p = 1; p <= pages; p++) {
    const page = pdf.addPage([595, 842]) // A4 portrait
    page.drawText(`${title} — page ${p}/${pages}`, { x: 50, y: 780, size: 24, font })
    // fake staff lines
    for (let staff = 0; staff < 8; staff++)
      for (let line = 0; line < 5; line++) {
        const y = 700 - staff * 80 - line * 10
        page.drawLine({ start: { x: 50, y }, end: { x: 545, y }, thickness: 0.8, color: rgb(0.2, 0.2, 0.2) })
      }
  }
  return pdf.save()
}

/**
 * A 60 s mono tone whose level rises and falls, so the waveform has a shape to look at
 * and the loud stretch is close enough to full scale for a boost to hit the limiter.
 * WAV rather than mp3: nothing here can encode one, and decodeAudioData takes both.
 */
function makeWav(seconds = 60, rate = 44100) {
  const samples = seconds * rate
  const data = Buffer.alloc(samples * 2)
  for (let i = 0; i < samples; i++) {
    const t = i / rate
    // four bars of swell per 8 s, with a quiet verse and a loud chorus over the minute
    const envelope = (0.35 + 0.6 * Math.abs(Math.sin((Math.PI * t) / 8))) * (t % 30 < 15 ? 0.45 : 0.95)
    const tone = Math.sin(2 * Math.PI * 220 * t) * 0.7 + Math.sin(2 * Math.PI * 331 * t) * 0.3
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, tone * envelope)) * 32767), i * 2)
  }
  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + data.length, 4)
  header.write('WAVEfmt ', 8)
  header.writeUInt32LE(16, 16) // fmt chunk size
  header.writeUInt16LE(1, 20) // PCM
  header.writeUInt16LE(1, 22) // mono
  header.writeUInt32LE(rate, 24)
  header.writeUInt32LE(rate * 2, 28) // byte rate
  header.writeUInt16LE(2, 32) // block align
  header.writeUInt16LE(16, 34) // bits per sample
  header.write('data', 36)
  header.writeUInt32LE(data.length, 40)
  return { bytes: Buffer.concat([header, data]), samples, rate, seconds }
}

/** the same one-byte-per-10-ms format computePeaks writes on upload */
function makePeaks({ bytes, samples, rate }, perSecond = 100) {
  const perBucket = Math.round(rate / perSecond)
  const peaks = new Uint8Array(Math.ceil(samples / perBucket))
  for (let bucket = 0; bucket < peaks.length; bucket++) {
    let peak = 0
    for (let i = bucket * perBucket; i < Math.min((bucket + 1) * perBucket, samples); i++)
      peak = Math.max(peak, Math.abs(bytes.readInt16LE(44 + i * 2)) / 32768)
    peaks[bucket] = Math.min(255, Math.round(peak * 255))
  }
  return peaks
}

try {
  await createUserWithEmailAndPassword(auth, 'user@user.com', 'useruser')
  console.log('created user user@user.com / useruser')
} catch (e) {
  if (e.code !== 'auth/email-already-in-use') throw e
  console.log('user user@user.com already exists')
}

/** matches src/helpers/contentHash.ts, so seeded songs key the offline cache like uploaded ones */
const hashes = {}
async function upload(path, bytes, contentType) {
  await uploadBytes(ref(storage, path), bytes, { contentType })
  hashes[path] = createHash('sha256').update(bytes).digest('hex').slice(0, 16)
}

const sheetPdf = await makePdf('Test Song Sheet', 3)
const drumsPdf = await makePdf('Test Song Drums', 2)
await upload('test-song.pdf', sheetPdf, 'application/pdf')
await upload('drums/test-song-drums.pdf', drumsPdf, 'application/pdf')

const wav = makeWav()
await upload('audio/test-song.wav', wav.bytes, 'audio/wav')
await upload('audio/test-song.peaks', makePeaks(wav), 'application/octet-stream')

await setDoc(doc(db, 'songs', 'test-song'), {
  filename: 'test-song.pdf',
  name: 'Test Song',
  pdfStorageRef: 'test-song.pdf',
  drumsPdfStorageRef: 'drums/test-song-drums.pdf',
  bpm: 120,
  duration: 180,
  lyrics: 'La la la\nTest lyrics line 2',
  audioTracks: [
    {
      name: 'test-song',
      storageRef: 'audio/test-song.wav',
      peaksRef: 'audio/test-song.peaks',
      duration: wav.seconds,
      markers: [12, 30],
    },
  ],
  hashes,
})

// No lyrics: exercises the "Import from Ultimate Guitar" button in SongEdit.
await setDoc(doc(db, 'songs', 'wonderwall'), {
  filename: 'wonderwall',
  name: 'Wonderwall',
})

const chordLyrics = [
  '[Verse 1]',
  'C        G        Am       F',
  'La la la, singing all day long',
  'C        G/B      F        C',
  'Test lyrics with some chords',
  '',
  '[Chorus]',
  'F    G    Em7   Am   D/F#',
  'Everybody sing along now',
  'Bb   F    C',
  'One more time',
  '',
  '[Bridge]',
  'Dm   Am   Bb   F',
  'Take it down real low',
  'Dm   Am   Gsus4 G',
  'Then bring it back again',
  '',
  '[Outro]',
  'A7sus4   Dm7sus4add11/C   C6/9     Fmaj7#11',
  'Fancy chords everywhere you look',
  'Cm(maj7) E7#9   Bm7b5/D   G7(b9)',
  'Even the jazzy ones work fine',
].join('\n')

await setDoc(doc(db, 'songs', 'chords-song'), {
  filename: '',
  name: 'Chords Song',
  bpm: 90,
  duration: 200,
  lyrics: chordLyrics,
})

await setDoc(doc(db, 'setlist', 'test-setlist'), {
  name: 'Test Setlist',
  songs: ['test-song', 'chords-song'],
  updatedAt: new Date().toISOString(),
})

console.log('seeded songs "Test Song" (3-page sheet, 2-page drums, 60 s audio track), "Chords Song" (chord lyrics) and setlist "Test Setlist"')
process.exit(0)
