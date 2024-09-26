<script lang="ts">
  import UserInfo from '$lib/components/UserInfo.svelte';
  import type { PageData } from './$types';
  export let data: PageData;
</script>

<style>
  .container {
    max-width: 800px;
    margin: 2rem auto;
    padding: 1rem;
    background-color: white;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
</style>

<div class="container">
  <h1 class="text-2xl font-bold mb-4">使用者資訊</h1>
  <!-- Display user information using UserInfo component -->
  <UserInfo user={data.user} />
</div>