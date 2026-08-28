import { FileContent } from '@/composables/useFileContents'
import { PageAnnotations, readAnnotations, StrokeOp, writeAnnotations } from '@/helpers/inkAnnotations'
import { CustomSetlistEntry, Song, ViewMode } from '@/types'
import { useEventListener } from '@vueuse/core'
import { uploadHashed } from '@/helpers/contentHash'
import { recache, resolveBytes } from '@/helpers/offlineCache'
import { songCollection } from '@/plugins/firebase'
import { doc, updateDoc } from 'firebase/firestore'
import { ref as firebaseRef, getStorage } from 'firebase/storage'
import { computed, Ref, ref } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'

export type AnnotationState = {
  bytes: Uint8Array
  pages: PageAnnotations[]
  refPath: string
  fileIndex: number
  dirty: boolean
  saving: boolean
  undoStack: StrokeOp[]
  redoStack: StrokeOp[]
}

export function useAnnotations(opts: {
  songs: Ref<(Song | CustomSetlistEntry)[]>
  mode: Ref<ViewMode | undefined>
  fileContents: Ref<FileContent[]>
  fileIndex: Ref<number>
  page: Ref<number>
}) {
  const { songs, mode, fileContents, fileIndex, page } = opts

  const annot = ref<AnnotationState | null>(null)
  const loading = ref(false)

  /** storage path of the pdf the current mode annotates, '' when there is nothing to annotate */
  const refPath = computed(() => {
    const song = songs.value[fileIndex.value]
    if (!song || !('pdfStorageRef' in song)) return ''
    if (mode.value == 'drums') return song.drumsPdfStorageRef || ''
    if (mode.value == 'chords') return song.pdfStorageRef || ''
    return ''
  })

  async function start() {
    if (loading.value || annot.value) return // guard double-clicks: a second run would discard drawn strokes
    loading.value = true
    try {
      const source = songs.value[fileIndex.value] as Song
      const bytes = new Uint8Array(await resolveBytes(refPath.value, source.hashes?.[refPath.value]))
      const pages = await readAnnotations(bytes)
      fileContents.value[fileIndex.value].pageCount = pages.length
      if (page.value > pages.length) page.value = 1
      annot.value = {
        bytes,
        pages,
        refPath: refPath.value,
        fileIndex: fileIndex.value,
        dirty: false,
        saving: false,
        undoStack: [],
        redoStack: [],
      }
    } catch (e) {
      console.error('Failed to load PDF for annotation:', e)
      alert('Failed to load PDF for annotation')
    } finally {
      loading.value = false
    }
  }

  const confirmDiscard = () => !annot.value?.dirty || confirm('Discard unsaved annotations?')

  function stop() {
    if (confirmDiscard()) annot.value = null
  }

  // guard every way out of drawing mode with unsaved changes: in-app navigation
  // (browser/hardware back included, vue-router intercepts it) and tab close/reload
  onBeforeRouteLeave(confirmDiscard)
  useEventListener(window, 'beforeunload', (e) => {
    if (annot.value?.dirty) e.preventDefault()
  })

  function onOp(op: StrokeOp) {
    const a = annot.value!
    a.undoStack.push(op)
    a.redoStack = []
    a.dirty = true
  }

  // apply an op forwards (redo) or backwards (undo)
  function applyOp(op: StrokeOp, reverse: boolean) {
    const strokes = annot.value!.pages[op.pageIndex].strokes
    if ((op.type === 'add') !== reverse) strokes.splice(op.index, 0, op.stroke)
    else strokes.splice(op.index, 1)
    page.value = op.pageIndex + 1 // show the affected page
    annot.value!.dirty = true
  }

  function undo() {
    const op = annot.value?.undoStack.pop()
    if (!op) return
    applyOp(op, true)
    annot.value!.redoStack.push(op)
  }

  function redo() {
    const op = annot.value?.redoStack.pop()
    if (!op) return
    applyOp(op, false)
    annot.value!.undoStack.push(op)
  }

  async function save() {
    const a = annot.value
    if (!a || a.saving) return
    a.saving = true
    try {
      const newBytes = await writeAnnotations(
        a.bytes,
        a.pages.map((p) => p.strokes)
      )
      const storage = getStorage()
      const song = songs.value[a.fileIndex] as Song
      const pdfBlob = new Blob([newBytes as BlobPart], { type: 'application/pdf' })
      const hashes: Record<string, string> = {
        [a.refPath]: await uploadHashed(firebaseRef(storage, a.refPath), newBytes, { contentType: 'application/pdf' }),
      }
      await recache(a.refPath, song.hashes?.[a.refPath], hashes[a.refPath], pdfBlob)

      // regenerate the cached page images so they include the annotations
      const imgRefs = mode.value == 'drums' ? song.drumsPdfImageStorageRefs : song.pdfImageStorageRefs
      let freshUrls: string[] | undefined
      if (imgRefs?.length) {
        const { generateWebPImagesFromPdf } = await import('@/helpers/pdfGenerator')
        const blobs = await generateWebPImagesFromPdf(newBytes.slice().buffer)
        await Promise.all(
          imgRefs.map(async (r, i) => {
            if (!blobs[i]) return
            hashes[r] = await uploadHashed(firebaseRef(storage, r), blobs[i], { contentType: 'image/webp' })
            await recache(r, song.hashes?.[r], hashes[r], blobs[i])
          })
        )
        freshUrls = blobs.map((b) => (b ? URL.createObjectURL(b) : ''))
      }
      // the paths are unchanged but their contents are not, and the offline copies key on the hash
      if (song.id) await updateDoc(doc(songCollection, song.id), { hashes: { ...song.hashes, ...hashes } })

      a.bytes = newBytes
      a.dirty = false
      // refresh the normal view with the annotated file, straight from the bytes just written
      const file = fileContents.value[a.fileIndex]
      if (file?.isPdf) file.dataUrl = URL.createObjectURL(pdfBlob)
      else if (freshUrls) file.urls = freshUrls.map((u, i) => u || file.urls[i])
    } catch (e) {
      console.error('Failed to save annotations:', e)
      alert('Failed to save annotations')
    } finally {
      a.saving = false
    }
  }

  return { annot, loading, refPath, start, stop, save, undo, redo, onOp }
}
