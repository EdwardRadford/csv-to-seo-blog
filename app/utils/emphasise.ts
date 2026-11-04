// Splits copy into plain and bold parts so company names can be set in bold,
// as Beauhurst does in its key findings, without ever rendering HTML from the AI.
export function emphasise(text: string, names: string[]): { text: string; bold: boolean }[] {
  const known = names.filter((n) => n.length > 2).sort((a, b) => b.length - a.length)
  if (!known.length) return [{ text, bold: false }]
  const escaped = known.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const pattern = new RegExp(`(${escaped.join('|')})`, 'g')
  return text.split(pattern).filter(Boolean).map((part) => ({ text: part, bold: known.includes(part) }))
}
