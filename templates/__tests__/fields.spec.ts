import { describe, expect, it } from 'vite-plus/test'

import { buildFormSchema, validateForm } from '@/domain/formSchema'
import {
  emptyValue,
  isObjectSchema,
  orderedProperties,
  withDefaults,
  type Values,
} from '@/domain/schema'
import { parseSchemaToJsonSchema } from '@/domain/schemaConverter'
import { initialValues } from '@/domain/templateValues'
import type { JsonSchema } from '@/domain/types'

import { getAllTemplates } from '../registry'

interface Leaf {
  path: (string | number)[]
  node: JsonSchema
  required: boolean
  reportedAt: string
}

function leaves(schema: JsonSchema, prefix: (string | number)[] = [], inherited = true): Leaf[] {
  if (isObjectSchema(schema)) {
    return orderedProperties(schema).flatMap(([key, child]) =>
      leaves(child, [...prefix, key], inherited && (schema.required?.includes(key) ?? false)),
    )
  }
  if (schema.type === 'array' && schema.items)
    return leaves(schema.items, [...prefix, 0], inherited)
  const inArray = typeof prefix[prefix.length - 1] === 'number'
  return [
    {
      path: prefix,
      node: schema,
      required: inherited,
      reportedAt: (inArray ? prefix.slice(0, -1) : prefix).join('.'),
    },
  ]
}

type Container = Record<string | number, unknown>

function valueAt(target: Values, path: (string | number)[]): unknown {
  return path.reduce<unknown>(
    (cursor, segment) => (cursor as Container | undefined)?.[segment],
    target,
  )
}

function setAt(target: Values, path: (string | number)[], value: unknown) {
  const parent = valueAt(target, path.slice(0, -1)) as Container
  parent[path[path.length - 1]!] = value
}

describe.each(getAllTemplates().map((t) => [t.id, t] as const))(
  '%s form fields',
  (_id, template) => {
    const json = parseSchemaToJsonSchema(template.schema, template.placeholders)
    const formSchema = buildFormSchema(json)
    const fields = leaves(json)
    const enumFields = fields.filter((field) => field.node.enum)

    const filled = () =>
      structuredClone(withDefaults(template.placeholders, emptyValue(json))) as Values

    it('starts with a value for every enum and picker field', () => {
      const start = initialValues(template) as Values
      const missing = enumFields
        .filter((field) => !valueAt(start, field.path))
        .map((field) => field.path.join('.'))
      expect(missing).toEqual([])
    })

    it('opens an old draft that lacks a field with that field defaulted', () => {
      const start = initialValues(template, {}) as Values
      const missing = enumFields
        .filter((field) => !valueAt(start, field.path))
        .map((field) => field.path.join('.'))
      expect(missing).toEqual([])
    })

    it('accepts the sample values', () => {
      expect(validateForm(formSchema, filled())).toEqual([])
    })

    it.each(fields.map((field) => [field.path.join('.'), field] as const))(
      '%s: is reported when blank exactly if it is required',
      (_name, field) => {
        const values = filled()
        const inList = typeof field.path[field.path.length - 1] === 'number'
        if (inList) setAt(values, field.path.slice(0, -1), [''])
        else setAt(values, field.path, '')
        const reported = validateForm(formSchema, values).some(
          (problem) => problem.path === field.reportedAt,
        )
        expect(reported).toBe(field.required)
      },
    )
  },
)