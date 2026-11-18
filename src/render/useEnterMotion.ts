import { computed, type Ref } from 'vue'

import { useSeekableTimeline } from '@/domain/animation/gsap'
import type { Template } from '@/core/templates'

const FROM: Record<Template['motion']['enter'], gsap.TweenVars> = {
  rise: { yPercent: 60, opacity: 0 },
  pop: { scale: 0.82, opacity: 0 },
  wipe: { clipPath: 'inset(0% 100% 0% 0%)' },
  blur: { filter: 'blur(14px)', opacity: 0 },
}

const START = 0.2

/**
 * Animate every `[data-enter]` element in `root` into place in document order, using the
 * template's motion language. Driven by scene-local time, so it scrubs and exports exactly.
 */
export function useEnterMotion(
  root: Ref<HTMLElement | null>,
  template: () => Template,
  seconds: () => number,
) {
  const FPS = 60
  useSeekableTimeline(
    root,
    (timeline) => {
      const { motion } = template()
      const elements = root.value?.querySelectorAll<HTMLElement>('[data-enter]') ?? []
      elements.forEach((element, index) => {
        timeline.from(
          element,
          { ...FROM[motion.enter], duration: motion.duration, ease: motion.ease },
          START + index * motion.stagger,
        )
      })
    },
    computed(() => seconds() * FPS),
    computed(() => FPS),
  )
}