import { describe, expect, it } from 'vite-plus/test'

import { editComposition, writeStory } from '../index'

// Runs against a real OpenAI-compatible server. Opt in with:
//   MMOTION_LIVE=1 MMOTION_MODEL=gemma-4-12b-it bunx vp test run src/core/agent
const live = process.env.MMOTION_LIVE === '1'
const endpoint = {
  baseUrl: process.env.MMOTION_BASE_URL ?? 'http://127.0.0.1:8981',
  model: process.env.MMOTION_MODEL ?? 'gemma-4-12b-it',
}

const SCRIPT = `Imagine you are at a birthday party. There's music, people are talking, and suddenly your child starts crying, covering their ears. You feel helpless, wondering what is happening. Sensory overload might be a possibility. Our brain receives information through sound, sight, smell, taste and touch. Sensory overload happens when that information feels like more than we can manage, like several volume controls turned up all at once. So what can we do? First, check their basic needs. Second, reduce the sensory load: move somewhere quieter. Third, keep communication simple. At Soul Solutions, we help families understand these needs.`

describe.skipIf(!live)('agents against a live model', () => {
  it('writes a story with chapters, cast and visual elements, then edits one scene', async () => {
    const steps: string[] = []
    const composition = await writeStory(
      endpoint,
      {
        script: SCRIPT,
        templateId: 'soft-explainer',
        brand: {
          name: 'Soul Solutions',
          logo: '',
          primary: '#1f4d3a',
          accent: '#e0784f',
          background: '#f8f7f4',
          text: '#1f2328',
          fontDisplay: 'Lora',
          fontBody: 'Inter',
        },
        format: 'portrait',
        fps: 30,
      },
      (message) => steps.push(message),
    )
    console.info(steps.join(' · '))
    console.info(
      JSON.stringify(
        {
          cast: composition.cast.members,
          chapters: composition.chapters.map((chapter) => `${chapter.title} (${chapter.tone})`),
          scenes: composition.scenes.map((scene) => [
            scene.chrome.headline,
            scene.chrome.step,
            scene.element.kind,
            scene.element.prompt || scene.element.items.map((item) => item.label).join('/'),
            scene.beats.map((beat) => `${beat.action}${beat.target}@"${beat.at}"`).join(' '),
          ]),
        },
        null,
        1,
      ),
    )
    const kinds = new Set(composition.scenes.map((scene) => scene.element.kind))
    expect(composition.chapters.length).toBeGreaterThanOrEqual(2)
    expect(kinds.size).toBeGreaterThanOrEqual(3)

    const target = composition.scenes.find((scene) => scene.element.kind !== 'illustration')!
    const edited = await editComposition(
      endpoint,
      composition,
      'Turn this scene into a checklist with two short items.',
      target.id,
    )
    console.info(edited.reply, JSON.stringify(edited.ops), edited.errors)
    const after = edited.composition.scenes.find((scene) => scene.id === target.id)!
    expect(after.element.kind).toBe('checklist')
    expect(edited.composition.scenes.filter((scene) => scene.id !== target.id)).toEqual(
      composition.scenes.filter((scene) => scene.id !== target.id),
    )
  }, 600_000)
})