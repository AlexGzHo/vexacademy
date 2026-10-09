export interface BrandColors {
  primary: string
  primaryHover: string
  background: string
  surface: string
  text: string
  textMuted: string
  border: string
}

export interface PaymentInfo {
  yapeNumber: string
  plinNumber: string
  accountHolder: string
  instructions: string
}

export interface BrandConfig {
  name: string
  shortName: string
  tagline: string
  logoUrl?: string
  supportEmail: string
  url: string
  colors: BrandColors
  paymentInfo: PaymentInfo
}


