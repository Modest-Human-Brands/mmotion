import { defineStore } from 'pinia'
import { useNotForm } from 'notform'
import { ref, watch } from 'vue'

import { loadGoogleFont } from '@/domain/fonts'
import {
  DEFAULT_FONT,
  loadOrganization,
  saveOrganization,
  type OrganizationProfile,
} from '@/domain/organization'
import { organizationFormSchema } from '@/domain/organizationForm'

/** The organization profile: brand colours, font, logo and contact details, saved on this device. */
export const useBrandStore = defineStore('brand', () => {
  const form = useNotForm({ schema: organizationFormSchema, initialValues: loadOrganization() })
  const organization = form.values as OrganizationProfile
  const saved = ref(true)

  function save() {
    saveOrganization(organization)
    saved.value = true
  }

  watch(organization, () => (saved.value = false), { deep: true, flush: 'sync' })

  watch(
    () => organization.font,
    (family) => {
      if (family && family !== DEFAULT_FONT) void loadGoogleFont(family)
    },
    { immediate: true },
  )

  return { form, organization, saved, save }
})