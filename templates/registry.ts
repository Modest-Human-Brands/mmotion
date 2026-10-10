import type { MotionTemplateDefinition } from './types'

const modules = import.meta.glob<{ default: MotionTemplateDefinition }>('./*/index.ts', {
  eager: true,
})

const templateRegistry: Record<string, MotionTemplateDefinition> = {}

for (const path of Object.keys(modules).sort()) {
  const template = modules[path]?.default
  if (template?.id) templateRegistry[template.id] = template
}

export const getTemplate = (id: string): MotionTemplateDefinition | undefined =>
  templateRegistry[id]
export const getAllTemplates = (): MotionTemplateDefinition[] => Object.values(templateRegistry)

export function categoryFilters(
  templates: MotionTemplateDefinition[],
): { id: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const template of templates)
    counts.set(template.category, (counts.get(template.category) ?? 0) + 1)
  return [
    { id: 'All', count: templates.length },
    ...[...counts].map(([id, count]) => ({ id, count })),
  ]
}