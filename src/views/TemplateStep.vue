<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'

import UiButton from '@/components/ui/UiButton.vue'
import UiTemplateCard from '@/components/ui/UiTemplateCard.vue'
import WizardShell from '@/components/wizard/WizardShell.vue'
import { sampleComposition, sampleMedia } from '@/core/samples'
import { FORMATS } from '@/core/composition/schema'
import { TEMPLATES, brandFromOrganization, getTemplate } from '@/core/templates'
import LivePreview from '@/render/LivePreview.vue'
import VideoStage from '@/render/VideoStage.vue'
import { useBrandStore } from '@/stores/brand'
import { STEPS, useProjectStore } from '@/stores/project'

defineOptions({ name: 'TemplateStep' })

const router = useRouter()
const brand = useBrandStore()
const project = useProjectStore()

const sample = (templateId: string) =>
  sampleComposition(templateId, brandFromOrganization(brand.organization, getTemplate(templateId)))

const selected = computed(() => getTemplate(project.draft.templateId))
const preview = computed(() => sample(selected.value.id))

function choose(templateId: string) {
  project.draft.templateId = templateId
  project.draft.format = getTemplate(templateId).format
}

// Card thumbnails are single frames of the sample, scaled to fit; no clock runs for them.
const THUMB_HEIGHT = 150
const thumb = (templateId: string) => {
  const size = FORMATS[getTemplate(templateId).format]
  const scale = THUMB_HEIGHT / size.height
  return { width: size.width * scale, scale }
}
</script>

<template>
  <WizardShell
    :step="0"
    title="Pick a template"
    subtitle="A template is the look and the storytelling: layout, colour per chapter, illustration style and the kind of story it tells."
  >
    <div class="grid grid-cols-2 gap-3">
      <UiTemplateCard
        v-for="template in TEMPLATES"
        :key="template.id"
        :title="template.name"
        :category="FORMATS[template.format].label"
        :active="template.id === project.draft.templateId"
        @click="choose(template.id)"
      >
        <template #thumbnail>
          <span
            class="block overflow-hidden rounded-sm"
            :style="{ width: `${thumb(template.id).width}px`, height: `${THUMB_HEIGHT}px` }"
          >
            <span
              class="block origin-top-left"
              :style="{ transform: `scale(${thumb(template.id).scale})` }"
            >
              <VideoStage :composition="sample(template.id)" :seconds="1.6" :media="sampleMedia" />
            </span>
          </span>
        </template>
      </UiTemplateCard>
    </div>
    <p class="text-sm text-light-400">{{ selected.description }}</p>

    <template #note>{{ selected.name }} selected</template>
    <template #actions>
      <UiButton @click="router.push(STEPS[1].path)">Next</UiButton>
    </template>

    <template #preview>
      <LivePreview
        :key="selected.id"
        :composition="preview"
        :label="`Preview · ${selected.name}`"
      />
    </template>
  </WizardShell>
</template>