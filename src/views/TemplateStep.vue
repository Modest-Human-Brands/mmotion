<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'

import StylePicker from '@/components/start/StylePicker.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiTemplateCard from '@/components/ui/UiTemplateCard.vue'
import WizardShell from '@/components/wizard/WizardShell.vue'
import { FORMATS, type FormatId } from '@/core/composition/schema'
import { KINDS, getKind, lengthLabel } from '@/core/kinds'
import { sampleComposition } from '@/core/samples'
import { getStyle } from '@/core/styles'
import { TEMPLATES, brandFromOrganization, getTemplate } from '@/core/templates'
import LivePreview from '@/render/LivePreview.vue'
import VideoStage from '@/render/VideoStage.vue'
import { useBrandStore } from '@/stores/brand'
import { STEPS, useProjectStore } from '@/stores/project'
import { useStylesStore } from '@/stores/styles'

defineOptions({ name: 'TemplateStep' })

const router = useRouter()
const brand = useBrandStore()
const project = useProjectStore()
const styles = useStylesStore()

const kind = computed(() => getKind(project.draft.kindId))
const look = computed(() => getTemplate(project.draft.templateId))
const style = computed(() => getStyle(project.draft.styleId || look.value.style))

/** A kind's sample in a look, with the organisation's brand framed by that look. */
const sample = (kindId: string, lookId: string, format?: FormatId) =>
  sampleComposition(
    kindId,
    lookId,
    brandFromOrganization(brand.organization, getTemplate(lookId)),
    format,
  )

const preview = computed(() =>
  sampleComposition(
    kind.value.id,
    look.value.id,
    brandFromOrganization(brand.organization, look.value),
    project.draft.format,
    style.value.id,
  ),
)

function chooseLook(id: string) {
  project.draft.templateId = id
}

// Card thumbnails are single frames of a sample, scaled to fit the card; no clock runs for them.
const BOX = { width: 200, height: 140 }
const thumb = (format: FormatId) => {
  const size = FORMATS[format]
  const scale = Math.min(BOX.height / size.height, BOX.width / size.width)
  return { width: size.width * scale, height: size.height * scale, scale }
}
</script>

<template>
  <WizardShell
    :step="0"
    title="What are you making?"
    subtitle="Pick the kind of video, then a look and an art style. Each can be changed later; the samples use neutral content."
  >
    <section class="flex flex-col gap-2" aria-label="Kind of video">
      <h2 class="text-sm font-semi-bold text-light-600">Kind</h2>
      <div class="grid grid-cols-2 gap-3">
        <UiTemplateCard
          v-for="item in KINDS"
          :key="item.id"
          :title="item.name"
          :category="`${item.blurb} · ${item.lengths.map(lengthLabel).join(' / ')}`"
          :active="item.id === project.draft.kindId"
          @click="project.chooseKind(item.id)"
        >
          <template #thumbnail>
            <span
              class="block overflow-hidden rounded-sm"
              :style="{
                width: `${thumb(item.format).width}px`,
                height: `${thumb(item.format).height}px`,
              }"
            >
              <span
                class="block origin-top-left"
                :style="{ transform: `scale(${thumb(item.format).scale})` }"
              >
                <VideoStage
                  :composition="sample(item.id, item.look)"
                  :seconds="1.6"
                  :media="styles.media(item.style)"
                />
              </span>
            </span>
          </template>
        </UiTemplateCard>
      </div>
    </section>

    <section class="flex flex-col gap-2" aria-label="Length">
      <h2 class="text-sm font-semi-bold text-light-600">Length</h2>
      <div class="flex flex-wrap gap-2" role="radiogroup" aria-label="Length">
        <button
          v-for="seconds in [...kind.lengths, 0]"
          :key="seconds"
          type="button"
          role="radio"
          :aria-checked="project.draft.brief.length === seconds"
          class="rounded-full border px-3 py-1 text-sm"
          :class="
            project.draft.brief.length === seconds
              ? 'border-accent-400 bg-dark-500 text-white'
              : 'border-dark-600 text-light-400 hover:text-white'
          "
          @click="project.draft.brief.length = seconds"
        >
          {{ seconds ? lengthLabel(seconds) : 'Fit the script' }}
        </button>
      </div>
    </section>

    <section class="flex flex-col gap-2" aria-label="Look">
      <h2 class="text-sm font-semi-bold text-light-600">Look</h2>
      <div class="grid grid-cols-2 gap-3">
        <UiTemplateCard
          v-for="item in TEMPLATES"
          :key="item.id"
          :title="item.name"
          :category="item.blurb"
          :active="item.id === project.draft.templateId"
          @click="chooseLook(item.id)"
        >
          <template #thumbnail>
            <span
              class="block overflow-hidden rounded-sm"
              :style="{
                width: `${thumb(project.draft.format).width}px`,
                height: `${thumb(project.draft.format).height}px`,
              }"
            >
              <span
                class="block origin-top-left"
                :style="{ transform: `scale(${thumb(project.draft.format).scale})` }"
              >
                <VideoStage
                  :composition="sample(kind.id, item.id, project.draft.format)"
                  :seconds="1.6"
                  :media="styles.media(style.id)"
                />
              </span>
            </span>
          </template>
        </UiTemplateCard>
      </div>
    </section>

    <section class="flex flex-col gap-2" aria-label="Art style">
      <h2 class="text-sm font-semi-bold text-light-600">
        Art style <span class="font-normal text-light-400">· {{ style.name }}</span>
      </h2>
      <StylePicker
        :model-value="project.draft.styleId"
        :inherit="`The look's (${getStyle(look.style).name})`"
        @update:model-value="project.draft.styleId = $event"
      />
    </section>

    <template #note>{{ kind.name }} · {{ look.name }} · {{ style.name }}</template>
    <template #actions>
      <UiButton @click="router.push(STEPS[1].path)">Next</UiButton>
    </template>

    <template #preview>
      <LivePreview
        :key="`${kind.id}:${look.id}`"
        :composition="preview"
        :media="styles.media(style.id)"
        :label="`Preview · ${kind.name} · ${look.name}`"
      />
    </template>
  </WizardShell>
</template>