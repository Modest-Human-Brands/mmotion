<script setup lang="ts">
import { computed } from 'vue'

import { progressAt } from '../beats'
import { elementProps } from './types'

const props = defineProps(elementProps)

// Numbers count up ("40%" from 0%); anything else simply appears.
const display = computed(() => {
  const match = /^(\D*)(\d+(?:[.,]\d+)?)(.*)$/.exec(props.element.text.trim())
  if (!match) return props.element.text
  const [, prefix, number, suffix] = match
  const target = Number.parseFloat(number!.replace(',', '.'))
  const decimals = number!.includes('.') || number!.includes(',') ? 1 : 0
  const value = target * progressAt(props.local, 0.4, 1.4)
  return `${prefix}${value.toFixed(decimals)}${suffix}`
})
</script>

<template>
  <div class="flex size-full flex-col items-center justify-center gap-[2cqmin] text-center">
    <p
      data-enter
      class="font-(family-name:--font-display) text-[24cqmin] leading-none font-bold text-(--c-accent) tabular-nums"
    >
      {{ display }}
    </p>
    <p
      data-enter
      class="max-w-[80%] font-(family-name:--font-body) text-[4cqmin] text-balance text-(--c-text)"
    >
      {{ element.subtext }}
    </p>
  </div>
</template>