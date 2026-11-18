<script setup lang="ts">
import { computed } from 'vue'

import type { Brief } from '@/core/agent'
import { getKind, lengthLabel } from '@/core/kinds'

const props = defineProps<{
  kindId: string
  disabled?: boolean
  /** The source video's narration is kept word for word, so its length wins. */
  keptWording?: boolean
}>()
const brief = defineModel<Brief>({ required: true })

const TONES = ['Warm', 'Calm', 'Confident', 'Playful', 'Inspiring', 'Urgent', 'Expert']

const kind = computed(() => getKind(props.kindId))
const tones = computed(() =>
  brief.value.tone
    .split(',')
    .map((tone) => tone.trim())
    .filter(Boolean),
)

function toggleTone(tone: string) {
  const next = tones.value.includes(tone)
    ? tones.value.filter((item) => item !== tone)
    : [...tones.value, tone].slice(-2)
  brief.value = { ...brief.value, tone: next.join(', ') }
}

const set = (field: 'goal' | 'audience' | 'cta', event: Event) =>
  (brief.value = { ...brief.value, [field]: (event.target as HTMLInputElement).value })

const chip = (active: boolean) =>
  active
    ? 'border-accent-400 bg-dark-500 text-white'
    : 'border-dark-600 text-light-400 hover:text-white'
const inputClass =
  'h-8 w-full rounded-md border border-dark-600 bg-dark-500 px-2 text-sm text-white outline-none placeholder:text-light-400 focus:border-accent-400'
</script>

<template>
  <section class="flex flex-col gap-3 rounded-lg border border-dark-600 p-3" aria-label="Brief">
    <div class="flex items-baseline justify-between">
      <h2 class="text-sm font-semi-bold text-light-600">Brief</h2>
      <span class="text-2xs text-light-400">{{ kind.name }} · every field optional</span>
    </div>
    <div class="grid grid-cols-2 gap-2">
      <label class="flex flex-col gap-1 text-xs text-light-500">
        Goal
        <input
          :value="brief.goal"
          :class="inputClass"
          :disabled="disabled"
          placeholder="e.g. get sign-ups for the trial"
          @change="set('goal', $event)"
        />
      </label>
      <label class="flex flex-col gap-1 text-xs text-light-500">
        Audience
        <input
          :value="brief.audience"
          :class="inputClass"
          :disabled="disabled"
          placeholder="e.g. busy parents"
          @change="set('audience', $event)"
        />
      </label>
      <label class="col-span-2 flex flex-col gap-1 text-xs text-light-500">
        Call to action
        <input
          :value="brief.cta"
          :class="inputClass"
          :disabled="disabled"
          placeholder="e.g. Try it free at acme.com"
          @change="set('cta', $event)"
        />
      </label>
    </div>
    <div class="flex flex-col gap-1">
      <span class="text-xs text-light-500">Tone (up to two)</span>
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="tone in TONES"
          :key="tone"
          type="button"
          :aria-pressed="tones.includes(tone)"
          class="rounded-full border px-2.5 py-0.5 text-xs"
          :class="chip(tones.includes(tone))"
          :disabled="disabled"
          @click="toggleTone(tone)"
        >
          {{ tone }}
        </button>
      </div>
    </div>
    <div class="flex flex-col gap-1">
      <span class="text-xs text-light-500">Length</span>
      <div class="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Length">
        <button
          v-for="seconds in [...kind.lengths, 0]"
          :key="seconds"
          type="button"
          role="radio"
          :aria-checked="brief.length === seconds"
          class="rounded-full border px-2.5 py-0.5 text-xs"
          :class="chip(brief.length === seconds)"
          :disabled="disabled"
          @click="brief = { ...brief, length: seconds }"
        >
          {{ seconds ? lengthLabel(seconds) : 'Fit the script' }}
        </button>
      </div>
      <p v-if="keptWording && brief.length" class="text-2xs text-warning-400">
        The video's narration is kept word for word, so the length follows the original. Untick
        "Keep the original narration" to cut it to {{ lengthLabel(brief.length) }}.
      </p>
    </div>
  </section>
</template>