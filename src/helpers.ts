import { Song } from './types'

export type Prettify<T> = {
  [K in keyof T]: T[K]
} & {}

export type Treelike<T> = (T & { children?: Treelike<T> })[]

export const filterTree = <Tree extends { children?: Tree[] }>(
  tree: Tree[],
  fn: (e: Omit<Tree, 'children'>) => boolean
): Tree[] => {
  return tree
    .map((e) => {
      if (e.children) {
        const children = filterTree(e.children, fn)
        return children.length > 0 ? { ...e, children } : null
      }
      return fn(e) ? e : null
    })
    .filter((e) => e)
    .map((c) => c!)
}

export const mapTree = <Tree extends { children?: Tree[] }, MappedType>(
  tree: Tree[],
  fn: (e: Omit<Tree, 'children'>) => MappedType
): Treelike<MappedType> => {
  return tree.map((e) => ({ ...fn(e), children: e.children ? mapTree(e.children, fn) : undefined }))
}

export const flatTree = <Tree extends { children?: Tree[] }>(tree: Tree[]): Prettify<Omit<Tree, 'children'>>[] => {
  return tree.reduce((acc, e) => {
    if (e.children) acc.push(...flatTree(e.children))
    acc.push(e)
    return acc
  }, [] as Omit<Tree, 'children'>[])
}

export const getSongInformation = (song: Song) =>
  [
    song?.key_signature,
    song?.bpm && `${song?.bpm} bpm`,
    song?.ibi_instrument && `Ibi ${song?.ibi_instrument}`,
    song.nadine_moderation && '💬',
  ]
    .filter(Boolean)
    .join(' - ')
