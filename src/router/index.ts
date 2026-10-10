import { createRouter, createWebHistory } from 'vue-router'

import { STEPS, useMotionWizardStore } from '@/stores/motionWizard'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', redirect: STEPS[0].path },
    { path: STEPS[0].path, name: 'template', component: () => import('@/views/TemplateStep.vue') },
    { path: STEPS[1].path, name: 'brand', component: () => import('@/views/BrandStep.vue') },
    { path: STEPS[2].path, name: 'details', component: () => import('@/views/DetailsStep.vue') },
    { path: STEPS[3].path, name: 'export', component: () => import('@/views/ExportStep.vue') },
    { path: '/:pathMatch(.*)*', redirect: STEPS[0].path },
  ],
})

router.beforeEach((to) => {
  const wizard = useMotionWizardStore()
  if (to.name !== 'template' && !wizard.templateId) return STEPS[0].path
  return true
})

export default router