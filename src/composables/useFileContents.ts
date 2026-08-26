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

/**
 * Resolves each song to a renderable sheet (cached page images, the pdf itself, or a
 * local file). `sheetMode` says which pdf to resolve rather than which mode the app is
 * in: 'chords' for the sheet, 'drums' for the drum chart, anything else for neither.
 */
export function useFileContents(songs: Ref<(Song | CustomSetlistEntry)[]>, sheetMode: Ref<ViewMode | undefined>) {
  const { pdfTree } = useSheetBaseDirectory()

  const localFiles = computed(() =>
    flatTree(mapTree(pdfTree.value, (f) => ({ ...f, handle: f.handle as FileSystemFileHandle })))
  )

  async function resolveFileUrl(song: Song | CustomSetlistEntry) {
    if (!('pdfStorageRef' in song)) return ''

    if (sheetMode.value == 'chords') {
      if (song.pdfImageStorageRefs?.length) return await downloadAll(song.pdfImageStorageRefs)
      if (song.pdfStorageRef) return await getDownloadURL(firebaseRef(getStorage(), song.pdfStorageRef))
    }

    if (sheetMode.value == 'drums') {
      if (song.drumsPdfImageStorageRefs?.length) return await downloadAll(song.drumsPdfImageStorageRefs)
      if (song.drumsPdfStorageRef) return await getDownloadURL(firebaseRef(getStorage(), song.drumsPdfStorageRef))
    }

    if (song.filename) {
      const localFile = localFiles.value.find((f) => f.name === song.filename)
      if (localFile?.handle) return URL.createObjectURL(await localFile.handle.getFile())
    }
    return ''
  }

  /**
   * Which sheets a song has at all, which is not the same question as which one is
   * resolved: the switches have to grey out a view before anything has been fetched for
   * it, and resolving is deliberately lazy.
   */
  const sheetSources = computed(() =>
    songs.value.map((song) => {
      if ('title' in song) return { sheet: false, drums: false }
      return {
        sheet: !!(
          song.pdfImageStorageRefs?.length ||
          song.pdfStorageRef ||
          (song.filename && localFiles.value.some((f) => f.name === song.filename))
        ),
        drums: !!(song.drumsPdfImageStorageRefs?.length || song.drumsPdfStorageRef),
      }
    })
  )

  const fileContents = ref<FileContent[]>([])

  watch(
    [songs, sheetMode],
    async () => {
      const showsSheets = sheetMode.value != 'lyrics' && sheetMode.value != 'audio'
      fileContents.value = await Promise.all(
        songs.value.map(async (song) => {
          const resolved = showsSheets ? await resolveFileUrl(song) : ''
          const urls = Array.isArray(resolved) ? resolved : []
          const name = 'name' in song && song.name ? song.name : 'title' in song ? song.title : 'untitled'
          const previous = fileContents.value?.find((f) => f.name === name)
          return {
            name,
            dataUrl: urls.length ? '' : (resolved as string),
            urls,
            isPdf: !urls.length,
            // page images say how many there are outright; a pdf only gives its count up
            // once the renderer has loaded it, so that answer is carried over a re-resolve
            pageCount: urls.length || previous?.pageCount || 1,
          }
        })
      )
    },
    { immediate: true, deep: true }
  )

  return { fileContents, sheetSources }
}
