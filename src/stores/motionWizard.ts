import { computed, markRaw, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { useStorage } from '@vueuse/core'
import { useNotForm } from 'notform'

import { useTimeline } from '@/domain/animation/timeline'
import { loadGoogleFont } from '@/domain/fonts'
import { buildFormSchema, emptyFormSchema, validateForm } from '@/domain/formSchema'
import { isSessionUrl } from '@/domain/media'
import {
  neutralOrganization,
  loadOrganization,
  saveOrganization,
  DEFAULT_FONT,
  type OrganizationProfile,
} from '@/domain/organization'
import { organizationFormSchema } from '@/domain/organizationForm'
import { parseSchemaToJsonSchema } from '@/domain/schemaConverter'
import { initialValues } from '@/domain/templateValues'
import { toPayload, type Problem, type Values } from '@/domain/schema'
import type { JsonSchema } from '@/domain/types'
import { getTemplate } from '@templates/registry'
import { buildSettings, type SceneSettings } from '@templates/motion'
import type { MotionTemplateDefinition } from '@templates/types'

export const STEPS = [
  { name: 'template', label: 'Template', path: '/studio/template' },
  { name: 'brand', label: 'Brand', path: '/studio/brand' },
  { name: 'details', label: 'Content', path: '/studio/details' },
  { name: 'export', label: 'Export', path: '/studio/export' },
] as const

const DRAFT_KEY = 'mmotion.draft'

interface Draft {
  templateId: string | null
  values: Values
}

function mergeOver(base: unknown, override: unknown): unknown {
  if (override === undefined || override === null || override === '') return base
  if (Array.isArray(override)) return override
  if (
    typeof override === 'object' &&
    base !== null &&
    typeof base === 'object' &&
    !Array.isArray(base)
  ) {
    const result: Values = { ...(base as Values) }
    for (const [key, value] of Object.entries(override))
      result[key] = mergeOver((base as Values)[key], value)
    return result
  }
  return override
}

/** Object URLs die with the page, so they must not be saved in the draft. */
function withoutSessionUrls(value: unknown): unknown {
  if (isSessionUrl(value)) return ''
  if (Array.isArray(value)) return value.map(withoutSessionUrls)
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, withoutSessionUrls(child)]),
    )
  }
  return value
}

export const useMotionWizardStore = defineStore('motionWizard', () => {
  const draft = useStorage<Partial<Draft>>(DRAFT_KEY, {}, undefined, {
    listenToStorageChanges: false,
  })
  const saved = draft.value

  const initialTemplate = saved?.templateId ? getTemplate(saved.templateId) : undefined
  const templateId = ref<string | null>(initialTemplate?.id ?? null)

  const template = computed<MotionTemplateDefinition | null>(() =>
    templateId.value ? (getTemplate(templateId.value) ?? null) : null,
  )
  const schema = computed<JsonSchema | null>(() =>
    template.value
      ? parseSchemaToJsonSchema(template.value.schema, template.value.placeholders)
      : null,
  )
  const formSchema = computed(() =>
    schema.value ? buildFormSchema(schema.value) : emptyFormSchema,
  )

  const form = useNotForm({
    schema: () => formSchema.value,
    initialValues: initialTemplate ? initialValues(initialTemplate, saved?.values) : {},
  })
  const values = form.values as Values

  const organizationForm = useNotForm({
    schema: organizationFormSchema,
    initialValues: loadOrganization(),
  })
  const organization = organizationForm.values as OrganizationProfile
  const organizationSaved = ref(true)

  const submitAttempted = ref(false)

  const problems = computed<Problem[]>(() =>
    schema.value ? validateForm(formSchema.value, values) : [],
  )

  const mergedValues = computed<Values>(() => {
    const active = template.value
    if (!active || !schema.value) return {}
    const payload = (toPayload(schema.value, values) ?? {}) as Values
    return mergeOver(active.placeholders, payload) as Values
  })

  const settings = computed<SceneSettings | null>(() => {
    const active = template.value
    return active ? buildSettings(active, mergedValues.value, organization) : null
  })

  const overlayProps = computed<Record<string, unknown> | null>(() => {
    const overlay = template.value?.overlay
    return overlay ? overlay.props(mergedValues.value, organization) : null
  })

  const sampleSettings = computed<SceneSettings | null>(() => {
    const active = template.value
    return active ? buildSettings(active, active.placeholders, neutralOrganization) : null
  })

  const sampleOverlayProps = computed<Record<string, unknown> | null>(() => {
    const overlay = template.value?.overlay
    return overlay ? overlay.props(template.value!.placeholders, neutralOrganization) : null
  })

  // Raw so Pinia doesn't unwrap the refs inside it: consumers read `timeline.currentFrame.value`.
  const timeline = markRaw(useTimeline())
  watch(
    () => [settings.value?.fps, settings.value?.durationFrames] as const,
    ([fps, duration]) => {
      if (fps && duration) timeline.configure(fps, duration)
    },
    { immediate: true },
  )

  function selectTemplate(id: string | null) {
    if (templateId.value === id) return
    templateId.value = id
    submitAttempted.value = false
    timeline.seek(0)

    const next = id ? getTemplate(id) : undefined
    if (!next) {
      form.reset({})
      return
    }
    form.reset(initialValues(next))
  }

  function setValue(path: (string | number)[], value: unknown) {
    form.setValue(path.join('.'), value)
  }

  function saveOrganizationProfile() {
    saveOrganization(organization)
    organizationSaved.value = true
  }

  function reset() {
    templateId.value = null
    submitAttempted.value = false
    form.reset({})
  }

  watch(organization, () => (organizationSaved.value = false), { deep: true, flush: 'sync' })

  watch(
    () => organization.font,
    (family) => {
      if (family && family !== DEFAULT_FONT) void loadGoogleFont(family)
    },
    { immediate: true },
  )

  watch(
    [templateId, values],
    () => {
      draft.value = {
        templateId: templateId.value,
        values: withoutSessionUrls(values) as Values,
      } satisfies Draft
    },
    { deep: true },
  )

  return {
    templateId,
    template,
    schema,
    values,
    form,
    formSchema,
    organization,
    organizationForm,
    organizationSaved,
    problems,
    submitAttempted,
    settings,
    overlayProps,
    sampleSettings,
    sampleOverlayProps,
    timeline,
    selectTemplate,
    setValue,
    saveOrganizationProfile,
    reset,
  }
})