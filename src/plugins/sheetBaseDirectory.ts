import { get, set } from 'idb-keyval'
import { onMounted, Ref, ref, watchEffect } from 'vue'

const baseDirectory = ref<FileSystemDirectoryHandle | undefined>(undefined)
const pdfTree = ref<FileEntry[]>([]) as Ref<{ name: string; handle: FileSystemHandle; children?: FileEntry[] }[]>

export function useSheetBaseDirectory() {
  onMounted(async () => {
    baseDirectory.value = await getSheetBaseDirectory()
  })

  watchEffect(async () => {
    if (baseDirectory.value) pdfTree.value = sortTree(await getPdfFileTree(baseDirectory.value))
  })

  return { baseDirectory, pdfTree, chooseNewSheetBaseDirectory }
}

async function getSheetBaseDirectory() {
  return (await get('SheetBaseDirectory')) as FileSystemDirectoryHandle | undefined
}

async function chooseNewSheetBaseDirectory(directoryHandle: FileSystemDirectoryHandle) {
  directoryHandle = await window.showDirectoryPicker()
  await set('SheetBaseDirectory', directoryHandle)
  baseDirectory.value = directoryHandle
}

type FileEntry = { name: string; handle: FileSystemHandle; children?: FileEntry[] }

async function getPdfFileTree(dirHandle: FileSystemDirectoryHandle) {
  const files = [] as FileEntry[]
  try {
    for await (let [name, handle] of dirHandle) {
      if (handle.kind === 'directory') {
        files.push({ name, handle, children: await getPdfFileTree(handle) })
      } else if (name.endsWith('.pdf')) {
        files.push({ name, handle })
      }
    }
  } catch (e) {
    console.warn('Error reading directory:', e)
  }
  return files
}

function sortTree(tree: FileEntry[]) {
  tree.sort((a, b) => {
    if (a.children && !b.children) return -1
    if (!a.children && b.children) return 1
    return a.name.localeCompare(b.name)
  })
  tree.forEach((entry) => entry.children && sortTree(entry.children))

  return tree
}
