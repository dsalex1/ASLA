import * as pdfjsLib from 'pdfjs-dist'

export async function generateWebPImagesFromPdf(pdfFile: File | Blob | ArrayBuffer): Promise<Blob[]> {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`

    let data: Uint8Array
    if (pdfFile instanceof Blob) {
        const arrayBuffer = await pdfFile.arrayBuffer()
        data = new Uint8Array(arrayBuffer)
    } else if (pdfFile instanceof ArrayBuffer) {
        data = new Uint8Array(pdfFile)
    } else {
        data = pdfFile as any
    }

    const loadingTask = pdfjsLib.getDocument({ data })
    const pdfDocument = await loadingTask.promise

    const blobs: Blob[] = []

    // Set a good resolution for mobile/tablets
    const TARGET_WIDTH = 1500

    for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
        const page = await pdfDocument.getPage(pageNum)

        // Calculate scale to hit target width
        const unscaledViewport = page.getViewport({ scale: 1.0 })
        const scale = TARGET_WIDTH / unscaledViewport.width
        const viewport = page.getViewport({ scale })

        const canvas = document.createElement('canvas')
        const context = canvas.getContext('2d')!
        canvas.width = viewport.width
        canvas.height = viewport.height

        const renderContext = {
            canvasContext: context,
            viewport: viewport
        }

        await page.render(renderContext).promise

        const blob = await new Promise<Blob | null>((resolve) => {
            canvas.toBlob((b) => resolve(b), 'image/webp', 0.5)
        })

        if (blob) {
            blobs.push(blob)
        }
    }

    return blobs
}
