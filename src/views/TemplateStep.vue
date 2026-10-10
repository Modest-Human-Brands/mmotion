<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import StageViewport from '@/components/studio/StageViewport.vue'
import TemplateThumb from '@/components/studio/TemplateThumb.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiFilterChip from '@/components/ui/UiFilterChip.vue'
import UiTemplateCard from '@/components/ui/UiTemplateCard.vue'
import WizardShell from '@/components/wizard/WizardShell.vue'
import { STEPS, useMotionWizardStore } from '@/stores/motionWizard'
import { categoryFilters, getAllTemplates } from '@templates/registry'

defineOptions({ name: 'TemplateStep' })

const router = useRouter()
const wizard = useMotionWizardStore()

const templates = getAllTemplates()
const filter = ref<string>('All')
const filters = computed(() => categoryFilters(templates))
const visible = computed(() =>
  templates.filter((t) => filter.value === 'All' || t.category === filter.value),
)
const selected = computed(() => wizard.template)

function toggle(id: string) {
  wizard.selectTemplate(wizard.templateId === id ? null : id)
}

async function next() {
  await router.push(STEPS[1].path)
}
</script>

<template>
  <WizardShell
    :step="0"
    title="Start from a template"
    subtitle="Pick one to preview it. You can switch any time before exporting."
  >
    <div class="flex flex-wrap gap-2" role="group" aria-label="Filter templates">
      <UiFilterChip
        v-for="item in filters"
        :key="item.id"
        :label="item.id"
        :count="item.count"
        :selected="filter === item.id"
        @click="filter = item.id"
      />
    </div>

    <div class="grid grid-cols-3 gap-3">
      <UiTemplateCard
        v-for="template in visible"
        :key="template.id"
        :title="template.shortLabel"
        :category="template.category"
        :active="template.id === wizard.templateId"
        @click="toggle(template.id)"
      >
        <template #thumbnail>
          <TemplateThumb :template="template" />
        </template>
      </UiTemplateCard>
    </div>

    <template #note>{{
      selected ? `${selected.shortLabel} selected` : 'No template selected'
    }}</template>
    <template #actions>
      <UiButton v-if="selected" variant="ghost" @click="wizard.selectTemplate(null)"
        >Choose another</UiButton
      >
      <UiButton :disabled="!selected" @click="next">Use this template</UiButton>
    </template>

    <template #preview>
      <StageViewport
        sample
        :label="selected ? `Preview · ${selected.shortLabel} · Sample` : 'Preview'"
      />
    </template>
  </WizardShell>
</template>