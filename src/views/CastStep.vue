<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

import StyleControl from '@/components/studio/StyleControl.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiSegmentedControl from '@/components/ui/UiSegmentedControl.vue'
import WizardShell from '@/components/wizard/WizardShell.vue'
import type { Difference } from '@/core/agent/vision'
import type { CastMember } from '@/core/composition/schema'
import { sceneStyle } from '@/core/styles'
import { usePicturesStore } from '@/stores/pictures'
import { STEPS, stepIndex, useProjectStore } from '@/stores/project'
import { useSettingsStore } from '@/stores/settings'

defineOptions({ name: 'CastStep' })

const router = useRouter()
const project = useProjectStore()
const pictures = usePicturesStore()
const settings = useSettingsStore()

const members = computed(() => project.composition?.cast.members ?? [])
const videoStyle = computed(() => (project.composition ? sceneStyle(project.composition).name : ''))
const url = (id: string) => (id ? (pictures.assetUrls.get(id) ?? null) : null)
const value = (event: Event) => (event.target as HTMLInputElement | HTMLTextAreaElement).value
const file = (event: Event) => {
  const input = event.target as HTMLInputElement
  const picked = input.files?.[0] ?? null
  input.value = ''
  return picked
}

/** Members that still need a look before scenes can be drawn from them. */
const missing = computed(() => members.value.filter((member) => !member.sheet))

/** Open "make like a reference" panels: the reference and the differences to choose from. */
const restyling = reactive(
  new Map<string, { asset: string; differences: Difference[]; chosen: Set<number> }>(),
)
/** Takes made from a reference carry the changes, so choosing one updates the description. */
const takeNotes = new Map<string, string>()

function update(member: CastMember, patch: Partial<CastMember>) {
  project.updateMember(member.name, patch)
}

function rename(member: CastMember, name: string) {
  const clean = name.trim()
  if (!clean || clean === member.name) return
  if (members.value.some((item) => item.name.toLowerCase() === clean.toLowerCase())) {
    project.error = `There is already someone called ${clean}.`
    return
  }
  update(member, { name: clean })
}

async function addReference(member: CastMember, event: Event) {
  const picked = file(event)
  if (picked) await pictures.addReference(member, picked)
}

async function compare(member: CastMember, event: Event) {
  const picked = file(event)
  if (!picked) return
  const result = await pictures.compare(member, picked)
  if (result)
    restyling.set(member.name, {
      ...result,
      chosen: new Set(result.differences.map((_, index) => index)),
    })
}

function toggle(name: string, index: number) {
  const panel = restyling.get(name)
  if (!panel) return
  if (panel.chosen.has(index)) panel.chosen.delete(index)
  else panel.chosen.add(index)
}

async function applyRestyle(member: CastMember) {
  const panel = restyling.get(member.name)
  if (!panel) return
  const changes = panel.differences
    .filter((_, index) => panel.chosen.has(index))
    .map(
      (difference) =>
        `${difference.aspect}: ${difference.reference} (instead of ${difference.current})`,
    )
  if (changes.length === 0) return
  const before = new Set(pictures.takes.get(member.name)?.map((take) => take.asset))
  await pictures.restyle(member, panel.asset, changes)
  const fresh = (pictures.takes.get(member.name) ?? []).filter((take) => !before.has(take.asset))
  // Keep the choices open when drawing failed, so the user can simply try again.
  if (fresh.length === 0) return
  for (const take of fresh)
    takeNotes.set(
      take.asset,
      panel.differences
        .filter((_, index) => panel.chosen.has(index))
        .map((difference) => `${difference.aspect}: ${difference.reference}`)
        .join('; '),
    )
  restyling.delete(member.name)
}

function choose(member: CastMember, asset: string) {
  const note = takeNotes.get(asset)
  project.updateMember(
    member.name,
    note ? { sheet: asset, description: `${member.description}; ${note}` } : { sheet: asset },
    `New look for ${member.name}`,
  )
}

async function drawMissing() {
  // Exact objects need no drawing; then draw the rest, carrying on past a failure.
  for (const member of missing.value)
    if (member.exact && member.refs[0]) pictures.useReferenceAsSheet(member)
  const failed: string[] = []
  for (const member of missing.value.filter((item) => !item.exact)) {
    await pictures.drawSheets(member)
    if (project.error) failed.push(member.name)
  }
  if (failed.length) project.error = `Could not draw ${failed.join(', ')}. Try Draw again on each.`
}

// ------------------------------------------------------------------ narrator voice

const voice = computed(() => project.composition?.voice)
const sampleText = ref('')
const sampleLine = computed(
  () =>
    project.composition?.scenes.find((scene) => scene.voiceover.trim())?.voiceover ??
    'Hello! This is how the narration will sound.',
)

async function uploadSample(event: Event) {
  const picked = file(event)
  if (!picked) return
  const asset = await pictures.addAsset(picked)
  project.setVoice({ mode: 'clone', sample: asset, sampleText: sampleText.value })
}

let player: AudioBufferSourceNode | null = null
async function hear() {
  const buffer = await project.previewVoice(sampleLine.value)
  if (!buffer) return
  player?.stop()
  const context = new AudioContext()
  player = context.createBufferSource()
  player.buffer = buffer
  player.connect(context.destination)
  player.start()
}

async function approve() {
  if (
    missing.value.length > 0 &&
    !window.confirm(
      `${missing.value.map((member) => member.name).join(', ')} ${missing.value.length > 1 ? 'have' : 'has'} no approved look and will be drawn from the description only, so they may change between pictures. Continue?`,
    )
  )
    return
  project.approve('cast')
  await router.push(STEPS[stepIndex('storyboard')].path)
}

const fieldClass =
  'w-full rounded-md border border-dark-600 bg-dark-500 px-2 py-1.5 text-sm text-white outline-none focus:border-accent-400'
const smallButton =
  'rounded-md border border-dark-600 px-2.5 py-1 text-xs font-semi-bold text-white hover:border-light-400 disabled:opacity-40'
</script>

<template>
  <WizardShell
    v-if="project.composition"
    :step="stepIndex('cast')"
    title="Cast"
    subtitle="Everyone and everything that recurs gets one approved look, and every picture is drawn from it, so they stay the same. Draw, pick from options, or show a reference you like."
  >
    <p
      v-if="!settings.modelFor('drawFromRefs', project.need())"
      class="rounded-md bg-warning-500/15 px-3 py-2 text-xs text-warning-400"
    >
      The server has no model that draws from references (or it is unavailable): pictures will be
      drawn from descriptions and characters may change between scenes.
    </p>

    <StyleControl />
    <p
      v-if="pictures.staleSheets.length"
      class="flex items-center gap-2 rounded-md bg-dark-500 px-3 py-2 text-xs text-light-500"
    >
      <span class="flex-1"
        >{{ pictures.staleSheets.map((member) => member.name).join(', ') }}
        {{ pictures.staleSheets.length > 1 ? 'were' : 'was' }} drawn in another art style. Pictures
        still keep them recognisable; redraw the sheets to match.</span
      >
      <UiButton variant="secondary" :disabled="project.busy" @click="pictures.redrawStale()"
        >Redraw in {{ videoStyle }}</UiButton
      >
    </p>

    <article
      v-for="member in members"
      :key="member.name"
      class="flex flex-col gap-2 rounded-lg border border-dark-600 p-3"
    >
      <header class="flex items-center gap-2">
        <input
          :value="member.name"
          :class="[fieldClass, 'flex-1 font-bold']"
          aria-label="Name"
          :disabled="project.busy || member.locked"
          @change="rename(member, value($event))"
        />
        <select
          :value="member.kind"
          class="w-32 shrink-0 rounded-md border border-dark-600 bg-dark-500 px-2 py-1.5 text-sm text-white outline-none focus:border-accent-400"
          aria-label="Kind"
          :disabled="project.busy || member.locked"
          @change="update(member, { kind: value($event) as CastMember['kind'] })"
        >
          <option value="character">Character</option>
          <option value="object">Object</option>
        </select>
        <label
          class="flex items-center gap-1 text-xs text-light-400"
          title="Prompts never change a locked member"
        >
          <input
            type="checkbox"
            :checked="member.locked"
            @change="update(member, { locked: !member.locked })"
          />
          Lock
        </label>
        <button
          type="button"
          class="px-1 text-light-400 hover:text-alert-400"
          aria-label="Remove"
          :disabled="project.busy || member.locked"
          @click="project.removeMember(member.name)"
        >
          ×
        </button>
      </header>

      <div class="flex gap-3">
        <div class="flex w-36 shrink-0 flex-col gap-1.5">
          <div
            class="relative flex aspect-square items-center justify-center overflow-hidden rounded-md bg-white"
          >
            <img
              v-if="url(member.sheet)"
              :src="url(member.sheet)!"
              :alt="`${member.name}, approved look`"
              class="size-full object-contain"
            />
            <span v-else class="px-2 text-center text-xs text-dark-400">
              {{ pictures.drawing === member.name ? 'Drawing…' : 'No look yet' }}
            </span>
          </div>
          <div class="flex flex-wrap gap-1">
            <button
              v-if="member.exact && member.refs[0]"
              type="button"
              :class="smallButton"
              :disabled="project.busy || member.locked"
              @click="pictures.useReferenceAsSheet(member)"
            >
              Use reference
            </button>
            <template v-else>
              <button
                type="button"
                :class="smallButton"
                :disabled="project.busy || member.locked"
                @click="pictures.drawSheets(member, 1)"
              >
                {{ member.sheet ? 'Redraw' : 'Draw' }}
              </button>
              <button
                type="button"
                :class="smallButton"
                :disabled="project.busy || member.locked"
                @click="pictures.drawSheets(member, 3)"
              >
                3 options
              </button>
            </template>
          </div>
        </div>

        <div class="flex min-w-0 flex-1 flex-col gap-2">
          <textarea
            :value="member.description"
            rows="3"
            :class="[fieldClass, 'resize-none']"
            placeholder="Age, hair, skin, clothes and colours; or shape, colours and markings"
            aria-label="Description"
            :disabled="project.busy || member.locked"
            @change="update(member, { description: value($event) })"
          />

          <div class="flex flex-wrap items-center gap-1.5">
            <span class="text-xs text-light-400">References</span>
            <img
              v-for="ref in member.refs"
              :key="ref"
              :src="url(ref) ?? undefined"
              alt="Reference"
              class="size-10 rounded bg-white object-contain"
            />
            <label :class="[smallButton, 'cursor-pointer']">
              + Add
              <input
                type="file"
                accept="image/*"
                class="hidden"
                :disabled="project.busy || member.locked"
                @change="addReference(member, $event)"
              />
            </label>
          </div>

          <div v-if="member.refs.length" class="flex items-center gap-3 text-xs text-light-500">
            <label class="flex items-center gap-1">
              <input
                type="radio"
                :checked="member.look === 'template'"
                :disabled="member.locked"
                @change="update(member, { look: 'template' })"
              />
              Video art style ({{ videoStyle }})
            </label>
            <label class="flex items-center gap-1">
              <input
                type="radio"
                :checked="member.look === 'source'"
                :disabled="member.locked"
                @change="update(member, { look: 'source' })"
              />
              Keep the reference's look
            </label>
            <label v-if="member.kind === 'object'" class="flex items-center gap-1">
              <input
                type="checkbox"
                :checked="member.exact"
                :disabled="member.locked"
                @change="update(member, { exact: !member.exact })"
              />
              Show as is
            </label>
          </div>

          <div v-if="pictures.takes.get(member.name)?.length" class="flex flex-wrap gap-1.5">
            <span class="w-full text-xs text-light-400">Options (click to use)</span>
            <button
              v-for="take in pictures.takes.get(member.name)"
              :key="take.asset"
              type="button"
              class="size-16 overflow-hidden rounded border-2 bg-white"
              :class="take.asset === member.sheet ? 'border-accent-400' : 'border-transparent'"
              :disabled="member.locked"
              @click="choose(member, take.asset)"
            >
              <img :src="take.url" alt="Option" class="size-full object-contain" />
            </button>
          </div>

          <label
            v-if="member.sheet && !member.exact"
            :class="[smallButton, 'cursor-pointer self-start']"
          >
            Make like a reference…
            <input
              type="file"
              accept="image/*"
              class="hidden"
              :disabled="project.busy || member.locked"
              @change="compare(member, $event)"
            />
          </label>

          <div
            v-if="restyling.get(member.name)"
            class="flex flex-col gap-1.5 rounded-md bg-dark-500 p-2"
          >
            <div class="flex items-start gap-2">
              <img
                :src="url(restyling.get(member.name)!.asset) ?? undefined"
                alt="Reference"
                class="size-14 rounded bg-white object-contain"
              />
              <p class="text-xs text-light-400">
                What differs in the reference. Tick what to take over; everything else stays.
              </p>
            </div>
            <label
              v-for="(difference, index) in restyling.get(member.name)!.differences"
              :key="index"
              class="flex items-start gap-2 text-xs text-light-600"
            >
              <input
                type="checkbox"
                :checked="restyling.get(member.name)!.chosen.has(index)"
                @change="toggle(member.name, index)"
              />
              <span
                ><b class="text-white">{{ difference.aspect }}</b
                >: {{ difference.current }} → {{ difference.reference }}</span
              >
            </label>
            <p
              v-if="restyling.get(member.name)!.differences.length === 0"
              class="text-xs text-light-400"
            >
              No differences found.
            </p>
            <div class="flex gap-1.5">
              <button
                type="button"
                :class="smallButton"
                :disabled="project.busy || restyling.get(member.name)!.chosen.size === 0"
                @click="applyRestyle(member)"
              >
                Draw with these changes
              </button>
              <button type="button" :class="smallButton" @click="restyling.delete(member.name)">
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </article>

    <div class="flex gap-2">
      <button
        type="button"
        :class="smallButton"
        :disabled="project.busy"
        @click="project.addMember('character')"
      >
        + Character
      </button>
      <button
        type="button"
        :class="smallButton"
        :disabled="project.busy"
        @click="project.addMember('object')"
      >
        + Object
      </button>
      <button
        v-if="missing.length"
        type="button"
        :class="smallButton"
        :disabled="project.busy"
        @click="drawMissing"
      >
        Draw all missing ({{ missing.length }})
      </button>
    </div>

    <section
      v-if="voice"
      class="flex flex-col gap-2 rounded-lg border border-dark-600 p-3"
      aria-label="Narrator voice"
    >
      <h3 class="text-sm font-bold text-white">Narrator voice</h3>
      <UiSegmentedControl
        :model-value="voice.mode"
        :options="[
          { value: 'default', label: 'Model voice' },
          { value: 'clone', label: 'Clone a voice' },
        ]"
        @update:model-value="project.setVoice({ mode: $event })"
      />
      <template v-if="voice.mode === 'clone'">
        <div v-if="url(voice.sample)" class="flex items-center gap-2 text-xs text-light-400">
          Sample <audio :src="url(voice.sample)!" controls class="h-8" />
        </div>
        <input
          :value="voice.sampleText"
          :class="fieldClass"
          placeholder="What is said in the sample"
          aria-label="Sample transcript"
          @change="project.setVoice({ sampleText: value($event) })"
        />
        <label :class="[smallButton, 'cursor-pointer self-start']">
          {{ voice.sample ? 'Use another sample…' : 'Upload a sample (10 s of speech)…' }}
          <input type="file" accept="audio/*" class="hidden" @change="uploadSample" />
        </label>
        <p class="text-xs text-light-400">
          {{
            settings.modelFor('clone', project.need())
              ? `Cloned with ${settings.modelFor('clone', project.need())}.`
              : project.need().commercial
                ? 'No cloning model on this server allows commercial use; the model voice will be used.'
                : 'No cloning model is available on the server right now.'
          }}
          Only clone voices you have permission to use.
        </p>
      </template>
      <button
        type="button"
        :class="[smallButton, 'self-start']"
        :disabled="
          project.busy ||
          !settings.modelFor(voice.mode === 'clone' ? 'clone' : 'speak', project.need())
        "
        @click="hear"
      >
        Hear a line
      </button>
    </section>

    <p
      v-if="pictures.notice"
      class="rounded-md bg-warning-500/15 px-3 py-2 text-xs text-warning-400"
    >
      {{ pictures.notice }}
    </p>
    <p
      v-if="project.error"
      class="rounded-md bg-alert-600 px-3 py-2 text-sm text-white"
      role="alert"
    >
      {{ project.error }}
    </p>

    <template #note>
      {{
        project.busy
          ? `${project.progress}…`
          : missing.length
            ? `${missing.length} without an approved look`
            : 'Everyone has an approved look'
      }}
    </template>
    <template #actions>
      <UiButton v-if="project.busy" variant="ghost" @click="project.cancel()">Stop</UiButton>
      <UiButton v-else variant="ghost" @click="router.push(STEPS[stepIndex('story')].path)"
        >Back</UiButton
      >
      <UiButton :disabled="project.busy" @click="approve">Approve cast</UiButton>
    </template>

    <template #preview>
      <section
        class="flex min-w-0 flex-1 flex-col gap-3 overflow-y-auto rounded-lg bg-dark-500 p-6"
        aria-label="Cast sheets"
      >
        <p class="text-xs text-light-400">Approved looks</p>
        <div class="grid grid-cols-[repeat(auto-fill,minmax(12rem,1fr))] gap-4">
          <figure v-for="member in members" :key="member.name" class="flex flex-col gap-1.5">
            <div class="flex aspect-square items-center justify-center rounded-md bg-white">
              <img
                v-if="url(member.sheet)"
                :src="url(member.sheet)!"
                :alt="member.name"
                class="size-full object-contain"
              />
              <span v-else class="text-xs text-dark-400">—</span>
            </div>
            <figcaption class="text-sm text-white">
              {{ member.name }}
              <span class="text-xs text-light-400"
                >· {{ member.kind }}{{ member.locked ? ' · locked' : ''
                }}{{ member.exact ? ' · exact' : '' }}</span
              >
            </figcaption>
          </figure>
        </div>
      </section>
    </template>
  </WizardShell>
</template>