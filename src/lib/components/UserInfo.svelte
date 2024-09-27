<!-- src/lib/components/UserInfo.svelte -->

<script lang="ts">
  import { base } from '$app/paths'; // 用於設置登出按鈕的路徑
  import ReferralInput from '$lib/components/ReferralInput.svelte';
  import { onMount } from 'svelte';

  interface User {
    id: string;
    username: string;
    name: string;
    email: string;
    avatarUrl?: string;
    hfUserId?: string;
    points: number;
    subscriptionStatus: string;
    subscriptionPlan?: string;
    subscriptionExpiry?: string;
    referralCode?: string;
    stripeCustomerId?: string;
  }

  export let user: User;

  // 推薦碼和訂閱相關狀態
  let referralMessage = '';
  let isSubmittingReferral = false;

  let generatingCode = false;
  let generateMessage = '';

  // 訂閱管理狀態
  let manageSubscriptionLoading = false;
  let manageSubscriptionError = '';

  // 新增訂閱狀態
  let subscribeLoading = false;
  let subscribeError = '';

  // 更新使用者資料的標記
  let isRefreshing = false;

  // 當前主題
  let currentTheme: 'light' | 'dark' = 'light';

  // 訂閱狀態徽章
  function getSubscriptionBadge(status: string) {
    switch (status) {
      case 'active':
        return { text: '活躍', color: 'green' };
      case 'past_due':
        return { text: '逾期', color: 'yellow' };
      case 'canceled':
        return { text: '已取消', color: 'red' };
      default:
        return { text: status, color: 'gray' };
    }
  }

  // 訂閱管理的相關邏輯
  async function manageSubscription() {
    manageSubscriptionLoading = true;
    manageSubscriptionError = '';
    try {
      if (user.stripeCustomerId) {
        const res = await fetch('/api/stripe/customer-portal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });

        const data = await res.json();

        if (res.ok) {
          window.location.href = data.url; // 重定向到 Stripe 客戶門戶
        } else {
          manageSubscriptionError = data.error || '無法跳轉到訂閱管理頁面。';
        }
      } else {
        // 如果沒有 Stripe 客戶 ID，提示用戶訂閱
        subscribeNow();
      }
    } catch (err) {
      manageSubscriptionError = '處理請求時發生錯誤，請稍後再試。';
      console.error(err);
    } finally {
      manageSubscriptionLoading = false;
    }
  }

  // 訂閱新用戶的邏輯
  async function subscribeNow() {
    subscribeLoading = true;
    subscribeError = '';
    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ returnUrl: window.location.origin + '/userinfo' }),
      });

      const data = await res.json();

      if (res.ok) {
        window.location.href = data.url; // 重定向到 Stripe Checkout
      } else {
        subscribeError = data.error || '無法開始訂閱流程。';
      }
    } catch (err) {
      subscribeError = '處理請求時發生錯誤，請稍後再試。';
      console.error(err);
    } finally {
      subscribeLoading = false;
    }
  }

  // 處理推薦碼提交
  async function submitReferral(code: string) {
    if (!code.trim()) {
      referralMessage = '推薦碼不能為空。';
      return;
    }

    isSubmittingReferral = true;
    referralMessage = '';
    try {
      const res = await fetch('/api/referral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });

      const data = await res.json();

      if (res.ok) {
        referralMessage = data.message || '推薦碼使用成功，積分已增加！';
        await refreshUserData();
      } else {
        referralMessage = data.error || '推薦碼無效或已被使用。';
      }
    } catch (err) {
      referralMessage = '提交推薦碼時發生錯誤，請稍後再試。';
      console.error(err);
    } finally {
      isSubmittingReferral = false;
    }
  }

  // 複製推薦碼
  function copyReferralCode() {
    if (user.referralCode) {
      navigator.clipboard.writeText(user.referralCode)
        .then(() => {
          referralMessage = '推薦碼已複製到剪貼板！';
        })
        .catch(err => {
          referralMessage = '複製推薦碼失敗，請手動複製。';
          console.error(err);
        });
    }
  }

  // 生成推薦碼函數
  async function handleGenerateCode() {
    if (user.referralCode) {
      generateMessage = '您已經擁有推薦碼。';
      return;
    }

    generatingCode = true;
    generateMessage = '';
    try {
      const res = await fetch('/api/referral/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await res.json();

      if (res.ok) {
        generateMessage = `推薦碼生成成功：${data.referralCode}`;
        await refreshUserData();
      } else {
        generateMessage = data.error || '生成推薦碼時發生錯誤，請稍後再試。';
      }
    } catch (err) {
      generateMessage = '生成推薦碼時發生錯誤，請稍後再試。';
      console.error(err);
    } finally {
      generatingCode = false;
    }
  }

  // 刷新使用者資料
  async function refreshUserData() {
    isRefreshing = true;
    try {
      const res = await fetch('/api/user');
      if (res.ok) {
        const data = await res.json();
        Object.assign(user, data.user); // 更新 user 物件
      } else {
        console.error('無法刷新使用者資料。');
      }
    } catch (err) {
      console.error('刷新使用者資料失敗：', err);
    } finally {
      isRefreshing = false;
    }
  }

  // 事件處理函數
  function handleReferralSuccess(event: CustomEvent<{ message: string }>) {
    referralMessage = event.detail.message;
    refreshUserData();
  }

  function handleReferralError(event: CustomEvent<{ error: string }>) {
    referralMessage = event.detail.error;
  }

  // 監聽主題變化
  onMount(() => {
    // 初始化當前主題
    currentTheme = (localStorage.theme as 'light' | 'dark') || 'light';
    document.documentElement.classList.add(currentTheme);

    // Instantiate MutationObserver inside onMount
    const observer = new MutationObserver(() => {
      if (document.documentElement.classList.contains('dark')) {
        currentTheme = 'dark';
      } else {
        currentTheme = 'light';
      }
    });

    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    return () => observer.disconnect();
  });
</script>

<style>
  /* 基礎樣式 */
  .user-info {
    padding: 1.5rem;
    border-radius: 8px;
    margin-bottom: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  /* 淺色主題 */
  .light {
    background-color: #f9f9f9;
    color: #333;
  }

  /* 深色主題 */
  .dark {
    background-color: #1a2432;
    color: #f9f9f9;
  }

  .section {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .section h3 {
    margin-bottom: 0.5rem;
    font-size: 1.25rem;
  }

  /* 根據主題調整標題顏色 */
  .light .section h3 {
    color: #333;
  }

  .dark .section h3 {
    color: #f9f9f9;
  }

  .referral-form {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .referral-form input {
    padding: 0.5rem;
    width: 200px;
    border: 1px solid #ccc;
    border-radius: 4px;
    background-color: inherit;
    color: inherit;
  }

  .referral-form input::placeholder {
    color: #888;
  }

  /* 按鈕樣式 */
  .referral-form button,
  .generate-button {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: background-color 0.2s ease;
    color: white;
  }

  /* 淺色主題按鈕 */
  .light .referral-form button,
  .light .generate-button {
    background-color: #3182ce;
  }

  .light .referral-form button:hover,
  .light .generate-button:hover {
    background-color: #2c5282;
  }

  /* 深色主題按鈕 */
  .dark .referral-form button,
  .dark .generate-button {
    background-color: #4a90e2;
  }

  .dark .referral-form button:hover,
  .dark .generate-button:hover {
    background-color: #357ab8;
  }

  .message {
    margin-top: 0.5rem;
    color: green;
    font-size: 0.9rem;
  }

  .error {
    color: red;
    font-size: 0.9rem;
  }

  .badge {
    display: inline-block;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    color: white;
    font-size: 0.875rem;
    margin-left: 0.5rem;
  }

  /* 徽章顏色根據主題變化 */
  .badge.green.light {
    background-color: #28a745;
  }

  .badge.green.dark {
    background-color: #3a5c37;
  }

  .badge.yellow.light {
    background-color: #ffc107;
  }

  .badge.yellow.dark {
    background-color: #b58900;
  }

  .badge.red.light {
    background-color: #dc3545;
  }

  .badge.red.dark {
    background-color: #732029;
  }

  .badge.gray.light {
    background-color: #6c757d;
  }

  .badge.gray.dark {
    background-color: #3a3f47;
  }

  .icon {
    margin-right: 0.5rem;
  }

  /* Sign Out 按鈕樣式 */
  .sign-out-button {
    margin-top: 1rem;
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    text-align: center;
    transition: background-color 0.2s ease;
    color: white;
  }

  /* 淺色主題 Sign Out 按鈕 */
  .light .sign-out-button {
    background-color: #e53e3e; /* 紅色 */
  }

  .light .sign-out-button:hover {
    background-color: #c53030;
  }

  /* 深色主題 Sign Out 按鈕 */
  .dark .sign-out-button {
    background-color: #f56565; /* 淺紅色 */
  }

  .dark .sign-out-button:hover {
    background-color: #e53e3e;
  }

  /* 管理訂閱按鈕 */
  .manage-subscription-button {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: background-color 0.2s ease;
    align-self: flex-start;
    color: white;
  }

  /* 淺色主題管理訂閱按鈕 */
  .light .manage-subscription-button {
    background-color: #48bb78; /* 綠色 */
  }

  .light .manage-subscription-button:hover {
    background-color: #38a169;
  }

  /* 深色主題管理訂閱按鈕 */
  .dark .manage-subscription-button {
    background-color: #48bb78; /* 綠色 */
  }

  .dark .manage-subscription-button:hover {
    background-color: #38a169;
  }

  /* Generate Referral Code Button */
  .generate-button {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: background-color 0.2s ease;
    align-self: flex-start;
  }

  /* 淺色主題生成推薦碼按鈕 */
  .light .generate-button {
    background-color: #805ad5; /* 紫色 */
  }

  .light .generate-button:hover {
    background-color: #6b46c1;
  }

  /* 深色主題生成推薦碼按鈕 */
  .dark .generate-button {
    background-color: #9f7aea; /* 淺紫色 */
  }

  .dark .generate-button:hover {
    background-color: #805ad5;
  }

  /* Avatar Image Styles */
  .avatar {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    object-fit: cover;
    margin-bottom: 0.5rem;
  }

  /* 自適應按鈕文字顏色 */
  button {
    color: inherit;
  }

  /* 新增：訂閱錯誤訊息樣式 */
  .subscribe-error {
    color: red;
    font-size: 0.9rem;
    margin-top: 0.5rem;
  }

  /* 新增：訂閱成功訊息樣式 */
  .subscribe-success {
    color: green;
    font-size: 0.9rem;
    margin-top: 0.5rem;
  }
</style>

<div class="user-info {currentTheme}">
  <!-- 個人資訊 -->
  <div class="section">
    <h3>個人資訊</h3>
    {#if user.avatarUrl}
      <img src="{user.avatarUrl}" alt="Avatar" class="avatar" />
    {/if}
    <p><strong>姓名:</strong> {user.name}</p>
    <p><strong>電子郵件:</strong> {user.email}</p>
    <p><strong>積分:</strong> {user.points}</p>
  </div>

  <!-- 訂閱資訊 -->
  <div class="section">
    <h3>訂閱資訊</h3>
    <p>
      <strong>狀態:</strong>
      <span class="badge {getSubscriptionBadge(user.subscriptionStatus).color} {currentTheme}">
        {getSubscriptionBadge(user.subscriptionStatus).text}
      </span>
    </p>
    {#if user.subscriptionPlan}
      <p><strong>計劃：</strong> {user.subscriptionPlan}</p>
    {/if}
    {#if user.subscriptionExpiry}
      <p><strong>到期日：</strong> {new Date(user.subscriptionExpiry).toLocaleDateString()}</p>
    {/if}

    <!-- Conditionally show Manage Subscription or Subscribe Now -->
    {#if user.subscriptionStatus === 'active' || user.subscriptionStatus === 'past_due'}
      <button
        class="manage-subscription-button"
        on:click={manageSubscription}
        disabled={manageSubscriptionLoading}
      >
        {manageSubscriptionLoading ? '處理中...' : '管理訂閱'}
      </button>
      {#if manageSubscriptionError}
        <p class="error">{manageSubscriptionError}</p>
      {/if}
    {:else}
      <button
        class="manage-subscription-button"
        on:click={subscribeNow}
        disabled={subscribeLoading}
      >
        {subscribeLoading ? '處理中...' : '立即訂閱'}
      </button>
      {#if subscribeError}
        <p class="subscribe-error">{subscribeError}</p>
      {/if}
    {/if}
  </div>

  <!-- 推薦碼資訊 -->
  <div class="section">
    <h3>推薦碼</h3>
    {#if user.referralCode}
      <p>
        <span class="icon">🔗</span>
        您的推薦碼：<strong>{user.referralCode}</strong>
      </p>
      <button on:click={copyReferralCode} class="{currentTheme}">複製推薦碼</button>
    {:else}
      <p>您尚未生成推薦碼。</p>
      <button
        class="generate-button {currentTheme}"
        on:click={handleGenerateCode}
        disabled={generatingCode}
      >
        {generatingCode ? '生成中...' : '生成推薦碼'}
      </button>
    {/if}
    {#if generateMessage}
      <p class="{generateMessage.startsWith('生成') ? 'message' : 'error'}">
        {generateMessage}
      </p>
    {/if}
  </div>

  <!-- 輸入推薦碼 -->
  <div class="section">
    <h3>輸入推薦碼</h3>
    <ReferralInput
      on:success={handleReferralSuccess}
      on:error={handleReferralError}
      disabled={isSubmittingReferral}
    />
    {#if referralMessage}
      <p class="{referralMessage.startsWith('推薦碼') ? 'message' : 'error'}">
        {referralMessage}
      </p>
    {/if}
  </div>

  <!-- 登出按鈕 -->
  <form action="{base}/logout" method="post">
    <button type="submit" class="sign-out-button {currentTheme}">
      登出
    </button>
  </form>
</div>
