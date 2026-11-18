<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import UiTextField from '@/components/ui/UiTextField.vue'
import { TASKS, TASK_LABEL, type Task } from '@/core/models/catalog'
import { capable } from '@/core/models/router'
import { useProjectStore } from '@/stores/project'
import { useSettingsStore } from '@/stores/settings'

const settings = useSettingsStore()
const project = useProjectStore()
const open = ref(false)

onMounted(() => {
  if (settings.models.length === 0) void settings.refresh()
})

/** The route for every task, for this video's language and licence needs. */
const rows = computed(() =>
  TASKS.map((task) => ({
    task,
    route: settings.pick(task, project.need()),
    options: settings.models.filter((model) => capable(model, task)),
  })),
)

const missing = computed(() =>
  rows.value.filter((row) => !row.route && ['write', 'speak', 'draw'].includes(row.task)),
)

function pin(task: Task, model: string) {
  settings.saved.pins = { ...settings.saved.pins, [task]: model }
}

const selectClass =
  'h-8 w-full rounded-md border border-dark-600 bg-dark-500 px-2 text-xs text-white outline-none focus:border-accent-400'
</script>

<template>
  <section class="flex flex-col gap-3 rounded-lg border border-dark-600 p-3" aria-label="Models">
    <div class="flex items-end gap-2">
      <UiTextField
        v-model="settings.saved.baseUrl"
        class="flex-1"
        label="Model server"
        hint="OpenAI-compatible"
        @change="settings.refresh()"
      />
      <button
        type="button"
        class="h-9.5 rounded-md border border-dark-600 px-3 text-xs font-semi-bold text-white hover:border-light-400"
        :disabled="settings.loading"
        @click="settings.refresh(true)"
      >
        {{ settings.loading ? 'Loading…' : 'Reload' }}
      </button>
    </div>
    <p v-if="settings.error" class="text-xs text-alert-400" role="alert">{{ settings.error }}</p>
    <p v-else-if="missing.length" class="text-xs text-warning-400">
      The server has no model for {{ missing.map((row) => TASK_LABEL[row.task]).join(', ') }}.
    </p>

    <button
      type="button"
      class="flex items-center justify-between text-left text-sm font-semi-bold text-light-600"
      :aria-expanded="open"
      @click="open = !open"
    >
      <span>Models: chosen automatically for each job</span>
      <span class="text-xs text-light-400">{{ open ? 'Hide' : 'Show' }}</span>
    </button>

    <div v-if="open" class="flex flex-col gap-2">
      <div v-for="row in rows" :key="row.task" class="grid grid-cols-[9rem_1fr] items-start gap-2">
        <span class="pt-1.5 text-xs text-light-500">{{ TASK_LABEL[row.task] }}</span>
        <div class="flex flex-col gap-0.5">
          <select
            :value="settings.saved.pins[row.task] ?? ''"
            :class="selectClass"
            :aria-label="TASK_LABEL[row.task]"
            @change="pin(row.task, ($event.target as HTMLSelectElement).value)"
          >
            <option value="">
              Auto{{ row.route ? ` · ${row.route.model}` : ' · none available' }}
            </option>
            <option v-for="model in row.options" :key="model.id" :value="model.id">
              {{ model.id }}{{ settings.down.has(model.id) ? ' (unavailable)' : '' }}
            </option>
          </select>
          <span v-if="row.route" class="text-2xs text-light-400">{{ row.route.reason }}</span>
          <span
            v-for="warning in row.route?.warnings ?? []"
            :key="warning"
            class="text-2xs text-warning-400"
          >
            {{ warning }}
          </span>
        </div>
      </div>
      <p v-if="settings.down.size" class="text-2xs text-alert-400">
        Skipped this session:
        <span v-for="[model, reason] in settings.down" :key="model" class="block"
          >{{ model }}: {{ reason }}</span
        >
      </p>
    </div>
  </section>
</template>