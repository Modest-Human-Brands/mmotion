import gsap from 'gsap'
import { onBeforeUnmount, onMounted, watch, type Ref } from 'vue'

gsap.ticker.lagSmoothing(0)

/**
 * A paused GSAP timeline scoped to `root` and driven only by the frame counter,
 * so it is fully seekable and renders identically in preview and video export.
 * `build` runs after mount, so selectors resolve against real elements.
 */
export function useSeekableTimeline(
  root: Ref<HTMLElement | null>,
  build: (timeline: gsap.core.Timeline) => void,
  currentFrame: Ref<number>,
  fps: Ref<number>,
) {
  let context: gsap.Context | null = null
  let timeline: gsap.core.Timeline | null = null

  const sync = () => timeline?.seek(currentFrame.value / fps.value, false)

  onMounted(() => {
    if (!root.value) return
    context = gsap.context(() => {
      timeline = gsap.timeline({ paused: true })
      build(timeline)
    }, root.value)
    sync()
  })

  watch([currentFrame, fps], sync, { flush: 'sync' })
  onBeforeUnmount(() => {
    context?.revert()
    timeline = null
  })
}