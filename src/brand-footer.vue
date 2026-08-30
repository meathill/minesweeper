<script setup>
import { brandNetwork } from './brand-network.js';
</script>

<template>
  <footer class="brand-footer">
    <div class="brand-footer-inner">
      <div>
        <a class="brand-footer-name" :href="brandNetwork.organization.url">Meathill Studio</a>
        <p>© {{ new Date().getFullYear() }} {{ brandNetwork.organization.legalName }}. 边玩边学。</p>
      </div>
      <nav aria-label="产品网络" class="brand-footer-links">
        <a v-for="site in brandNetwork.footerLinks" :href="site.url" :key="site.id">{{ site.name }}</a>
        <a :href="brandNetwork.allProductsUrl">全部产品</a>
      </nav>
    </div>
  </footer>
</template>
