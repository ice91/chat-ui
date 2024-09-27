<!-- src/routes/subscribe/success/+page.svelte -->

<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';

  let sessionId = '';
  let message = '订阅成功！感谢您的订阅。您现在可以访问高级功能。';

  onMount(() => {
    sessionId = $page.url.searchParams.get('session_id') || '';
    if (sessionId) {
      // Optionally, you can verify the session or refresh user data
      // For example, fetch user data to reflect updated subscription status
      // Or display additional information based on the session
    }
  });
</script>

<style>
  /* Add your styles here */
</style>

<h1>订阅成功！</h1>
<p>{message}</p>
<a href="/userinfo">前往您的个人信息页面</a>
