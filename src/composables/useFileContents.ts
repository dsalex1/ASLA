import { flatTree, mapTree } from '@/helpers'
import { useSheetBaseDirectory } from '@/plugins/sheetBaseDirectory'
import { CustomSetlistEntry, Song, ViewMode } from '@/types'
import { ref as firebaseRef, getDownloadURL, getStorage } from 'firebase/storage'
import { computed, Ref, ref, watch } from 'vue'

export type FileContent = {
  urls: string[]
  isPdf: boolean
  dataUrl: string
  name: string
  pageCount?: number
}

const downloadAll = (refs: string[]) => Promise.all(refs.map((r) => getDownloadURL(firebaseRef(getStorage(), r))))

/** Resolves each song to a renderable sheet (cached page images, the pdf itself, or a local file). */
export function useFileContents(songs: Ref<(Song | CustomSetlistEntry)[]>, mode: Ref<ViewMode | undefined>) {
  const { pdfTree } = useSheetBaseDirectory()

  const localFiles = computed(() =>
    flatTree(mapTree(pdfTree.value, (f) => ({ ...f, handle: f.handle as FileSystemFileHandle })))
  )

  async function resolveFileUrl(song: Song | CustomSetlistEntry) {
    if (!('pdfStorageRef' in song)) return ''

    if (mode.value == 'chords') {
      if (song.pdfImageStorageRefs?.length) return await downloadAll(song.pdfImageStorageRefs)
      if (song.pdfStorageRef) return await getDownloadURL(firebaseRef(getStorage(), song.pdfStorageRef))
    }

    if (mode.value == 'drums') {
      if (song.drumsPdfImageStorageRefs?.length) return await downloadAll(song.drumsPdfImageStorageRefs)
      if (song.drumsPdfStorageRef) return await getDownloadURL(firebaseRef(getStorage(), song.drumsPdfStorageRef))
    }

    if (song.filename) {
      const localFile = localFiles.value.find((f) => f.name === song.filename)
      if (localFile?.handle) return URL.createObjectURL(await localFile.handle.getFile())
    }
    return ''
  }

  const fileContents = ref<FileContent[]>([])

  watch(
    [songs, mode],
    async () => {
      const showsSheets = mode.value != 'lyrics' && mode.value != 'audio'
      fileContents.value = await Promise.all(
        songs.value.map(async (song) => {
          const resolved = showsSheets ? await resolveFileUrl(song) : ''
          const urls = Array.isArray(resolved) ? resolved : []
          return {
            pageCount: urls.length || 1,
            //if already loaded keep the page count discovered by the pdf renderer
            ...(fileContents.value?.find((f) => f.name === ('name' in song ? song.name : '')) ?? {}),
            name: 'name' in song && song.name ? song.name : 'title' in song ? song.title : 'untitled',
            dataUrl: urls.length ? '' : (resolved as string),
            urls,
            isPdf: !urls.length,
          }
        })
      )
    },
    { immediate: true, deep: true }
  )

  return { fileContents }
}
