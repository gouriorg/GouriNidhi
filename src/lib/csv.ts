/** Escape a single CSV field: quote when it contains a comma, quote or newline. */
export function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  const text = String(value)
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(escapeCsvValue).join(',')]
  for (const row of rows) {
    lines.push(row.map(escapeCsvValue).join(','))
  }
  return lines.join('\r\n')
}

function clickDownload(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

/** Trigger a browser download of text content. */
export function downloadTextFile(filename: string, content: string, mime = 'text/csv') {
  // BOM so Excel opens ₹ and Indian names correctly.
  clickDownload(filename, new Blob([`\uFEFF${content}`], { type: `${mime};charset=utf-8` }))
}

export function downloadBytes(filename: string, bytes: Uint8Array, mime: string) {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  clickDownload(filename, new Blob([copy], { type: mime }))
}
