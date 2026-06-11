/**
 * Trigger a browser download for a cached firmware artifact URL.
 * @param downloadUrl Server artifact download URL.
 * @param filename Suggested download filename.
 */
export function downloadFirmwareArtifact(downloadUrl: string, filename: string): void {
  const anchor = document.createElement('a')
  anchor.href = downloadUrl
  anchor.download = filename
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
}
