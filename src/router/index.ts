import { createRouter, createWebHistory } from 'vue-router'

import { STEPS, useProjectStore } from '@/stores/project'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', redirect: STEPS[0].path },
    { path: STEPS[0].path, name: 'template', component: () => import('@/views/TemplateStep.vue') },
    { path: STEPS[1].path, name: 'brand', component: () => import('@/views/BrandStep.vue') },
    { path: STEPS[2].path, name: 'script', component: () => import('@/views/ScriptStep.vue') },
    { path: STEPS[3].path, name: 'studio', component: () => import('@/views/StudioStep.vue') },
    { path: '/export', name: 'export', component: () => import('@/views/ExportStep.vue') },
    { path: '/:pathMatch(.*)*', redirect: STEPS[0].path },
  ],
})

// Studio and export need a generated video.
router.beforeEach((to) => {
  if ((to.name === 'studio' || to.name === 'export') && !useProjectStore().composition)
    return STEPS[2].path
  return true
})

export default router