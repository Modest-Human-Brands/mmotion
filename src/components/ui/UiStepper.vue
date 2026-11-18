<script setup lang="ts">
defineProps<{
  steps: string[]
  current: number
  /** Steps up to this index can be opened by clicking. */
  reachable?: number
}>()
const emit = defineEmits<{ go: [index: number] }>()
</script>

<template>
  <ol class="flex gap-2">
    <li v-for="(label, index) in steps" :key="label" class="flex min-w-0 flex-1 flex-col gap-2">
      <span
        class="h-1 rounded-full"
        :class="index <= current ? 'bg-accent-500' : 'bg-dark-600'"
        aria-hidden="true"
      />
      <button
        type="button"
        class="truncate text-left text-xs font-semi-bold outline-none focus-visible:shadow-focus-ring disabled:cursor-default"
        :class="
          index === current
            ? 'text-white'
            : index <= (reachable ?? -1)
              ? 'text-light-400 hover:text-white'
              : 'text-light-400/60'
        "
        :aria-current="index === current ? 'step' : undefined"
        :disabled="index === current || index > (reachable ?? -1)"
        @click="emit('go', index)"
      >
        {{ index < current ? '✓ ' : `${index + 1} ` }}{{ label }}
      </button>
    </li>
  </ol>
</template>