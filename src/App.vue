<template>
  <RouterView v-slot="{ Component, route }">
    <KeepAlive
      :include="['TemplateStep', 'BrandStep', 'SourceStep', 'StoryStep', 'CastStep', 'StudioStep']"
    >
      <component :is="Component" :key="route.name" />
    </KeepAlive>
  </RouterView>
</template>