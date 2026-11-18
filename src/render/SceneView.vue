<script setup lang="ts">
import { computed, useTemplateRef, type Component } from 'vue'

import type { BrandTokens, Chapter, ElementKind, Scene } from '@/core/composition/schema'
import type { Palette, Template } from '@/core/templates'

import type { TimedBeat } from './beats'
import BigWord from './elements/BigWord.vue'
import ChecklistElement from './elements/ChecklistElement.vue'
import ChipsElement from './elements/ChipsElement.vue'
import IllustrationElement from './elements/IllustrationElement.vue'
import LogoReveal from './elements/LogoReveal.vue'
import QuoteElement from './elements/QuoteElement.vue'
import RadialDiagram from './elements/RadialDiagram.vue'
import SlidersElement from './elements/SlidersElement.vue'
import SpeechBubble from './elements/SpeechBubble.vue'
import SplitCards from './elements/SplitCards.vue'
import StatElement from './elements/StatElement.vue'
import type { ImageState } from './elements/types'
import SceneBackground from './SceneBackground.vue'
import SceneChrome from './SceneChrome.vue'
import { paletteVars } from './theme'
import { useEnterMotion } from './useEnterMotion'

const ELEMENTS: Record<Exclude<ElementKind, 'none'>, Component> = {
  illustration: IllustrationElement,
  radialDiagram: RadialDiagram,
  chips: ChipsElement,
  sliders: SlidersElement,
  checklist: ChecklistElement,
  speechBubble: SpeechBubble,
  splitCards: SplitCards,
  bigWord: BigWord,
  stat: StatElement,
  quote: QuoteElement,
  logoReveal: LogoReveal,
}

const props = defineProps<{
  scene: Scene
  chapter: Chapter
  palette: Palette
  template: Template
  brand: BrandTokens
  beats: TimedBeat[]
  image: ImageState
  /** Seconds since the video started (drives the background). */
  seconds: number
  /** Seconds since this scene started (drives its motion). */
  local: number
}>()

const root = useTemplateRef<HTMLElement>('root')
const element = computed(() =>
  props.scene.element.kind === 'none' ? null : ELEMENTS[props.scene.element.kind],
)

useEnterMotion(
  root,
  () => props.template,
  () => props.local,
)
</script>

<template>
  <div ref="root" class="absolute inset-0 overflow-hidden" :style="paletteVars(palette)">
    <SceneBackground :kind="template.background" :seconds="seconds" />
    <SceneChrome
      :scene="scene"
      :chapter="chapter"
      :template="template"
      :brand="brand"
      :beats="beats"
      :local="local"
    >
      <component
        :is="element"
        v-if="element"
        :element="scene.element"
        :beats="beats"
        :local="local"
        :image="image"
        :brand="brand"
      />
    </SceneChrome>
  </div>
</template>