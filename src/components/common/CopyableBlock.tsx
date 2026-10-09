import { useState } from 'react'
import { Copy, Check, Terminal, Sparkles } from 'lucide-react'

interface CopyableBlockProps {
  content: string
  title?: string
  variant?: 'code' | 'prompt'
  language?: string
}

export function CopyableBlock({
  content,
  title,
  variant = 'code',
  language = 'javascript',
}: CopyableBlockProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Error al copiar al portapapeles:', err)
    }
  }

  const isPrompt = variant === 'prompt'

  return (
    <div className={`copyable-block ${isPrompt ? 'prompt-block' : 'code-block'}`}>
      <div className="copyable-header">
        <div className="copyable-meta">
          {isPrompt ? (
            <>
              <Sparkles size={16} className="prompt-icon" />
              <span className="copyable-title">{title || 'Prompt de Inteligencia Artificial'}</span>
            </>
          ) : (
            <>
              <Terminal size={16} className="code-icon" />
              <span className="copyable-title">{title || language.toUpperCase()}</span>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="copy-btn"
          title={copied ? 'Copiado' : 'Copiar al portapapeles'}
        >
          {copied ? (
            <>
              <Check size={14} className="text-success" />
              <span>Copiado</span>
            </>
          ) : (
            <>
              <Copy size={14} />
              <span>{isPrompt ? 'Copiar prompt' : 'Copiar código'}</span>
            </>
          )}
        </button>
      </div>
      <div className="copyable-body">
        <pre>
          <code>{content}</code>
        </pre>
      </div>
    </div>
  )
}

