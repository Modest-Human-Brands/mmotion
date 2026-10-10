<template>
  <RouterView v-slot="{ Component, route }">
    <KeepAlive :include="['TemplateStep', 'BrandStep', 'DetailsStep', 'ExportStep']">
      <component :is="Component" :key="route.name" />
    </KeepAlive>
  </RouterView>
</template>