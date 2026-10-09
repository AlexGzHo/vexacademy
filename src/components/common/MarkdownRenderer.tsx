import React from 'react'
import { CopyableBlock } from './CopyableBlock.tsx'

interface MarkdownRendererProps {
  content?: string | null
  emptyMessage?: string
}

export function MarkdownRenderer({ content, emptyMessage }: MarkdownRendererProps) {
  if (!content || !content.trim()) {
    return (
      <p className="text-muted">
        {emptyMessage || 'No hay contenido escrito adicional en esta lección.'}
      </p>
    )
  }

  // Parse lines into blocks
  const blocks: React.ReactNode[] = []
  const lines = content.split('\n')
  let i = 0
  let blockKey = 0

  while (i < lines.length) {
    const line = lines[i]

    // 1. Code blocks (```language ... ```)
    if (line.trim().startsWith('```')) {
      const match = line.trim().match(/^```(\w+)?/)
      const lang = match && match[1] ? match[1] : 'javascript'
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      i++ // saltar línea de cierre ```
      blocks.push(
        <div key={`code-${blockKey++}`} className="markdown-code-wrapper">
          <CopyableBlock
            content={codeLines.join('\n')}
            variant={lang.toLowerCase() === 'prompt' ? 'prompt' : 'code'}
            language={lang}
          />
        </div>,
      )
      continue
    }

    // 2. Headings
    if (line.startsWith('### ')) {
      blocks.push(
        <h3 key={`h3-${blockKey++}`} className="markdown-h3">
          {renderInline(line.replace('### ', ''))}
        </h3>,
      )
      i++
      continue
    }
    if (line.startsWith('## ')) {
      blocks.push(
        <h2 key={`h2-${blockKey++}`} className="markdown-h2">
          {renderInline(line.replace('## ', ''))}
        </h2>,
      )
      i++
      continue
    }
    if (line.startsWith('# ')) {
      blocks.push(
        <h1 key={`h1-${blockKey++}`} className="markdown-h1">
          {renderInline(line.replace('# ', ''))}
        </h1>,
      )
      i++
      continue
    }

    // 3. Blockquotes
    if (line.startsWith('> ')) {
      const quoteLines: string[] = [line.replace(/^>\s?/, '')]
      i++
      while (i < lines.length && lines[i].startsWith('> ')) {
        quoteLines.push(lines[i].replace(/^>\s?/, ''))
        i++
      }
      blocks.push(
        <blockquote key={`quote-${blockKey++}`} className="markdown-blockquote">
          {quoteLines.map((q, idx) => (
            <p key={idx}>{renderInline(q)}</p>
          ))}
        </blockquote>,
      )
      continue
    }

    // 4. Bullet lists (- or *)
    if (/^\s*[-*]\s+/.test(line)) {
      const listItems: string[] = []
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        listItems.push(lines[i].replace(/^\s*[-*]\s+/, ''))
        i++
      }
      blocks.push(
        <ul key={`ul-${blockKey++}`} className="markdown-list">
          {listItems.map((item, idx) => (
            <li key={idx}>{renderInline(item)}</li>
          ))}
        </ul>,
      )
      continue
    }

    // 5. Numbered lists (1. 2.)
    if (/^\s*\d+\.\s+/.test(line)) {
      const listItems: string[] = []
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        listItems.push(lines[i].replace(/^\s*\d+\.\s+/, ''))
        i++
      }
      blocks.push(
        <ol key={`ol-${blockKey++}`} className="markdown-ordered-list">
          {listItems.map((item, idx) => (
            <li key={idx}>{renderInline(item)}</li>
          ))}
        </ol>,
      )
      continue
    }

    // 6. Empty line
    if (!line.trim()) {
      i++
      continue
    }

    // 7. Regular paragraph
    const paraLines: string[] = [line]
    i++
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].trim().startsWith('```') &&
      !lines[i].startsWith('#') &&
      !lines[i].startsWith('>') &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i])
    ) {
      paraLines.push(lines[i])
      i++
    }
    blocks.push(
      <p key={`p-${blockKey++}`} className="markdown-p">
        {renderInline(paraLines.join(' '))}
      </p>,
    )
  }

  return <div className="markdown-content">{blocks}</div>
}

/**
 * Parsea formato en línea: **negrita**, *cursiva*, `código`, [enlace](url)
 */
function renderInline(text: string): React.ReactNode[] {
  // Regex para tokens: enlaces [title](url), código `code`, negrita **bold**, cursiva *italic*
  const tokenRegex =
    /(\[[^\]]+\]\([^)]+\)|`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g

  const parts = text.split(tokenRegex)
  return parts.map((part, index) => {
    if (!part) return null

    // Enlace
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
    if (linkMatch) {
      return (
        <a
          key={index}
          href={linkMatch[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="markdown-link"
        >
          {linkMatch[1]}
        </a>
      )
    }

    // Código en línea
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      return (
        <code key={index} className="markdown-inline-code">
          {part.slice(1, -1)}
        </code>
      )
    }

    // Negrita
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      return <strong key={index}>{part.slice(2, -2)}</strong>
    }

    // Cursiva
    if (part.startsWith('*') && part.endsWith('*') && part.length >= 2) {
      return <em key={index}>{part.slice(1, -1)}</em>
    }

    return <React.Fragment key={index}>{part}</React.Fragment>
  })
}

