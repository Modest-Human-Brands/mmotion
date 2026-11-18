<template>
  <RouterView v-slot="{ Component, route }">
    <KeepAlive :include="['TemplateStep', 'BrandStep', 'ScriptStep', 'StudioStep']">
      <component :is="Component" :key="route.name" />
    </KeepAlive>
  </RouterView>
</template>