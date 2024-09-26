<!-- src/lib/components/NavMenu.svelte -->
<script lang="ts">
    import { base } from "$app/paths"; // 使用 base 路徑，確保導航正常
    import Logo from "$lib/components/icons/Logo.svelte"; // 導入 Logo
    import { switchTheme } from "$lib/switchTheme"; // 切換主題
    import { isAborted } from "$lib/stores/isAborted"; // 用來處理新聊天按鈕的事件
    import { env as envPublic } from "$env/dynamic/public"; // 環境變數
    import NavConversationItem from "./NavConversationItem.svelte"; // 導入會話項目
    import type { LayoutData } from "../../routes/$types"; // 頁面相關類型定義
    import type { ConvSidebar } from "$lib/types/ConvSidebar"; // 會話欄類型
    import type { Model } from "$lib/types/Model"; // 模型類型
    import { page } from "$app/stores"; // 頁面商店，用來獲取數據

    export let conversations: ConvSidebar[] = [];
    export let canLogin: boolean;
    export let user: LayoutData["user"]; // 用戶數據

    function handleNewChatClick(event: Event) {
        event.preventDefault(); // 阻止預設行為（導航）
        isAborted.set(true); // 觸發新的聊天事件
    }

    const dateRanges = [
        new Date().setDate(new Date().getDate() - 1),
        new Date().setDate(new Date().getDate() - 7),
        new Date().setMonth(new Date().getMonth() - 1),
    ];

    $: groupedConversations = {
        today: conversations.filter(({ updatedAt }) => updatedAt.getTime() > dateRanges[0]),
        week: conversations.filter(
            ({ updatedAt }) => updatedAt.getTime() > dateRanges[1] && updatedAt.getTime() < dateRanges[0]
        ),
        month: conversations.filter(
            ({ updatedAt }) => updatedAt.getTime() > dateRanges[2] && updatedAt.getTime() < dateRanges[1]
        ),
        older: conversations.filter(({ updatedAt }) => updatedAt.getTime() < dateRanges[2]),
    };

    const titles: { [key: string]: string } = {
        today: "Today",
        week: "This week",
        month: "This month",
        older: "Older",
    } as const;

    // 計算有多少可用模型
    const nModels: number = $page.data.models.filter((el: Model) => !el.unlisted).length;
</script>

<style>
    /* 添加必要的樣式 */
</style>

<div class="sticky top-0 flex flex-none items-center justify-between px-3 py-3.5 max-sm:pt-0">
    <!-- LOGO -->
    <a
        class="flex items-center rounded-xl text-lg font-semibold"
        href={`${envPublic.PUBLIC_ORIGIN}${base}/`}
    >
        <Logo classNames="mr-1" />
        {envPublic.PUBLIC_APP_NAME} <!-- 應用名稱 -->
    </a>
    
    <!-- New Chat 按鈕 -->
    <a
        href={`${base}/`}
        on:click={handleNewChatClick}
        class="flex rounded-lg border bg-white px-2 py-0.5 text-center shadow-sm hover:shadow-none dark:border-gray-600 dark:bg-gray-700 sm:text-smd"
    >
        New Chat
    </a>
</div>

<!-- 會話區塊 -->
<div
    class="scrollbar-custom flex flex-col gap-1 overflow-y-auto rounded-r-xl from-gray-50 px-3 pb-3 pt-2 text-[.9rem] dark:from-gray-800/30 max-sm:bg-gradient-to-t md:bg-gradient-to-l"
>
    <!-- 群組會話項目 -->
    {#each Object.entries(groupedConversations) as [group, convs]}
        {#if convs.length}
            <h4 class="mb-1.5 mt-4 pl-0.5 text-sm text-gray-400 first:mt-0 dark:text-gray-500">
                {titles[group]} <!-- 會話分組標題 -->
            </h4>
            {#each convs as conv}
                <NavConversationItem on:editConversationTitle on:deleteConversation {conv} />
            {/each}
        {/if}
    {/each}
</div>

<!-- 底部菜單 -->
<div
    class="mt-0.5 flex flex-col gap-1 rounded-r-xl p-3 text-sm md:bg-gradient-to-l md:from-gray-50 md:dark:from-gray-800/30"
>

    <!-- 用戶資訊（用戶名或email） -->
    {#if user?.username || user?.email}
        <a
            href="{base}/userinfo" 
            class="flex h-9 flex-none items-center gap-1.5 rounded-lg pl-2.5 pr-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
        >
            {user?.username || user?.email} <!-- 顯示用戶的名稱或郵件 -->
        </a>
    {/if}

    <!-- 登入按鈕 -->
    {#if canLogin}
        <form action="{base}/login" method="POST" target="_parent">
            <button
                type="submit"
                class="flex h-9 w-full flex-none items-center gap-1.5 rounded-lg pl-2.5 pr-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
            >
                Login
            </button>
        </form>
    {/if}
    <!-- 切換主題 -->
    <button
        on:click={switchTheme}
        type="button"
        class="flex h-9 flex-none items-center gap-1.5 rounded-lg pl-2.5 pr-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
    >
        Theme
    </button>

    <!-- 模型頁面 -->
    {#if nModels > 1}
        <a
            href={`${base}/models`}
            class="flex h-9 flex-none items-center gap-1.5 rounded-lg pl-2.5 pr-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
        >
            Models
            <span
                class="ml-auto rounded-full border border-gray-300 px-2 py-0.5 text-xs text-gray-500 dark:border-gray-500 dark:text-gray-400"
            >{nModels}</span>
        </a>
    {/if}

    <!-- Assistants 頁面 -->
    {#if $page.data.enableAssistants}
        <a
            href={`${base}/assistants`}
            class="flex h-9 flex-none items-center gap-1.5 rounded-lg pl-2.5 pr-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
        >
            Assistants
        </a>
    {/if}

    <!-- Tools 頁面 -->
    {#if $page.data.enableCommunityTools}
        <a
            href={`${base}/tools`}
            class="flex h-9 flex-none items-center gap-1.5 rounded-lg pl-2.5 pr-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
        >
            Tools
            <span
                class="ml-auto rounded-full border border-purple-300 px-2 py-0.5 text-xs text-purple-500 dark:border-purple-500 dark:text-purple-400"
            >New</span>
        </a>
    {/if}

    <!-- 設定頁面 -->
    <a
        href={`${base}/settings`}
        class="flex h-9 flex-none items-center gap-1.5 rounded-lg pl-2.5 pr-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
    >
        Settings
    </a>

    <!-- 隱私和關於頁面 -->
    {#if envPublic.PUBLIC_APP_NAME === "HuggingChat"}
        <a
            href={`${base}/privacy`}
            class="flex h-9 flex-none items-center gap-1.5 rounded-lg pl-2.5 pr-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
        >
            About & Privacy
        </a>
    {/if}
</div>