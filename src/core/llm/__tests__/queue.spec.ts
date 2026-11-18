import { describe, expect, it } from 'vite-plus/test'

import { Preempted, exclusive, foregroundPending, pickNext } from '../client'

const tick = () => new Promise((resolve) => setTimeout(resolve, 0))

/** A task that runs until released or aborted. */
function controllable(log: string[], name: string) {
  let release = () => {}
  const task = (signal: AbortSignal) =>
    new Promise<string>((resolve, reject) => {
      log.push(`start ${name}`)
      release = () => resolve(name)
      signal.addEventListener('abort', () => reject(new Error('aborted')))
    })
  return { task, release: () => release() }
}

describe('exclusive', () => {
  it('runs one call at a time, foreground before queued background', async () => {
    const log: string[] = []
    const first = controllable(log, 'first')
    const background = controllable(log, 'background')
    const foreground = controllable(log, 'foreground')
    const results = [
      exclusive(first.task),
      exclusive(background.task, 'background'),
      exclusive(foreground.task),
    ]
    await tick()
    expect(log).toEqual(['start first'])
    first.release()
    await tick()
    expect(log).toEqual(['start first', 'start foreground'])
    expect(foregroundPending()).toBe(true)
    foreground.release()
    await tick()
    background.release()
    expect(await Promise.all(results)).toEqual(['first', 'background', 'foreground'])
    expect(foregroundPending()).toBe(false)
  })

  it('interrupts a background call when the user needs the model', async () => {
    const log: string[] = []
    const background = controllable(log, 'background')
    const foreground = controllable(log, 'foreground')
    const picture = exclusive(background.task, 'background')
    await tick()
    const edit = exclusive(foreground.task)
    await expect(picture).rejects.toBeInstanceOf(Preempted)
    await tick()
    expect(log).toEqual(['start background', 'start foreground'])
    foreground.release()
    expect(await edit).toBe('foreground')
  })
})
describe('pickNext', () => {
  const job = (priority: 'foreground' | 'background', model: string) => ({ priority, model })

  it('keeps the loaded model busy before switching, within the same priority', () => {
    const jobs = [
      job('background', 'image'),
      job('background', 'voice'),
      job('background', 'voice'),
    ]
    expect(pickNext(jobs, 'voice')).toBe(1)
    expect(pickNext(jobs, 'writer')).toBe(0)
  })

  it('still puts foreground work first', () => {
    const jobs = [job('background', 'voice'), job('foreground', 'writer')]
    expect(pickNext(jobs, 'voice')).toBe(1)
    expect(pickNext([], 'voice')).toBe(-1)
  })
})