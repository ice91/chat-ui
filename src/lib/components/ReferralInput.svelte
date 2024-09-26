<!-- src/lib/components/ReferralInput.svelte -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  let referralInput = '';
  let message = '';
  let type: 'success' | 'error' | null = null;
  const dispatch = createEventDispatcher();
  let isSubmitting = false;

  async function submitCode() {
    if (!referralInput.trim()) {
      message = "推荐码不能为空。";
      type = 'error';
      dispatch('error', { error: message });
      return;
    }

    isSubmitting = true;
    try {
      const res = await fetch('/api/referral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: referralInput }),
      });

      const data = await res.json();

      if (res.ok) {
        message = data.message || "推荐码使用成功，积分已增加！";
        type = 'success';
        dispatch('success', { message });
      } else {
        message = data.error || "推荐码无效或已被使用。";
        type = 'error';
        dispatch('error', { error: message });
      }
    } catch (err) {
      message = "提交推荐码时发生错误，请稍后再试。";
      type = 'error';
      console.error(err);
      dispatch('error', { error: message });
    } finally {
      isSubmitting = false;
    }
  }
</script>

<style>
  .referral-input {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .referral-form {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .referral-form input {
    padding: 0.5rem;
    width: 200px;
  }

  .referral-form button {
    padding: 0.5rem 1rem;
  }

  .message {
    color: green;
  }

  .error {
    color: red;
  }
</style>

<div class="referral-input">
  <div class="referral-form">
    <input type="text" bind:value={referralInput} placeholder="请输入推荐码" />
    <button on:click={submitCode} disabled={isSubmitting}>
      {isSubmitting ? '提交中...' : '提交'}
    </button>
  </div>
  {#if message}
    <p class={type === 'success' ? 'message' : 'error'}>{message}</p>
  {/if}
</div>
