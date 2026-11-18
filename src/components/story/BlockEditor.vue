<script setup lang="ts">
import { computed } from 'vue'

import {
  block,
  blockSeconds,
  mergeBlocks,
  renumberSteps,
  splitBlock,
  type Block,
} from '@/core/blocks'

const props = defineProps<{
  /** Target length in seconds (0 = none), for the running total. */
  target?: number
  disabled?: boolean
}>()
const blocks = defineModel<Block[]>({ required: true })

const total = computed(() =>
  Math.round(blocks.value.reduce((sum, item) => sum + blockSeconds(item), 0)),
)
const hasSteps = computed(() => blocks.value.some((item) => item.step.trim()))

function update(index: number, patch: Partial<Block>) {
  blocks.value = blocks.value.map((item, at) => (at === index ? { ...item, ...patch } : item))
}

function insert(index: number) {
  const next = [...blocks.value]
  next.splice(index, 0, block())
  blocks.value = next
}

function remove(index: number) {
  blocks.value = blocks.value.filter((_, at) => at !== index)
}

function move(index: number, by: -1 | 1) {
  const to = index + by
  if (to < 0 || to >= blocks.value.length) return
  const next = [...blocks.value]
  ;[next[index], next[to]] = [next[to]!, next[index]!]
  blocks.value = hasSteps.value ? renumberSteps(next) : next
}

function split(index: number) {
  const parts = splitBlock(blocks.value[index]!)
  if (!parts) return
  const next = [...blocks.value]
  next.splice(index, 1, ...parts)
  blocks.value = next
}

function merge(index: number) {
  const next = [...blocks.value]
  next.splice(index, 2, mergeBlocks(next[index]!, next[index + 1]!))
  blocks.value = hasSteps.value ? renumberSteps(next) : next
}

function toggleStep(index: number) {
  const item = blocks.value[index]!
  const next = blocks.value.map((current, at) =>
    at === index ? { ...current, step: item.step ? '' : '00/00' } : current,
  )
  blocks.value = renumberSteps(next)
}

const value = (event: Event) => (event.target as HTMLInputElement | HTMLTextAreaElement).value
const field =
  'w-full rounded-md border border-transparent bg-transparent px-2 py-1 text-sm text-white outline-none placeholder:text-light-400 hover:border-dark-600 focus:border-accent-400 focus:bg-dark-500'
const tool =
  'rounded px-1.5 py-0.5 text-2xs text-light-400 hover:bg-dark-600 hover:text-white disabled:opacity-40'
</script>

<template>
  <section class="flex flex-col gap-2" aria-label="Scene blocks">
    <div class="flex items-baseline justify-between">
      <h2 class="text-sm font-semi-bold text-light-600">Scenes</h2>
      <span
        class="text-2xs tabular-nums"
        :class="props.target && total > props.target * 1.25 ? 'text-warning-400' : 'text-light-400'"
      >
        {{ blocks.length }} blocks · about {{ total }} s of narration{{
          props.target ? ` of ${props.target} s` : ''
        }}
      </span>
    </div>

    <p v-if="blocks.length === 0" class="text-xs text-light-400">
      Add a block per scene, paste a script, or adapt a video. Leave fields empty and the writer
      fills them.
    </p>

    <article
      v-for="(item, index) in blocks"
      :key="item.id"
      class="flex flex-col gap-0.5 rounded-md border border-dark-600 p-2"
    >
      <div class="flex items-center gap-1">
        <span class="w-6 shrink-0 text-xs text-light-400 tabular-nums">{{ index + 1 }}</span>
        <input
          :value="item.chapter"
          :class="[field, 'flex-1 text-2xs font-bold tracking-[0.12em] text-light-500 uppercase']"
          placeholder="new chapter (optional)"
          aria-label="Chapter starting here"
          :disabled="disabled"
          @change="update(index, { chapter: value($event) })"
        />
        <button
          type="button"
          :class="tool"
          :disabled="disabled || index === 0"
          aria-label="Move up"
          @click="move(index, -1)"
        >
          ↑
        </button>
        <button
          type="button"
          :class="tool"
          :disabled="disabled || index === blocks.length - 1"
          aria-label="Move down"
          @click="move(index, 1)"
        >
          ↓
        </button>
        <button type="button" :class="tool" :disabled="disabled" @click="split(index)">
          Split
        </button>
        <button
          type="button"
          :class="tool"
          :disabled="disabled || index === blocks.length - 1"
          @click="merge(index)"
        >
          Merge ↓
        </button>
        <button
          type="button"
          :class="tool"
          :disabled="disabled"
          :aria-pressed="!!item.step"
          @click="toggleStep(index)"
        >
          Step
        </button>
        <button
          type="button"
          :class="[tool, 'hover:text-alert-400']"
          :disabled="disabled"
          aria-label="Remove block"
          @click="remove(index)"
        >
          ×
        </button>
      </div>
      <div class="flex items-center gap-1 pl-6">
        <span
          v-if="item.step"
          class="shrink-0 rounded bg-dark-600 px-1.5 text-2xs text-light-500 tabular-nums"
          >{{ item.step }}</span
        >
        <input
          :value="item.headline"
          :class="[field, 'font-bold']"
          placeholder="Headline"
          aria-label="Headline"
          :disabled="disabled"
          @change="update(index, { headline: value($event) })"
        />
      </div>
      <input
        :value="item.visual"
        :class="[field, 'ml-6 w-[calc(100%-1.5rem)] text-xs text-light-400 italic']"
        placeholder="What the visual shows (optional)"
        aria-label="Visual idea"
        :disabled="disabled"
        @change="update(index, { visual: value($event) })"
      />
      <textarea
        :value="item.narration"
        rows="2"
        :class="[field, 'ml-6 w-[calc(100%-1.5rem)] resize-y text-light-600']"
        placeholder="What is said"
        aria-label="Narration"
        :disabled="disabled"
        @change="update(index, { narration: value($event) })"
      />
      <span class="pl-8 text-2xs text-light-400 tabular-nums"
        >≈ {{ Math.round(blockSeconds(item)) }} s</span
      >
    </article>

    <button
      type="button"
      class="self-start rounded-md border border-dashed border-dark-600 px-3 py-1.5 text-xs text-light-400 hover:text-white"
      :disabled="disabled"
      @click="insert(blocks.length)"
    >
      + Add a scene
    </button>
  </section>
</template>