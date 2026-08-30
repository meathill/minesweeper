<script setup>
import { brandNetwork } from './brand-network.js';
</script>

<template>
  <details class="brand-switcher">
    <summary>产品网络</summary>
    <div class="brand-switcher-panel">
      <a
        v-for="site in brandNetwork.sites"
        :key="site.id"
        :aria-current="site.id === 'minesweeper' ? 'page' : undefined"
        :href="site.url"
      >
        {{ site.name }}
        <small v-if="site.id === 'minesweeper'">当前站点</small>
      </a>
      <a class="all-products" :href="brandNetwork.allProductsUrl">全部产品</a>
    </div>
  </details>
</template>
