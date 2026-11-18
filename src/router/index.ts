import { createRouter, createWebHistory } from 'vue-router'

import { STEPS, stepIndex, useProjectStore, type StepName } from '@/stores/project'

const VIEWS: Record<StepName, () => Promise<unknown>> = {
  template: () => import('@/views/TemplateStep.vue'),
  brand: () => import('@/views/BrandStep.vue'),
  source: () => import('@/views/SourceStep.vue'),
  story: () => import('@/views/StoryStep.vue'),
  cast: () => import('@/views/CastStep.vue'),
  storyboard: () => import('@/views/StudioStep.vue'),
  studio: () => import('@/views/StudioStep.vue'),
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', redirect: STEPS[0].path },
    ...STEPS.map((step) => ({ path: step.path, name: step.name, component: VIEWS[step.name] })),
    { path: '/export', name: 'export', component: () => import('@/views/ExportStep.vue') },
    { path: '/script', redirect: '/source' },
    { path: '/:pathMatch(.*)*', redirect: STEPS[0].path },
  ],
})

// Each checkpoint opens only once the ones before it are approved.
router.beforeEach((to) => {
  const project = useProjectStore()
  const name = (to.name === 'export' ? 'studio' : to.name) as StepName
  if (stepIndex(name) === -1) return true
  const furthest = project.reachable
  if (stepIndex(name) > stepIndex(furthest)) return STEPS[stepIndex(furthest)]!.path
  return true
})

export default router