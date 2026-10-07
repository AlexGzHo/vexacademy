import type { BrandConfig } from '../types/index.ts'

export const brandConfig: BrandConfig = {
  name: 'Academia',
  shortName: 'Academia',
  tagline: 'Plataforma ligera de aprendizaje online',
  logoUrl: '',
  supportEmail: 'soporte@academia.local',
  url: 'http://localhost:5173',
  colors: {
    primary: '#2563eb',
    primaryHover: '#1d4ed8',
    background: '#f8fafc',
    surface: '#ffffff',
    text: '#0f172a',
    textMuted: '#64748b',
    border: '#e2e8f0',
  },
}

export function applyBrandConfig() {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.style.setProperty('--color-primary', brandConfig.colors.primary)
  root.style.setProperty('--color-primary-hover', brandConfig.colors.primaryHover)
  root.style.setProperty('--color-bg', brandConfig.colors.background)
  root.style.setProperty('--color-surface', brandConfig.colors.surface)
  root.style.setProperty('--color-text', brandConfig.colors.text)
  root.style.setProperty('--color-text-muted', brandConfig.colors.textMuted)
  root.style.setProperty('--color-border', brandConfig.colors.border)

  document.title = brandConfig.name
}
