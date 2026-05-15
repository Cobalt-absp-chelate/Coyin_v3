/**
 * Simple Markdown → HTML for AI chat messages.
 * Escapes HTML first, then applies a safe subset of Markdown transforms.
 */

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export function renderMarkdown(md: string): string {
  // Preserve code blocks first to avoid processing their content
  const codeBlocks: string[] = []
  let html = md.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    const idx = codeBlocks.length
    const langAttr = lang ? ` data-lang="${escapeHtml(lang)}"` : ''
    codeBlocks.push(`<pre${langAttr}><code>${escapeHtml(code.trimEnd())}</code></pre>`)
    return `\x00CODEBLOCK${idx}\x00`
  })

  // Escape remaining HTML
  html = escapeHtml(html)

  // Headings (must come before bold to avoid # in **)
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>')
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>')
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>')

  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')

  // Italic (single *, not **)
  html = html.replace(/(?<!\*)\*([^*\n]+?)\*(?!\*)/g, '<em>$1</em>')

  // Inline code
  html = html.replace(/`([^`\n]+?)`/g, '<code>$1</code>')

  // Unordered list items
  html = html.replace(/^[-*] (.+)$/gm, '<li>$1</li>')
  // Wrap consecutive <li> in <ul>
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>')

  // Horizontal rules
  html = html.replace(/^---$/gm, '<hr/>')

  // Paragraphs: double newlines
  html = html.replace(/\n\n+/g, '</p><p>')
  // Single newlines
  html = html.replace(/\n/g, '<br/>')

  // Restore code blocks
  html = html.replace(/\x00CODEBLOCK(\d+)\x00/g, (_, idx) => codeBlocks[Number(idx)] ?? '')

  return '<p>' + html + '</p>'
}
