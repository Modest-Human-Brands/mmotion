<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'

import ModelSettings from '@/components/studio/ModelSettings.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiSegmentedControl from '@/components/ui/UiSegmentedControl.vue'
import UiTextField from '@/components/ui/UiTextField.vue'
import WizardShell from '@/components/wizard/WizardShell.vue'
import { FORMATS, type FormatId } from '@/core/composition/schema'
import { sampleComposition, sampleMedia } from '@/core/samples'
import { brandFromOrganization, getTemplate } from '@/core/templates'
import LivePreview from '@/render/LivePreview.vue'
import { useBrandStore } from '@/stores/brand'
import { STEPS, useProjectStore } from '@/stores/project'
import { useSettingsStore } from '@/stores/settings'

defineOptions({ name: 'ScriptStep' })

const router = useRouter()
const brand = useBrandStore()
const project = useProjectStore()
const settings = useSettingsStore()

const FORMAT_OPTIONS = (Object.keys(FORMATS) as FormatId[]).map((id) => ({
  value: id,
  label: FORMATS[id].label,
}))

const preview = computed(() => {
  const template = getTemplate(project.draft.templateId)
  return sampleComposition(
    template.id,
    brandFromOrganization(brand.organization, template),
    project.draft.format,
  )
})

const blocker = computed(() => {
  if (!project.draft.script.trim()) return 'Paste or write a script'
  if (!settings.ready) return 'Choose a writing model'
  return null
})

async function generate() {
  await project.generate()
  if (!project.error) await router.push(STEPS[3].path)
}
</script>

<template>
  <WizardShell
    :step="2"
    title="Your script"
    subtitle="Prose, a voiceover script or a scene-by-scene outline. It becomes scenes, on-screen text and narration."
  >
    <UiTextField
      v-model="project.draft.script"
      label="Script"
      multiline
      :rows="12"
      placeholder="Acme Sync keeps your team's files in step across every device…"
    />
    <UiSegmentedControl v-model="project.draft.format" label="Format" :options="FORMAT_OPTIONS" />
    <ModelSettings />

    <p v-if="project.busy" class="text-sm text-light-400" role="status">{{ project.progress }}…</p>
    <p
      v-if="project.error"
      class="rounded-md bg-alert-600 px-3 py-2 text-sm text-white"
      role="alert"
    >
      {{ project.error }}
    </p>

    <template #note>{{ blocker ?? 'Ready to generate' }}</template>
    <template #actions>
      <UiButton variant="ghost" :disabled="project.busy" @click="router.push(STEPS[1].path)"
        >Back</UiButton
      >
      <UiButton v-if="project.busy" variant="ghost" @click="project.cancel()">Cancel</UiButton>
      <UiButton
        v-else-if="project.composition"
        variant="secondary"
        @click="router.push(STEPS[3].path)"
        >Open studio</UiButton
      >
      <UiButton :disabled="!!blocker || project.busy" @click="generate">
        {{ project.busy ? 'Generating…' : project.composition ? 'Regenerate' : 'Generate video' }}
      </UiButton>
    </template>

    <template #preview>
      <LivePreview :composition="preview" :media="sampleMedia" label="Style preview" />
    </template>
  </WizardShell>
</template>