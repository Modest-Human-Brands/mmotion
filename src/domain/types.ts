export interface JsonSchema {
  type?: 'object' | 'array' | 'string' | 'number' | 'integer' | 'boolean'
  title?: string
  description?: string
  properties?: Record<string, JsonSchema>
  required?: string[]
  items?: JsonSchema
  enum?: (string | number)[]
  format?: string
  minimum?: number
  maximum?: number
  default?: unknown
  minLength?: number
  maxLength?: number
  pattern?: string
  'x-section'?: string
  'x-column'?: number
  'x-order'?: number
  'x-widget'?: 'media' | 'color'
  'x-accept'?: string
}

export interface FontSummary {
  family: string
  name: string
}