<script setup lang="ts">
import { ref } from 'vue'

import { useProjectStore } from '@/stores/project'

const props = defineProps<{
  suggestions: string[]
  /** A scene is selected: "this" refers to it. */
  focused: boolean
}>()
const emit = defineEmits<{ send: [text: string] }>()

const project = useProjectStore()
const prompt = ref('')

function send(text = prompt.value) {
  if (!text.trim() || project.busy) return
  prompt.value = ''
  emit('send', text)
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault()
    send()
  }
}

defineExpose({ send, prompt })
</script>

<template>
  <section v-if="project.chat.length" class="flex flex-col gap-2" aria-label="Conversation">
    <p
      v-for="(entry, index) in project.chat"
      :key="index"
      class="rounded-md px-3 py-2 text-sm"
      :class="
        entry.role === 'user'
          ? 'self-end bg-accent-500 text-white'
          : entry.error
            ? 'bg-alert-600/20 text-alert-400'
            : 'bg-dark-500 text-light-600'
      "
    >
      {{ entry.text }}
    </p>
  </section>

  <div class="flex flex-col gap-2">
    <textarea
      v-model="prompt"
      rows="3"
      class="w-full resize-none rounded-md border border-dark-600 bg-dark-500 px-3 py-2 text-sm text-white outline-none placeholder:text-light-400 focus:border-accent-400"
      :placeholder="
        props.focused
          ? 'Change this scene… (Ctrl+Enter to send)'
          : 'Describe a change (Ctrl+Enter to send)'
      "
      :disabled="project.busy"
      aria-label="Change request"
      @keydown="onKeydown"
    />
    <div class="flex flex-wrap gap-1.5">
      <button
        v-for="suggestion in props.suggestions"
        :key="suggestion"
        type="button"
        class="rounded-full border border-dark-600 px-2.5 py-1 text-xs text-light-500 hover:border-light-400 hover:text-white disabled:opacity-40"
        :disabled="project.busy"
        @click="send(suggestion)"
      >
        {{ suggestion }}
      </button>
    </div>
  </div>
</template>