<script setup lang="ts">

</script>

<template>
  <div class="loading-dots">
    <div class="dot"></div>
    <div class="dot"></div>
    <div class="dot"></div>
  </div>
</template>

<style scoped>
.loading-dots {
  display: flex;
  justify-content: center;
  align-items: center;
}

.dot {
  width: 50px;
  height: 50px;
  margin: 0 5px;
  background-color: white;
  border-radius: 50%;
  animation: dot-opacity 1.4s infinite;
}

.dot:nth-child(2) {
  animation-delay: 0.2s;
}

.dot:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes dot-opacity {
  0%,
  100% {
    background-color: white;
  }
  50% {
    /*opacity: 1;*/
    background-color: black;
  }
}
</style>
