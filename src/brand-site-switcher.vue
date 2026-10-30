<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { brandNetwork } from './brand-network.js';
import CossDropdown from './coss-dropdown.vue';

const { locale } = useI18n();

const COPY = {
  zh: { network: '产品网络', current: '当前站点', all: '全部产品' },
  en: { network: 'Apps', current: 'Current', all: 'All Products' },
  es: { network: 'Productos', current: 'Actual', all: 'Todos los productos' },
  ru: { network: 'Продукты', current: 'Текущий', all: 'Все продукты' },
  vi: { network: 'Sản phẩm', current: 'Hiện tại', all: 'Tất cả sản phẩm' },
  de: { network: 'Produkte', current: 'Aktuell', all: 'Alle Produkte' },
  pt: { network: 'Produtos', current: 'Atual', all: 'Todos os produtos' },
  fr: { network: 'Produits', current: 'Actuel', all: 'Tous les produits' },
};

const labels = computed(() => COPY[locale.value] ?? COPY.en);
</script>

<template>
  <CossDropdown :label="labels.network" panel-class="coss-dropdown-wide">
    <a
      v-for="site in brandNetwork.sites"
      :key="site.id"
      class="coss-dropdown-item"
      :aria-current="site.id === 'minesweeper' ? 'page' : undefined"
      :href="site.url"
    >
      <span>{{ site.name }}</span>
      <small v-if="site.id === 'minesweeper'" class="coss-dropdown-badge">{{ labels.current }}</small>
    </a>
    <hr class="coss-dropdown-separator" />
    <a class="coss-dropdown-item coss-dropdown-directory" :href="brandNetwork.allProductsUrl">
      <span>{{ labels.all }}</span>
      <span aria-hidden="true">→</span>
    </a>
  </CossDropdown>
</template>
