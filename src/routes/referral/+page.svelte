<!-- src/routes/referral/+page.svelte -->
<script>
    import { onMount } from "svelte";
    let referralCode = '';
    let message = '';
    let userReferralCode = '';
  
    onMount(async () => {
      const res = await fetch('/api/referral/get-referral-code');
      if (res.ok) {
        const data = await res.json();
        userReferralCode = data.referralCode;
      }
    });
  
    async function submitCode() {
      const res = await fetch('/api/referral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: referralCode }),
      });
      const data = await res.json();
      if (res.ok) {
        message = '推荐码使用成功，积分已增加！';
      } else {
        message = data.error || '推荐码无效或已被使用。';
      }
    }
  </script>
  
  <h2>输入推荐码</h2>
  <input bind:value={referralCode} placeholder="请输入推荐码" />
  <button on:click={submitCode}>提交</button>
  <p>{message}</p>
  
  <h2>您的推荐码</h2>
  <p>{userReferralCode}</p>
  <button on:click={() => navigator.clipboard.writeText(userReferralCode)}>
    复制推荐码
  </button>
  