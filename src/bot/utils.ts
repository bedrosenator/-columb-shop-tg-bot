/**
 * Escapes characters that are special in Telegram's HTML parse mode.
 * The characters escaped are: &, <, >
 */
export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
