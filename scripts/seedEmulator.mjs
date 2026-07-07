// Seeds the local Firebase emulators (npm run emulators) with a test user and songs.
// Safe by construction: demo- project id + explicit emulator hosts, never touches prod.
import { initializeApp } from 'firebase/app'
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth } from 'firebase/auth'
import { connectFirestoreEmulator, doc, getFirestore, setDoc } from 'firebase/firestore'
import { connectStorageEmulator, getStorage, ref, uploadBytes } from 'firebase/storage'
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

try {
  await createUserWithEmailAndPassword(auth, 'test@test.de', 'test1234')
  console.log('created user test@test.de / test1234')
} catch (e) {
  if (e.code !== 'auth/email-already-in-use') throw e
  console.log('user test@test.de already exists')
}

const sheetPdf = await makePdf('Test Song Sheet', 3)
const drumsPdf = await makePdf('Test Song Drums', 2)
await uploadBytes(ref(storage, 'test-song.pdf'), sheetPdf, { contentType: 'application/pdf' })
await uploadBytes(ref(storage, 'drums/test-song-drums.pdf'), drumsPdf, { contentType: 'application/pdf' })

await setDoc(doc(db, 'songs', 'test-song'), {
  filename: 'test-song.pdf',
  name: 'Test Song',
  pdfStorageRef: 'test-song.pdf',
  drumsPdfStorageRef: 'drums/test-song-drums.pdf',
  bpm: 120,
  duration: 180,
  lyrics: 'La la la\nTest lyrics line 2',
})

await setDoc(doc(db, 'setlist', 'test-setlist'), {
  name: 'Test Setlist',
  songs: ['test-song'],
  updatedAt: new Date().toISOString(),
})

console.log('seeded song "Test Song" (3-page sheet, 2-page drums) and setlist "Test Setlist"')
process.exit(0)
