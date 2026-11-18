<script setup lang="ts">
import { computed } from 'vue'

import { spokenWords, type Scene } from '@/core/composition/schema'
import { profile } from '@/core/models/catalog'
import { useProjectStore } from '@/stores/project'
import { useSettingsStore } from '@/stores/settings'

const emit = defineEmits<{ select: [sceneId: string] }>()

const project = useProjectStore()
const settings = useSettingsStore()

const scenes = computed(() => project.composition?.scenes ?? [])
const speaker = computed(() => {
  const current = project.composition
  if (!current) return ''
  const clone = current.voice.mode === 'clone' && settings.modelFor('clone', project.need())
  return clone || settings.modelFor('speak', project.need())
})
/** The routed voice model reads delivery tags such as [whisper]. */
const tags = computed(() => !!profile(speaker.value)?.tags)

/** Peaks for a small waveform: one bar per slice of the clip. */
function peaks(buffer: AudioBuffer, bars = 64): number[] {
  const data = buffer.getChannelData(0)
  const step = Math.max(1, Math.floor(data.length / bars))
  return Array.from({ length: bars }, (_, bar) => {
    let peak = 0
    for (let i = bar * step; i < Math.min(data.length, (bar + 1) * step); i += 16)
      peak = Math.max(peak, Math.abs(data[i]!))
    return peak
  })
}

const lines = computed(() =>
  scenes.value.map((scene, index) => {
    const narration = project.voices.get(scene.id)
    return {
      scene,
      index,
      seconds: narration?.buffer.duration ?? null,
      bars: narration ? peaks(narration.buffer) : [],
      words: narration?.words ?? [],
      count: spokenWords(scene.voiceover).split(/\s+/).filter(Boolean).length,
    }
  }),
)

function setNarration(scene: Scene, text: string) {
  if (text === scene.voiceover) return
  project.change('Edited narration', (next) => {
    const target = next.scenes.find((item) => item.id === scene.id)
    if (target) target.voiceover = text
  })
  // Only the changed line is recorded again; the rest come from the cache.
  void project.run(project.voice)
}

let player: AudioBufferSourceNode | null = null
let context: AudioContext | null = null
function play(sceneId: string) {
  const narration = project.voices.get(sceneId)
  if (!narration) return
  player?.stop()
  context ??= new AudioContext()
  player = context.createBufferSource()
  player.buffer = narration.buffer
  player.connect(context.destination)
  player.start()
}

const value = (event: Event) => (event.target as HTMLTextAreaElement).value
const smallButton =
  'rounded-md border border-dark-600 px-2 py-0.5 text-2xs font-semi-bold text-white hover:border-light-400 disabled:opacity-40'
</script>

<template>
  <section class="flex flex-col gap-2" aria-label="Narration">
    <p class="text-xs text-light-400">
      Voice: {{ speaker || 'none available' }}.
      <template v-if="tags">
        Delivery tags such as <code>[whisper]</code>, <code>[laughs]</code> or
        <code>[excited]</code> are understood.
      </template>
      <template v-else>Text in [brackets] is not spoken.</template>
      Editing a line records only that line again.
    </p>
    <article
      v-for="line in lines"
      :key="line.scene.id"
      class="flex flex-col gap-1 rounded-md border border-dark-600 p-2"
    >
      <header class="flex items-center gap-2">
        <button
          type="button"
          class="w-6 text-left text-xs text-light-400 tabular-nums hover:text-white"
          @click="emit('select', line.scene.id)"
        >
          {{ line.index + 1 }}
        </button>
        <span class="min-w-0 flex-1 truncate text-xs font-bold text-white">
          {{ line.scene.chrome.headline || '—' }}
        </span>
        <span class="text-2xs text-light-400 tabular-nums">
          {{ line.count }} words{{ line.seconds ? ` · ${line.seconds.toFixed(1)} s` : '' }}
        </span>
        <button
          type="button"
          :class="smallButton"
          :disabled="!line.seconds"
          @click="play(line.scene.id)"
        >
          Play
        </button>
        <button
          type="button"
          :class="smallButton"
          :disabled="project.busy || !line.count"
          title="Record this line again"
          @click="project.retake(line.scene.id)"
        >
          New take
        </button>
      </header>
      <textarea
        :value="line.scene.voiceover"
        rows="2"
        class="w-full resize-none rounded-md border border-transparent bg-transparent px-1 py-0.5 text-sm text-light-600 outline-none hover:border-dark-600 focus:border-accent-400 focus:bg-dark-500"
        aria-label="Narration"
        :disabled="project.busy"
        @change="setNarration(line.scene, value($event))"
      />
      <div v-if="line.bars.length" class="flex h-6 items-center gap-px" aria-hidden="true">
        <span
          v-for="(bar, index) in line.bars"
          :key="index"
          class="flex-1 rounded-full bg-accent-400/70"
          :style="{ height: `${Math.max(8, bar * 100)}%` }"
        />
      </div>
      <p v-if="line.words.length" class="flex flex-wrap gap-x-1.5 text-2xs text-light-400">
        <span
          v-for="(word, index) in line.words"
          :key="index"
          :title="`${word.start.toFixed(2)} s`"
        >
          {{ word.word }}
        </span>
      </p>
    </article>
  </section>
</template>