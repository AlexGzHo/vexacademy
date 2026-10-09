import type { BrandConfig } from '../types/index.ts'

export const brandConfig: BrandConfig = {
  name: 'VEX ACADEMY',
  shortName: 'VEX',
  tagline: 'Formación en programación, desarrollo de aplicaciones e inteligencia artificial',
  logoUrl: '',
  supportEmail: 'soporte@vexacademy.com',
  url: 'http://localhost:5173',
  colors: {
    primary: '#4F46E5',
    primaryHover: '#4338CA',
    background: '#F6F7FB',
    surface: '#FFFFFF',
    text: '#18212F',
    textMuted: '#667085',
    border: '#DDE2EA',
  },
  paymentInfo: {
    yapeNumber: '+51 987 654 321',
    plinNumber: '+51 987 654 321',
    accountHolder: 'VEX ACADEMY',
    instructions: 'Envía el comprobante por este medio.',
  },
}

export function applyBrandConfig() {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.style.setProperty('--color-primary', brandConfig.colors.primary)
  root.style.setProperty('--color-primary-hover', brandConfig.colors.primaryHover)
  root.style.setProperty('--color-page', brandConfig.colors.background)
  root.style.setProperty('--color-bg', brandConfig.colors.background)
  root.style.setProperty('--color-surface', brandConfig.colors.surface)
  root.style.setProperty('--color-text', brandConfig.colors.text)
  root.style.setProperty('--color-ink', brandConfig.colors.text)
  root.style.setProperty('--color-text-muted', brandConfig.colors.textMuted)
  root.style.setProperty('--color-border', brandConfig.colors.border)

  document.title = brandConfig.name
}
