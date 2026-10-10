import { parseSchemaToJsonSchema } from './schemaConverter'
import { emptyValue, schemaDefaults, withDefaults, type Values } from './schema'
import type { MotionTemplateDefinition } from '@templates/types'

export function initialValues(template: MotionTemplateDefinition, draft?: Values): Values {
  const json = parseSchemaToJsonSchema(template.schema, template.placeholders)
  const blank = withDefaults(schemaDefaults(json), emptyValue(json))
  return withDefaults(draft ?? {}, blank) as Values
}