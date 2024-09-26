// src/lib/session.ts
import type { RequestEvent } from "@sveltejs/kit";
import { collections } from "$lib/server/database";
import type { User } from "$lib/types/User";
import { sha256 } from "$lib/utils/sha256";

/**
 * 獲取當前請求的 session 資訊
 * @param event - SvelteKit 的 RequestEvent
 * @returns 使用者資料或 null
 */
export async function getSession(event: RequestEvent): Promise<{ user: User } | null> {
	// 從 cookies 中獲取 'sessionId'
	const secretSessionId = event.cookies.get("sessionId");

	if (!secretSessionId) {
		return null;
	}

	// 將 secretSessionId 進行 sha256 哈希
	const sessionId = await sha256(secretSessionId);

	// 從 sessions 集合中查找 session
	const session = await collections.sessions.findOne({ sessionId });

	if (!session) {
		return null;
	}

	// 從 users 集合中查找對應的使用者
	const user = await collections.users.findOne({ _id: session.userId });

	if (!user) {
		return null;
	}

	return { user };
}
