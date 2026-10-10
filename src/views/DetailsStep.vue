<script setup lang="ts">
import { NotForm } from 'notform'
import { computed, nextTick } from 'vue'
import { useRouter } from 'vue-router'

import StageViewport from '@/components/studio/StageViewport.vue'
import UiButton from '@/components/ui/UiButton.vue'
import SchemaFields from '@/components/wizard/SchemaFields.vue'
import WizardShell from '@/components/wizard/WizardShell.vue'
import { STEPS, useMotionWizardStore } from '@/stores/motionWizard'

defineOptions({ name: 'DetailsStep' })

const router = useRouter()
const wizard = useMotionWizardStore()

const label = computed(() => wizard.template?.label ?? 'Design')

const note = computed(() => {
  const [first, ...rest] = wizard.problems
  if (!first) return 'Draft saved on this device'
  return `To continue: ${first.message.toLowerCase()}${rest.length > 0 ? ` (+${rest.length} more)` : ''}`
})

function focusFirstInvalid() {
  const first = document.querySelector<HTMLElement>('[aria-invalid="true"]')
  first?.focus()
  first?.scrollIntoView({ block: 'center', behavior: 'smooth' })
}

async function next() {
  wizard.submitAttempted = true
  const checked = await wizard.form.validate()
  if (checked.issues) {
    await nextTick()
    focusFirstInvalid()
    return
  }
  await router.push(STEPS[3].path)
}
</script>

<template>
  <WizardShell
    :step="2"
    :title="`${label} content`"
    subtitle="Adjust the scene. The preview updates as you change it."
  >
    <p v-if="!wizard.schema" class="text-sm text-light-400" role="status">Pick a template first.</p>

    <NotForm v-else :form="wizard.form" @submit.prevent>
      <SchemaFields :schema="wizard.schema" />
    </NotForm>

    <template #note>{{ note }}</template>
    <template #actions>
      <UiButton variant="ghost" @click="router.push(STEPS[1].path)">Back</UiButton>
      <UiButton :disabled="!wizard.schema" @click="next">Export</UiButton>
    </template>

    <template #preview>
      <StageViewport :label="`Live preview · ${label}`" />
    </template>
  </WizardShell>
</template>