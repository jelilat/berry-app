/**
 * Copy plain text to the user's clipboard, falling back to a hidden textarea.
 * @param text Text content to place on the clipboard.
 * @throws Error when clipboard access is unavailable or the browser denies copying.
 */
export async function copyTextToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  textarea.style.top = '0'
  document.body.appendChild(textarea)
  textarea.select()

  try {
    const copied = document.execCommand('copy')
    if (!copied) {
      throw new Error('Copy command was rejected')
    }
  } finally {
    document.body.removeChild(textarea)
  }
}
