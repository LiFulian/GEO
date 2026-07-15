import { escapeHtml } from './helpers'

export function markdownToHtml(text: string): string {
  if (!text) return ''
  const lines = escapeHtml(text).split('\n')
  const html: string[] = []
  let listType: string | null = null
  let inQuote = false
  const closeList = () => { if (listType === 'ul') html.push('</ul>'); else if (listType === 'ol') html.push('</ol>'); listType = null }
  const closeQuote = () => { if (inQuote) { html.push('</blockquote>'); inQuote = false } }

  for (const line of lines) {
    let m
    if (m = line.match(/^### (.*)$/)) { closeList(); closeQuote(); html.push(`<h3>${m[1]}</h3>`); continue }
    if (m = line.match(/^## (.*)$/)) { closeList(); closeQuote(); html.push(`<h2>${m[1]}</h2>`); continue }
    if (m = line.match(/^# (.*)$/)) { closeList(); closeQuote(); html.push(`<h1>${m[1]}</h1>`); continue }
    if (m = line.match(/^\d+\.\s+(.*)$/)) { closeQuote(); if (listType !== 'ol') { closeList(); html.push('<ol>'); listType = 'ol' } html.push(`<li>${m[1]}</li>`); continue }
    if (m = line.match(/^[-*] (.*)$/)) { closeQuote(); if (listType !== 'ul') { closeList(); html.push('<ul>'); listType = 'ul' } html.push(`<li>${m[1]}</li>`); continue }
    closeList()
    if (m = line.match(/^&gt; (.*)$/)) { if (!inQuote) { html.push('<blockquote>'); inQuote = true } html.push(m[1]); continue }
    closeQuote()
    if (!line.trim()) { html.push(''); continue }
    html.push(line)
  }
  closeList()
  closeQuote()
  return html.join('\n')
    .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, alt, url) =>
      /^https?:\/\//i.test(url) ? `<img src="${url}" alt="${alt}" loading="lazy" />` : (alt || ''))
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, txt, url) =>
      /^(https?:|mailto:)/i.test(url) ? `<a href="${url}" target="_blank" rel="noopener noreferrer">${txt}</a>` : txt)
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>')
}
