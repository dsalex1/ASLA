import { PDFArray, PDFDict, PDFDocument, PDFName, PDFNumber, PDFRef, PDFString } from 'pdf-lib'

// A drawn stroke, in PDF user-space coordinates (origin bottom-left, y up).
export type Stroke = {
  gray: number // 0 = black … 1 = white
  width: number // line width in PDF units
  points: { x: number; y: number }[]
}

export type PageAnnotations = {
  width: number // page width in PDF units
  height: number
  strokes: Stroke[]
}

// One edit operation, for undo/redo
export type StrokeOp = {
  type: 'add' | 'erase'
  pageIndex: number
  index: number // position in the page's strokes array
  stroke: Stroke
}

const NM_PREFIX = 'asla-ink-'

function annotDicts(doc: PDFDocument, pageIndex: number): { dict: PDFDict; ref: PDFRef | PDFDict }[] {
  const page = doc.getPage(pageIndex)
  const annots = page.node.Annots()
  if (!annots) return []
  const out: { dict: PDFDict; ref: PDFRef | PDFDict }[] = []
  for (let i = 0; i < annots.size(); i++) {
    const raw = annots.get(i)
    const dict = raw instanceof PDFRef ? doc.context.lookup(raw, PDFDict) : (raw as PDFDict)
    if (dict instanceof PDFDict) out.push({ dict, ref: raw as PDFRef | PDFDict })
  }
  return out
}

function isOurs(dict: PDFDict): boolean {
  const subtype = dict.get(PDFName.of('Subtype'))
  if (subtype !== PDFName.of('Ink')) return false
  const nm = dict.get(PDFName.of('NM'))
  return nm instanceof PDFString && nm.decodeText().startsWith(NM_PREFIX)
}

/** Extract our ink strokes (and page sizes) from a PDF. */
export async function readAnnotations(pdfBytes: ArrayBuffer | Uint8Array): Promise<PageAnnotations[]> {
  const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true })
  return doc.getPages().map((page, pageIndex) => {
    const { width, height } = page.getSize()
    const strokes: Stroke[] = []
    for (const { dict } of annotDicts(doc, pageIndex)) {
      if (!isOurs(dict)) continue
      const inkList = dict.lookup(PDFName.of('InkList'), PDFArray)
      const colors = dict.lookup(PDFName.of('C'), PDFArray)
      const bs = dict.lookup(PDFName.of('BS'), PDFDict)
      const w = bs?.lookup(PDFName.of('W'), PDFNumber)?.asNumber() ?? 2
      const gray = (colors?.get(0) as PDFNumber | undefined)?.asNumber() ?? 0
      const flat = doc.context.lookup(inkList.get(0), PDFArray)
      const points: Stroke['points'] = []
      for (let i = 0; i + 1 < flat.size(); i += 2) {
        points.push({
          x: (flat.get(i) as PDFNumber).asNumber(),
          y: (flat.get(i + 1) as PDFNumber).asNumber(),
        })
      }
      strokes.push({ gray, width: w, points })
    }
    return { width, height, strokes }
  })
}

const fmt = (n: number) => Math.round(n * 100) / 100

/** Replace our ink annotations in the PDF with the given strokes; returns new PDF bytes. */
export async function writeAnnotations(
  pdfBytes: ArrayBuffer | Uint8Array,
  strokesPerPage: Stroke[][]
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true })
  const context = doc.context

  doc.getPages().forEach((page, pageIndex) => {
    // keep foreign annotations, drop ours
    const kept = annotDicts(doc, pageIndex)
      .filter(({ dict }) => !isOurs(dict))
      .map(({ ref }) => ref)

    for (const stroke of strokesPerPage[pageIndex] ?? []) {
      if (stroke.points.length < 2) continue
      const xs = stroke.points.map((p) => p.x)
      const ys = stroke.points.map((p) => p.y)
      const pad = stroke.width / 2 + 1
      const rect = [
        fmt(Math.min(...xs) - pad),
        fmt(Math.min(...ys) - pad),
        fmt(Math.max(...xs) + pad),
        fmt(Math.max(...ys) + pad),
      ]

      // appearance stream so every viewer (incl. pdf.js canvas render) shows the stroke
      const ops = [
        `${fmt(stroke.gray)} G`,
        `${fmt(stroke.width)} w`,
        '1 J',
        '1 j',
        ...stroke.points.map((p, i) => `${fmt(p.x)} ${fmt(p.y)} ${i === 0 ? 'm' : 'l'}`),
        'S',
      ].join('\n')
      const apRef = context.register(
        context.stream(ops, {
          Type: 'XObject',
          Subtype: 'Form',
          BBox: rect,
          Resources: {},
        })
      )

      const annot = context.obj({
        Type: 'Annot',
        Subtype: 'Ink',
        Rect: rect,
        InkList: [stroke.points.flatMap((p) => [fmt(p.x), fmt(p.y)])],
        C: [fmt(stroke.gray)],
        BS: { W: fmt(stroke.width), S: 'S' },
        F: 4, // print
        NM: PDFString.of(`${NM_PREFIX}${crypto.randomUUID()}`),
        AP: { N: apRef },
      })
      kept.push(context.register(annot))
    }

    page.node.set(PDFName.of('Annots'), context.obj(kept))
  })

  return doc.save()
}
