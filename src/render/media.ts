import type { Scene } from '@/core/composition/schema'
import type { WordTime } from '@/core/composition/timing'

import type { ImageState } from './elements/types'

/** What the stage needs from outside the document: generated pictures and narration timings. */
export interface StageMedia {
  image: (scene: Scene) => ImageState
  words: (scene: Scene) => WordTime[] | undefined
}

export const NO_MEDIA: StageMedia = {
  image: () => ({ url: null, status: 'idle' }),
  words: () => undefined,
}