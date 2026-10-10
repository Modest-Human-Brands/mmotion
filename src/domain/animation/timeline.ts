import { computed, onScopeDispose, ref } from 'vue'

/**
 * Reactive playback clock. Frames are integers in `0..durationFrames - 1`.
 * While `locked` (exporting) the clock never advances on its own.
 */
export function useTimeline(initialDuration = 300, initialFps = 60) {
  const currentFrame = ref(0)
  const durationFrames = ref(initialDuration)
  const fps = ref(initialFps)
  const isPlaying = ref(false)
  const locked = ref(false)

  let elapsed = 0
  let last = 0
  let raf: number | null = null

  const lastFrame = computed(() => Math.max(0, durationFrames.value - 1))

  function seek(frame: number) {
    currentFrame.value = Math.max(0, Math.min(Math.round(frame), lastFrame.value))
    elapsed = currentFrame.value
  }

  function tick(timestamp: number) {
    raf = requestAnimationFrame(tick)
    if (!last) last = timestamp
    const delta = (timestamp - last) / 1000
    last = timestamp
    if (!isPlaying.value || locked.value) return
    elapsed = (elapsed + delta * fps.value) % durationFrames.value
    currentFrame.value = Math.min(Math.floor(elapsed), lastFrame.value)
  }

  function start() {
    if (raf === null) raf = requestAnimationFrame(tick)
  }

  function stop() {
    if (raf !== null) cancelAnimationFrame(raf)
    raf = null
    last = 0
  }

  function play() {
    if (locked.value) return
    isPlaying.value = true
    last = 0
  }

  function pause() {
    isPlaying.value = false
  }

  function toggle() {
    if (isPlaying.value) pause()
    else play()
  }

  function configure(nextFps: number, nextDuration: number) {
    fps.value = nextFps
    durationFrames.value = Math.max(1, Math.round(nextDuration))
    seek(currentFrame.value)
  }

  onScopeDispose(stop)

  return {
    currentFrame,
    durationFrames,
    fps,
    isPlaying,
    locked,
    progress: computed(() => (lastFrame.value ? (currentFrame.value / lastFrame.value) * 100 : 0)),
    currentTimeSec: computed(() => (currentFrame.value / fps.value).toFixed(2)),
    totalTimeSec: computed(() => (durationFrames.value / fps.value).toFixed(2)),
    seek,
    play,
    pause,
    toggle,
    start,
    stop,
    configure,
  }
}

export type Timeline = ReturnType<typeof useTimeline>