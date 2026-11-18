import { describe, expect, it } from 'vite-plus/test'

import type { ModelInfo } from '@/core/llm/client'

import { backoffSeconds, classifyFailure, route } from '../router'

const model = (id: string, patch: Partial<ModelInfo>): ModelInfo => ({
  id,
  tasks: [],
  canWrite: false,
  canSpeak: false,
  canDraw: false,
  canHear: false,
  canEdit: false,
  canSee: false,
  maxReferences: 1,
  local: true,
  ...patch,
})

const SERVER = [
  model('gemma-4-12b-it', { canWrite: true, canSee: true }),
  model('h3-image', { canDraw: true, canEdit: true, maxReferences: 2 }),
  model('qwen-image-2.1-turbo', { canDraw: true }),
  model('qwen-image-2.1-uncensored', { canDraw: true, canEdit: true }),
  model('moss-image-sft', { canDraw: true }),
  model('voxcpm2-audiocpp', { canSpeak: true }),
  model('fish-audio-s2-pro', { canSpeak: true }),
  model('parakeet-tdt-0.6b-v3', { canHear: true }),
  model('whisper-large-v3', { canHear: true }),
]
const context = { models: SERVER, down: new Set<string>() }

describe('route', () => {
  it('picks a model per job, not one for everything', () => {
    expect(route('write', {}, context)?.model).toBe('gemma-4-12b-it')
    expect(route('drawFromRefs', {}, context)?.model).toBe('h3-image')
    expect(route('draw', {}, context)?.model).toBe('qwen-image-2.1-turbo')
    expect(route('draft', {}, context)?.model).toBe('qwen-image-2.1-turbo')
    expect(route('clone', {}, context)?.model).toBe('fish-audio-s2-pro')
  })

  it('changes a reference into another art style with a model that does not copy its look', () => {
    // h3 keeps identity best but also keeps the reference's drawing style.
    expect(route('restyle', {}, context)?.model).toBe('qwen-image-2.1-uncensored')
    expect(
      route('restyle', {}, { ...context, down: new Set(['qwen-image-2.1-uncensored']) })?.model,
    ).toBe('h3-image')
  })

  it('routes speech and timing by language', () => {
    expect(route('speak', { language: 'en' }, context)?.model).toBe('voxcpm2-audiocpp')
    expect(route('time', { language: 'en' }, context)?.model).toBe('parakeet-tdt-0.6b-v3')
    expect(route('time', { language: 'bn' }, context)?.model).toBe('whisper-large-v3')
    // Fish measured clearly better in Bengali; voxcpm's Bengali is beta and comes next.
    const bengali = route('speak', { language: 'bn' }, context)!
    expect(bengali.model).toBe('fish-audio-s2-pro')
    expect(bengali.alternatives).toContain('voxcpm2-audiocpp')
    expect(
      route('speak', { language: 'bn' }, { ...context, down: new Set(['fish-audio-s2-pro']) })
        ?.model,
    ).toBe('voxcpm2-audiocpp')
    expect(route('speak', { language: 'hi' }, context)?.model).toBe('voxcpm2-audiocpp')
  })

  it('never uses non-commercial models for commercial videos', () => {
    expect(route('clone', { commercial: true }, context)).toBeNull()
    const bengali = route('speak', { language: 'bn', commercial: true }, context)!
    expect(bengali.model).toBe('voxcpm2-audiocpp')
    expect(bengali.warnings.join()).toMatch(/Bengali/)
    expect(route('drawFromRefs', { commercial: true }, context)!.warnings.join()).toMatch(/licence/)
  })

  it('prefers the picture models that suit the art style', () => {
    expect(route('draw', {}, context)?.model).toBe('qwen-image-2.1-turbo')
    expect(
      route('draw', { prefer: ['moss-image-sft', 'qwen-image-2.1-turbo'] }, context)?.model,
    ).toBe('moss-image-sft')
    expect(route('draw', { prefer: ['h3-image', 'qwen-image-2.1-turbo'] }, context)?.model).toBe(
      'h3-image',
    )
    // A preference never changes jobs that are not pictures.
    expect(route('write', { prefer: ['h3-image'] }, context)?.model).toBe('gemma-4-12b-it')
  })

  it('tells broken model files from an engine that is restarting', () => {
    expect(
      classifyFailure(
        "Failed to load model 'moss-image-sft': sd-server terminated prematurely with exit code: 1 [E] failed to build model runners: failed to load tokenizer 'tokenizer.json': token ID 212445 exceeds text encoder vocabulary (151936)",
      ),
    ).toBe('gone')
    expect(
      classifyFailure('error sending request for url (http://127.0.0.1:8423/v1/images/edits)'),
    ).toBe('unwell')
  })

  it('treats a model that cannot load its weights as gone', () => {
    expect(
      classifyFailure('tensor dimension mismatch ([4096, 512, 1, 1] vs [4096, 1024, 1, 1])'),
    ).toBe('gone')
  })

  it('skips models that are down and honours pins', () => {
    const down = { ...context, down: new Set(['h3-image']) }
    expect(route('drawFromRefs', {}, down)?.model).toBe('qwen-image-2.1-uncensored')
    const pinned = { ...context, pins: { draw: 'h3-image' } }
    expect(route('draw', {}, pinned)).toMatchObject({ model: 'h3-image', reason: 'chosen by you' })
    expect(route('draw', {}, context)?.alternatives).toContain('h3-image')
  })

  it('uses unknown server models with a neutral score', () => {
    const only = {
      models: [model('new-writer', { canWrite: true }), model('new-voice', { canSpeak: true })],
      down: new Set<string>(),
    }
    expect(route('write', {}, only)?.model).toBe('new-writer')
    expect(route('speak', {}, only)?.model).toBe('new-voice')
    // Cloning is not something the server advertises, so unknown voices are not trusted with it.
    expect(route('clone', {}, only)).toBeNull()
  })
})

describe('classifyFailure', () => {
  it('waits for engines that are restarting, skips models that are gone', () => {
    expect(classifyFailure('sd-server failed during weight preparation: …')).toBe('unwell')
    expect(classifyFailure('sd-server terminated prematurely with exit code: 1')).toBe('unwell')
    expect(classifyFailure('audiocpp_cli failed: bad allocation')).toBe('unwell')
    expect(
      classifyFailure(
        "Model 'gemma' not found or failed to load: Timed out waiting for managed llama-server",
      ),
    ).toBe('unwell')
    expect(classifyFailure('The configured model artifact is missing')).toBe('gone')
    expect(classifyFailure("Model 'x' cannot execute speech_generation")).toBe('gone')
    expect(classifyFailure('generate_image returned no results')).toBe('other')
  })

  it('backs off longer each time', () => {
    expect([1, 2, 3, 5].map(backoffSeconds)).toEqual([15, 30, 60, 120])
  })
})