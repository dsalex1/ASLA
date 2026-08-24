import { FileContent } from '@/composables/useFileContents'
import { PageAnnotations, readAnnotations, StrokeOp, writeAnnotations } from '@/helpers/inkAnnotations'
import { CustomSetlistEntry, Song, ViewMode } from '@/types'
import { ref as firebaseRef, getDownloadURL, getStorage, uploadBytes } from 'firebase/storage'
import { computed, Ref, ref } from 'vue'

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
      const url = await getDownloadURL(firebaseRef(getStorage(), refPath.value))
      const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer())
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

  function stop() {
    if (annot.value?.dirty && !confirm('Discard unsaved annotations?')) return
    annot.value = null
  }

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
      await uploadBytes(firebaseRef(storage, a.refPath), newBytes, { contentType: 'application/pdf' })

      // regenerate the cached page images so they include the annotations
      const song = songs.value[a.fileIndex] as Song
      const imgRefs = mode.value == 'drums' ? song.drumsPdfImageStorageRefs : song.pdfImageStorageRefs
      if (imgRefs?.length) {
        const { generateWebPImagesFromPdf } = await import('@/helpers/pdfGenerator')
        const blobs = await generateWebPImagesFromPdf(newBytes.slice().buffer)
        await Promise.all(
          imgRefs.map((r, i) =>
            blobs[i] ? uploadBytes(firebaseRef(storage, r), blobs[i], { contentType: 'image/webp' }) : undefined
          )
        )
      }

      a.bytes = newBytes
      a.dirty = false
      // refresh the normal view with the annotated file
      const file = fileContents.value[a.fileIndex]
      if (file?.isPdf) file.dataUrl = URL.createObjectURL(new Blob([newBytes as BlobPart], { type: 'application/pdf' }))
      else file.urls = file.urls.map((u) => u.split('&_bust=')[0] + '&_bust=' + Date.now())
    } catch (e) {
      console.error('Failed to save annotations:', e)
      alert('Failed to save annotations')
    } finally {
      a.saving = false
    }
  }

  return { annot, loading, refPath, start, stop, save, undo, redo, onOp }
}
