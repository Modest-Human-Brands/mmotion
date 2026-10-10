export const ENTITY_TYPES = ['LLP', 'Private Limited', 'Proprietorship'] as const
type EntityType = (typeof ENTITY_TYPES)[number]

export const TRADE_RELATIONSHIPS = [
  'Primary',
  'Trading As',
  'Operating Division',
  'Wholly-Owned Subsidiary',
  'Special Purpose Vehicle',
] as const
type TradeRelationship = (typeof TRADE_RELATIONSHIPS)[number]

export const SOCIAL_KEYS = ['instagram', 'facebook', 'linkedin', 'youtube'] as const
export type SocialKey = (typeof SOCIAL_KEYS)[number]

const FIRST_FOUNDED_YEAR = 1900

export interface OrganizationProfile {
  id: string
  name: string
  legalName: string
  entityType: EntityType
  tradeRelationship: TradeRelationship
  address: string
  foundedYear: string
  pan: string
  gstin: string
  logo: { name: string; dataUrl: string } | null
  primary: string
  accent: string
  font: string
  bank: { accountName: string; accountNumber: string; bankName: string; ifscCode: string }
  contactEmail: string
  billingEmail: string
  phone: string
  whatsapp: string
  website: string
  socials: Record<SocialKey, string>
}

export const DEFAULT_FONT = 'Exo 2'

export function normalizeHex(input: string): string | null {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(input.trim())
  if (!match) return null
  const hex = match[1] ?? ''
  const full =
    hex.length === 3
      ? hex
          .split('')
          .map((c) => c + c)
          .join('')
      : hex
  return `#${full.toUpperCase()}`
}

export function foundedYearError(input: string): string | null {
  const text = input.trim()
  if (text === '') return null
  const year = Number(text)
  const valid =
    /^\d{4}$/.test(text) && year >= FIRST_FOUNDED_YEAR && year <= new Date().getFullYear()
  return valid ? null : `Enter a year between ${FIRST_FOUNDED_YEAR} and this year`
}

export function isEmail(input: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(input.trim())
}

const DEFAULT_ORGANIZATION_ID = 'default'

export function emptyOrganization(): OrganizationProfile {
  return {
    id: DEFAULT_ORGANIZATION_ID,
    name: '',
    legalName: '',
    entityType: 'LLP',
    tradeRelationship: 'Primary',
    address: '',
    foundedYear: '',
    pan: '',
    gstin: '',
    logo: null,
    primary: '#111827',
    accent: '#5945EA',
    font: DEFAULT_FONT,
    bank: { accountName: '', accountNumber: '', bankName: '', ifscCode: '' },
    contactEmail: '',
    billingEmail: '',
    phone: '',
    whatsapp: '',
    website: '',
    socials: { instagram: '', facebook: '', linkedin: '', youtube: '' },
  }
}

const KEY = 'mmotion.organization'

export function loadOrganization(): OrganizationProfile {
  const base = emptyOrganization()
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return base
    const saved = JSON.parse(raw) as Partial<OrganizationProfile>
    return {
      ...base,
      ...saved,
      bank: { ...base.bank, ...saved.bank },
      socials: { ...base.socials, ...saved.socials },
    }
  } catch {
    return base
  }
}

export const NEUTRAL_ORGANIZATION_ID = 'neutral'

export const neutralOrganization: OrganizationProfile = {
  ...emptyOrganization(),
  id: NEUTRAL_ORGANIZATION_ID,
  name: 'Your Company',
  address: 'Address',
  phone: 'Phone',
  contactEmail: 'Email',
  website: 'Website',
  primary: '#111111',
  accent: '#85858F',
}

export function saveOrganization(profile: OrganizationProfile): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(profile))
  } catch {}
}