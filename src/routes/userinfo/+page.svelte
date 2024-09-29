<script lang="ts">
    import UserInfo from '$lib/components/UserInfo.svelte'; // Import UserInfo component
    import type { PageData } from './$types';
    export let data: PageData;
</script>

<style>
    .container {
        max-width: 800px;
        width: 90%; /* 增加響應式寬度 */
        margin: 2rem auto;
        padding: 1rem;
        background-color: white;
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    .message {
        color: green;
        font-size: 1rem;
        margin-bottom: 1rem;
    }

    .error-message {
        color: red;
        font-size: 1rem;
        margin-bottom: 1rem;
    }

    /* 新增媒體查詢以調整小螢幕的樣式 */
    @media (max-width: 600px) {
        .container {
            padding: 0.5rem;
            margin: 1rem auto;
        }
        
        .text-2xl {
            font-size: 1.5rem; /* 調整標題大小 */
        }
        
        .sign-out-button {
            width: 100%; /* 讓按鈕全寬 */
            padding: 0.75rem 0; /* 調整按鈕內邊距 */
        }
    }
</style>

<div class="container">
    <h1 class="text-2xl font-bold mb-4">使用者資訊</h1>

    {#if data.message}
        <p class="message">{data.message}</p>
    {/if}
    {#if data.errorMessage}
        <p class="error-message">{data.errorMessage}</p>
    {/if}

    <!-- 使用者資訊元件 -->
    <UserInfo user={data.user} />
</div>
