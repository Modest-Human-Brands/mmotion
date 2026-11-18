import { defineStore } from 'pinia'

import { analyzeVideo, locate } from '@/core/agent/vision'
import { blobToDataUrl } from '@/core/assets/store'
import { parseScript } from '@/core/blocks'
import { castMember, type CastMember, type FormatId } from '@/core/composition/schema'
import {
  boxToRect,
  contactSheets,
  crop,
  decodeSoundtrack,
  sampleFrames,
  speechWindow,
  timedTranscript,
  toWav,
} from '@/core/intake/video'
import { transcribe } from '@/core/llm/client'
import { isKind } from '@/core/kinds'
import { isTemplate } from '@/core/templates'

import { usePicturesStore } from './pictures'
import { useProjectStore } from './project'
import { useSettingsStore } from './settings'

/** Source step: turn a video into a script, the recurring cast (with reference crops) and a voice. */
export const useIntakeStore = defineStore('intake', () => {
  const project = useProjectStore()
  const settings = useSettingsStore()
  const pictures = usePicturesStore()

  function analyze(file: File) {
    const { baseUrl } = settings.saved
    const visionModel = settings.modelFor('see')
    const hearingModel = settings.modelFor('transcribe')
    if (!visionModel) {
      project.error = 'The server has no model that can watch video.'
      return Promise.resolve()
    }
    return project.run(async () => {
      project.phase = 'analyzing'
      const signal = project.endpoint().signal

      project.progress = 'Reading frames'
      const { info, frames } = await sampleFrames(file, { spacing: 4, max: 36 })
      const sheets = await Promise.all((await contactSheets(frames)).map(blobToDataUrl))

      let transcript = ''
      let spokenLanguage = ''
      let words: { word: string; start: number; end: number }[] = []
      const soundtrack = await decodeSoundtrack(file)
      if (soundtrack && hearingModel) {
        project.progress = 'Transcribing the narration'
        const heard = await transcribe(
          baseUrl,
          hearingModel,
          await toWav(soundtrack, 16_000),
          signal,
        )
        words = heard.words
        spokenLanguage = heard.language
        transcript = timedTranscript(words)
      }

      project.progress = 'Watching the video'
      const vision = { baseUrl, model: visionModel, signal }
      const analysis = await analyzeVideo(vision, {
        sheets,
        frameCount: frames.length,
        duration: info.duration,
        transcript,
        keepWording: project.draft.keepWording,
        spokenLanguage,
        language: project.draft.language,
      })

      // Each recurring character or object: cut it out of its clearest frames as a reference.
      const cast: CastMember[] = []
      for (const [index, member] of analysis.cast.entries()) {
        project.progress = `Finding ${member.name} (${index + 1} of ${analysis.cast.length})`
        const refs: string[] = []
        for (const n of member.frames) {
          const frame = frames[n - 1]
          if (!frame) continue
          const box = await locate(vision, await blobToDataUrl(frame.image), member)
          const rect = box && boxToRect(box, frame.width, frame.height)
          if (rect) refs.push(await pictures.addAsset(await crop(frame.image, rect)))
        }
        cast.push(
          castMember(member.name, member.description, {
            kind: member.kind,
            refs,
            exact: member.exact && member.kind === 'object',
            look: 'template',
          }),
        )
      }

      let voiceSample = ''
      let voiceSampleText = ''
      const stretch = speechWindow(words, 10)
      if (soundtrack && stretch) {
        voiceSample = await pictures.addAsset(
          await toWav(soundtrack, 24_000, stretch.from, stretch.to),
        )
        voiceSampleText = stretch.text
      }

      project.draft.blocks = parseScript(analysis.script)
      if (['portrait', 'landscape', 'square'].includes(analysis.format))
        project.draft.format = analysis.format as FormatId
      project.draft.source = {
        videoName: file.name,
        title: analysis.title,
        purpose: analysis.purpose,
        suggestedTemplate: isTemplate(analysis.templateId) ? analysis.templateId : '',
        suggestedKind: isKind(analysis.kindId) ? analysis.kindId : '',
        cast,
        voiceSample,
        voiceSampleText,
      }
    })
  }

  function forget() {
    project.draft.source = null
  }

  return { analyze, forget }
})