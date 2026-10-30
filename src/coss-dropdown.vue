<script setup lang="ts">
import { computed, ref, useId } from 'vue';
import { syncDropdownPopover, toAnchorIdent } from './utils/popover-position';

interface Props {
  label?: string;
  triggerClass?: string;
  panelClass?: string;
  ariaLabel?: string;
  ariaKeyshortcuts?: string;
  title?: string;
}

defineProps<Props>();

const rawId = useId();
const popoverId = computed(
  () => `coss-menu-${rawId.replace(/[^a-zA-Z0-9_-]/g, '-')}`,
);
const anchorName = computed(() => toAnchorIdent(rawId));
const triggerRef = ref<HTMLButtonElement | null>(null);
const panelRef = ref<HTMLElement | null>(null);
const isOpen = ref(false);

function handleToggle() {
  isOpen.value = syncDropdownPopover(triggerRef.value, panelRef.value);
}

function close() {
  if (panelRef.value?.matches(':popover-open')) {
    panelRef.value.hidePopover();
  }
}

defineExpose({ close });
</script>

<template>
  <div class="coss-dropdown">
    <button
      ref="triggerRef"
      type="button"
      class="coss-dropdown-trigger"
      :class="triggerClass"
      :popovertarget="popoverId"
      :aria-expanded="isOpen ? 'true' : 'false'"
      :aria-label="ariaLabel"
      :aria-keyshortcuts="ariaKeyshortcuts"
      :title="title"
      :style="{ anchorName }"
    >
      <slot name="trigger">{{ label }}</slot>
      <span class="coss-dropdown-chevron" aria-hidden="true"></span>
    </button>
    <div
      :id="popoverId"
      ref="panelRef"
      popover="auto"
      class="coss-dropdown-popover"
      :class="panelClass"
      :style="{ positionAnchor: anchorName }"
      @toggle="handleToggle"
    >
      <slot :close="close" :is-open="isOpen"></slot>
    </div>
  </div>
</template>

