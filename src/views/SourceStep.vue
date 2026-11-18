<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import BlockEditor from '@/components/story/BlockEditor.vue'
import BriefCard from '@/components/story/BriefCard.vue'
import ModelSettings from '@/components/studio/ModelSettings.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiSegmentedControl from '@/components/ui/UiSegmentedControl.vue'
import UiTextField from '@/components/ui/UiTextField.vue'
import WizardShell from '@/components/wizard/WizardShell.vue'
import { parseScript } from '@/core/blocks'
import { FORMATS, type FormatId } from '@/core/composition/schema'
import { getKind } from '@/core/kinds'
import { LANGUAGES } from '@/core/models/catalog'
import { sampleComposition } from '@/core/samples'
import { brandFromOrganization, getTemplate } from '@/core/templates'
import LivePreview from '@/render/LivePreview.vue'
import { useBrandStore } from '@/stores/brand'
import { useIntakeStore } from '@/stores/intake'
import { usePicturesStore } from '@/stores/pictures'
import { STEPS, stepIndex, useProjectStore } from '@/stores/project'
import { useSettingsStore } from '@/stores/settings'
import { useStylesStore } from '@/stores/styles'

defineOptions({ name: 'SourceStep' })

const router = useRouter()
const brand = useBrandStore()
const project = useProjectStore()
const settings = useSettingsStore()
const intake = useIntakeStore()
const pictures = usePicturesStore()
const styles = useStylesStore()

const FORMAT_OPTIONS = (Object.keys(FORMATS) as FormatId[]).map((id) => ({
  value: id,
  label: FORMATS[id].label,
}))

const USAGE = [
  {
    value: true,
    label: 'Yes, commercial',
    detail: 'Only models whose licence allows commercial use',
  },
  {
    value: false,
    label: 'No, personal or research',
    detail: 'Every model, including non-commercial ones',
  },
] as const

const mode = ref<'blocks' | 'paste' | 'video'>(project.draft.source ? 'video' : 'blocks')
const pasted = ref('')

function splitPasted() {
  const blocks = parseScript(pasted.value)
  if (blocks.length === 0) return
  if (
    project.draft.blocks.length &&
    !window.confirm(`Replace the ${project.draft.blocks.length} scenes with the pasted text?`)
  )
    return
  project.draft.blocks = blocks
  pasted.value = ''
  mode.value = 'blocks'
}
const video = ref<File | null>(null)
const videoUrl = computed(() => (video.value ? URL.createObjectURL(video.value) : null))
const source = computed(() => project.draft.source)

const preview = computed(() => {
  const template = getTemplate(project.draft.templateId)
  return sampleComposition(
    project.draft.kindId,
    template.id,
    brandFromOrganization(brand.organization, template),
    project.draft.format,
    project.draftStyle,
  )
})

const blocker = computed(() => {
  if (!settings.ready) return 'The model server has no writing model'
  if (project.draft.commercial === null) return 'Say whether this video is for commercial use'
  const content = project.draft.blocks.some(
    (item) => item.narration.trim() || item.headline.trim() || item.visual.trim(),
  )
  if (!content)
    return mode.value === 'video' ? 'Read a video first' : 'Add a scene or paste a script'
  return null
})

function pick(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file) video.value = file
}

async function analyze() {
  if (video.value) await intake.analyze(video.value)
}

function useSuggested() {
  const kind = source.value?.suggestedKind
  const look = source.value?.suggestedTemplate
  if (kind && kind !== project.draft.kindId) {
    const format = project.draft.format
    project.chooseKind(kind)
    // The video's own format wins over the kind's default.
    project.draft.format = format
  }
  if (look) project.draft.templateId = look
}

const suggestionDiffers = computed(
  () =>
    (!!source.value?.suggestedKind && source.value.suggestedKind !== project.draft.kindId) ||
    (!!source.value?.suggestedTemplate &&
      source.value.suggestedTemplate !== project.draft.templateId),
)

async function writeStory() {
  if (
    project.composition &&
    !window.confirm('Write a new story? The current story, cast and storyboard are replaced.')
  )
    return
  await project.writeStory()
  if (!project.error) await router.push(STEPS[stepIndex('story')].path)
}

const sampleUrl = computed(() =>
  source.value?.voiceSample ? (pictures.assetUrls.get(source.value.voiceSample) ?? null) : null,
)
</script>

<template>
  <WizardShell
    :step="stepIndex('source')"
    title="Source"
    subtitle="Say what the video is for and what each scene says, paste a script, or adapt a video: it is read for the story, the recurring characters and objects, and the narrator's voice. Nothing is generated beyond this until you approve each step."
  >
    <BriefCard
      v-model="project.draft.brief"
      :kind-id="project.draft.kindId"
      :kept-wording="mode === 'video' && !!source && project.draft.keepWording"
      :disabled="project.busy"
    />

    <UiSegmentedControl
      v-model="mode"
      :options="[
        { value: 'blocks', label: 'Write scenes' },
        { value: 'paste', label: 'Paste a script' },
        { value: 'video', label: 'Adapt a video' },
      ]"
    />

    <div v-if="mode === 'paste'" class="flex flex-col gap-2">
      <UiTextField
        v-model="pasted"
        label="Script"
        hint="Numbered steps, paragraphs, an outline or a voiceover"
        multiline
        :rows="8"
        placeholder="1. Boil fresh water.&#10;2. Warm the pot…"
      />
      <div class="flex items-center gap-2">
        <UiButton variant="secondary" :disabled="!pasted.trim()" @click="splitPasted"
          >Split into scenes</UiButton
        >
        <span class="text-xs text-light-400"
          >Lists become steps, headings become chapters, a long voiceover is cut every two
          sentences.</span
        >
      </div>
    </div>

    <template v-if="mode === 'video'">
      <div class="flex flex-col gap-3 rounded-lg border border-dark-600 p-3">
        <label class="flex flex-col gap-1.5 text-sm font-semi-bold text-light-600">
          Video
          <input
            type="file"
            accept="video/*"
            class="text-sm text-light-400 file:mr-3 file:rounded-md file:border-0 file:bg-dark-600 file:px-3 file:py-1.5 file:text-white"
            @change="pick"
          />
        </label>
        <video
          v-if="videoUrl"
          :src="videoUrl"
          controls
          muted
          class="max-h-48 self-start rounded-md bg-black"
        />
        <label class="flex items-center gap-2 text-sm text-light-500">
          <input v-model="project.draft.keepWording" type="checkbox" />
          Keep the original narration word for word
        </label>
        <p class="text-xs text-light-400">
          Uses the Seeing model to watch and the Word timing model to transcribe. Only use videos,
          characters and voices you have the rights to.
        </p>
        <div class="flex gap-2">
          <UiButton
            variant="secondary"
            :disabled="!video || project.busy || !settings.modelFor('see')"
            @click="analyze"
            >{{ source ? 'Read again' : 'Read the video' }}</UiButton
          >
        </div>
      </div>

      <section
        v-if="source"
        class="flex flex-col gap-2 rounded-lg border border-dark-600 p-3"
        aria-label="What the video contains"
      >
        <p class="text-sm font-bold text-white">{{ source.title }}</p>
        <p class="text-sm text-light-500">{{ source.purpose }}</p>
        <p v-if="source.suggestedTemplate || source.suggestedKind" class="text-xs text-light-400">
          Looks like {{ source.suggestedKind ? getKind(source.suggestedKind).name : 'a video' }}
          <template v-if="source.suggestedTemplate">
            in the {{ getTemplate(source.suggestedTemplate).name }} look</template
          >
          <button
            v-if="suggestionDiffers"
            type="button"
            class="ml-1 underline hover:text-white"
            @click="useSuggested"
          >
            Use it
          </button>
        </p>
        <div v-if="source.cast.length" class="flex flex-wrap gap-2">
          <figure v-for="member in source.cast" :key="member.name" class="flex w-24 flex-col gap-1">
            <img
              v-if="member.refs[0] && pictures.assetUrls.get(member.refs[0])"
              :src="pictures.assetUrls.get(member.refs[0])"
              :alt="member.name"
              class="h-24 w-24 rounded-md bg-white object-contain"
            />
            <div v-else class="h-24 w-24 rounded-md bg-dark-500" />
            <figcaption class="truncate text-xs text-light-500">
              {{ member.name }}<span v-if="member.exact"> · exact</span>
            </figcaption>
          </figure>
        </div>
        <div v-if="sampleUrl" class="flex items-center gap-2 text-xs text-light-400">
          Narrator sample <audio :src="sampleUrl" controls class="h-8" />
        </div>
      </section>
    </template>

    <BlockEditor
      v-if="mode === 'blocks' || project.draft.blocks.length"
      v-model="project.draft.blocks"
      :target="project.draft.brief.length"
      :disabled="project.busy"
    />
    <UiSegmentedControl v-model="project.draft.format" label="Format" :options="FORMAT_OPTIONS" />
    <UiSegmentedControl
      v-model="project.draft.language"
      label="Language"
      :options="
        LANGUAGES.map((language) => ({
          value: language.code,
          label: `${language.native}${language.code === 'en' ? '' : ` · ${language.name}`}`,
        }))
      "
    />
    <div class="flex flex-col gap-1.5">
      <span class="text-sm font-semi-bold text-light-600"
        >Will this video be used commercially?</span
      >
      <div class="flex gap-2" role="radiogroup" aria-label="Commercial use">
        <button
          v-for="option in USAGE"
          :key="String(option.value)"
          type="button"
          role="radio"
          :aria-checked="project.draft.commercial === option.value"
          class="flex-1 rounded-md border px-3 py-2 text-left text-sm"
          :class="
            project.draft.commercial === option.value
              ? 'border-accent-400 bg-dark-500 text-white'
              : 'border-dark-600 text-light-400 hover:text-white'
          "
          @click="project.draft.commercial = option.value"
        >
          <span class="block font-semi-bold">{{ option.label }}</span>
          <span class="text-xs">{{ option.detail }}</span>
        </button>
      </div>
    </div>
    <ModelSettings />

    <p v-if="project.busy" class="text-sm text-light-400" role="status">{{ project.progress }}…</p>
    <p
      v-if="project.error"
      class="rounded-md bg-alert-600 px-3 py-2 text-sm text-white"
      role="alert"
    >
      {{ project.error }}
    </p>

    <template #note>{{ blocker ?? 'Next: the story outline (about a minute)' }}</template>
    <template #actions>
      <UiButton variant="ghost" :disabled="project.busy" @click="router.push(STEPS[1].path)"
        >Back</UiButton
      >
      <UiButton v-if="project.busy" variant="ghost" @click="project.cancel()">Cancel</UiButton>
      <UiButton
        v-else-if="project.composition"
        variant="secondary"
        @click="router.push(STEPS[stepIndex('story')].path)"
        >Open story</UiButton
      >
      <UiButton :disabled="!!blocker || project.busy" @click="writeStory">
        {{ project.composition ? 'Rewrite story' : 'Write the story' }}
      </UiButton>
    </template>

    <template #preview>
      <LivePreview
        :composition="preview"
        :media="styles.media(project.draftStyle)"
        label="Style preview"
      />
    </template>
  </WizardShell>
</template>