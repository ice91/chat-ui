<!-- src/routes/subscribe/success/+page.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';

  let sessionId = '';

  onMount(() => {
    sessionId = $page.url.searchParams.get('session_id') || '';
    if (sessionId) {
      // 可以在此调用后端 API 来确认订阅状态
      // 例如，获取订阅详情或刷新用户数据
    }
  });
</script>

<h1>订阅成功！</h1>
<p>感谢您的订阅。您现在可以访问高级功能。</p>
<a href="/">返回主页</a>
