import { flatTree, mapTree } from '@/helpers'
import { resolveRef } from '@/helpers/offlineCache'
import { useSheetBaseDirectory } from '@/plugins/sheetBaseDirectory'
import { CustomSetlistEntry, Song, ViewMode } from '@/types'
import { computed, nextTick, onScopeDispose, Ref, ref, watch } from 'vue'

export type FileContent = {
  urls: string[]
  isPdf: boolean
  dataUrl: string
  name: string
  pageCount?: number
  /** which pdf this was resolved from, when it was resolved for one */
  sheet?: SheetKind
}

/** the two pdfs a song can have: its chord sheet and its drum sheet */
export type SheetKind = 'chords' | 'drums'

/** Offline copies resolve to object URLs, which stay alive until they are released. */
function revoke(contents: FileContent[]) {
  for (const file of contents)
    for (const url of [file.dataUrl, ...file.urls]) if (url.startsWith('blob:')) URL.revokeObjectURL(url)
}

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
    if ('title' in song) return '' // a custom setlist entry has no files of its own
    const resolve = (ref: string) => resolveRef(ref, song.hashes?.[ref])
    const resolveAll = (refs: string[]) => Promise.all(refs.map(resolve))

    if (sheetMode.value == 'chords') {
      if (song.pdfImageStorageRefs?.length) return await resolveAll(song.pdfImageStorageRefs)
      if (song.pdfStorageRef) return await resolve(song.pdfStorageRef)
    }

    if (sheetMode.value == 'drums') {
      if (song.drumsPdfImageStorageRefs?.length) return await resolveAll(song.drumsPdfImageStorageRefs)
      if (song.drumsPdfStorageRef) return await resolve(song.drumsPdfStorageRef)
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
      const sheet = sheetMode.value == 'chords' || sheetMode.value == 'drums' ? sheetMode.value : undefined
      const stale = fileContents.value
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
            // of the same pdf, but not onto the other one: a drum sheet has its own pages
            pageCount: urls.length || (previous?.sheet == sheet && previous?.pageCount) || 1,
            sheet,
          }
        })
      )
      // the rendered page still points at the old urls until it has re-rendered
      nextTick(() => revoke(stale))
    },
    { immediate: true, deep: true }
  )

  onScopeDispose(() => revoke(fileContents.value))

  /**
   * How many pages a song's chord or drum sheet has, whichever of the two is resolved at
   * the moment: page images say so from the song alone, a pdf only once it is the one
   * resolved and the renderer has loaded it.
   */
  function sheetPageCount(index: number, kind: SheetKind) {
    const song = songs.value[index]
    if (!song || 'title' in song) return 1
    const images = kind == 'drums' ? song.drumsPdfImageStorageRefs : song.pdfImageStorageRefs
    if (images?.length) return images.length
    const file = fileContents.value[index]
    return (file?.sheet == kind && file.pageCount) || 1
  }

  return { fileContents, sheetSources, sheetPageCount }
}
