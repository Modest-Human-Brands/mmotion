import { z } from 'zod'

import type { JsonSchema } from './types'

function humanize(name: string): string {
  return name
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (char) => char.toUpperCase())
    .trim()
}

function columnSpan(key: string, node: JsonSchema): number {
  if (
    node.type === 'number' ||
    node.type === 'boolean' ||
    ['date', 'time', 'email'].includes(node.format ?? '')
  ) {
    return 1
  }
  const lower = key.toLowerCase()
  if (
    node.type === 'array' ||
    ['content', 'terms', 'address', 'subtitle', 'description', 'notes', 'tagline', 'question'].some(
      (word) => lower.includes(word),
    )
  ) {
    return 2
  }
  return 1
}

export function parseSchemaToJsonSchema(
  schema: z.ZodType,
  placeholders: Record<string, unknown> = {},
): JsonSchema {
  const raw = z.toJSONSchema(schema, { unrepresentable: 'any' }) as JsonSchema

  function enrich(node: JsonSchema, depth: number, sample: unknown): JsonSchema {
    if (node.type === 'object' && node.properties) {
      const properties: Record<string, JsonSchema> = {}
      const values = (sample ?? {}) as Record<string, unknown>
      let order = 1
      for (const [key, child] of Object.entries(node.properties)) {
        const enriched = enrich(child, depth + 1, values[key])
        enriched.title ??= humanize(key)
        if (depth === 0 && enriched.type === 'object') enriched['x-section'] = humanize(key)
        enriched['x-column'] = columnSpan(key, enriched)
        enriched['x-order'] = order++
        properties[key] = enriched
      }
      return { ...node, properties }
    }
    if (node.type === 'array' && node.items) {
      const first = Array.isArray(sample) ? (sample[0] as unknown) : undefined
      return { ...node, items: enrich(node.items, depth + 1, first) }
    }

    const defaultable =
      node.enum || node.type === 'number' || node.type === 'boolean' || node['x-widget']
    if (
      defaultable &&
      (typeof sample === 'string' || typeof sample === 'number' || typeof sample === 'boolean')
    ) {
      return { ...node, default: sample }
    }
    return node
  }

  return enrich(raw, 0, placeholders)
}