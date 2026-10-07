export interface BrandColors {
  primary: string
  primaryHover: string
  background: string
  surface: string
  text: string
  textMuted: string
  border: string
}

export interface BrandConfig {
  name: string
  shortName: string
  tagline: string
  logoUrl?: string
  supportEmail: string
  url: string
  colors: BrandColors
}

