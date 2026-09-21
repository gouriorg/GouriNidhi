const MAX_EDGE = 384
const JPEG_QUALITY = 0.82

/** Shrink a photo so it can live in settings JSON. */
export async function imageFileToJpegDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Choose a photo (JPEG, PNG or WebP).')
  }
  if (file.size > 8 * 1024 * 1024) {
    throw new Error('Choose a photo smaller than 8 MB.')
  }

  const bitmap = await blobToImage(file)
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not read this photo.')
  context.drawImage(bitmap, 0, 0, width, height)

  const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY)
  if (!dataUrl.startsWith('data:image/jpeg')) {
    throw new Error('Could not save this photo.')
  }
  return dataUrl
}

function blobToImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not open this photo.'))
    }
    image.src = url
  })
}

/** First and last initials: "Prasad Nidode" → PN. Used when no photo is saved. */
export function initialsFromName(name: string): string {
  const parts = name
    .replace(/[[\]]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}
