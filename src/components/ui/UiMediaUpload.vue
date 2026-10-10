<script setup lang="ts">
import IconImagePlus from '~icons/lucide/image-plus'
import IconX from '~icons/lucide/x'
import { computed, onBeforeUnmount, ref, useTemplateRef } from 'vue'

import { kindOfFile, mediaKind, tagMediaUrl } from '@/domain/media'

const model = defineModel<string>({ required: true })

const props = withDefaults(
  defineProps<{ label: string; accept?: string; error?: string; maxMb?: number }>(),
  { accept: 'image/*,video/mp4,video/webm,.riv', maxMb: 200 },
)

const input = useTemplateRef<HTMLInputElement>('input')
const failure = ref<string | null>(null)
let owned: string | null = null

const kind = computed(() => (model.value ? mediaKind(model.value) : null))
const fileName = ref('')

function release() {
  if (owned) URL.revokeObjectURL(owned.split('#')[0]!)
  owned = null
}

function onPick(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  target.value = ''
  if (!file) return
  const picked = kindOfFile(file)
  if (!picked) {
    failure.value = 'Use an image, an MP4/WebM video or a Rive (.riv) file.'
    return
  }
  if (file.size > props.maxMb * 1024 * 1024) {
    failure.value = `The file is larger than ${props.maxMb} MB.`
    return
  }
  failure.value = null
  release()
  owned = tagMediaUrl(URL.createObjectURL(file), picked)
  fileName.value = file.name
  model.value = owned
}

function clear() {
  release()
  fileName.value = ''
  model.value = ''
}

onBeforeUnmount(release)
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <span class="text-sm font-semi-bold text-light-600">{{ label }}</span>
    <div
      class="flex h-16 items-center gap-3 rounded-md border border-dark-600 p-3"
      :class="model ? '' : 'border-dashed'"
    >
      <span
        class="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-dark-500"
      >
        <img v-if="kind === 'image'" :src="model" alt="" class="size-full object-cover" />
        <video v-else-if="kind === 'video'" :src="model" muted class="size-full object-cover" />
        <span v-else-if="kind === 'rive'" class="text-xs font-bold text-light-400">RIV</span>
        <IconImagePlus
          v-else
          class="size-4.5 text-dark-600 [--icon-stroke:1.5]"
          aria-hidden="true"
        />
      </span>
      <span class="flex min-w-0 flex-1 flex-col gap-0.5">
        <span class="truncate text-sm font-semi-bold text-white">
          {{ fileName || (model ? 'Template default' : 'No media yet') }}
        </span>
        <span class="text-xs text-light-400">Image, MP4/WebM or Rive. Stays on this device.</span>
      </span>
      <button
        v-if="model"
        type="button"
        class="text-light-400 hover:text-white"
        aria-label="Remove media"
        @click="clear"
      >
        <IconX class="size-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        class="rounded-md border border-dark-600 px-3 py-1.5 text-xs font-semi-bold text-white hover:border-light-400"
        @click="input?.click()"
      >
        {{ model ? 'Replace' : 'Upload' }}
      </button>
      <input ref="input" type="file" class="hidden" :accept="accept" @change="onPick" />
    </div>
    <p v-if="failure || error" class="text-xs text-alert-400" role="alert">
      {{ failure ?? error }}
    </p>
  </div>
</template>