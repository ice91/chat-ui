// src/routes/api/templates/[templateId]/+server.ts

import { json } from "@sveltejs/kit";
import type { RequestHandler } from "@sveltejs/kit";
import { collections } from "$lib/server/database";

/**
 * GET /api/templates/:templateId
 * 返回指定模板的詳細信息
 */
export const GET: RequestHandler = async ({ params }) => {
	const { templateId } = params;

	if (!templateId) {
		return json({ error: "模板 ID 為必填項" }, { status: 400 });
	}

	try {
		const template = await collections.productTemplates.findOne({ templateId });
		if (!template) {
			return json({ error: "模板不存在" }, { status: 404 });
		}
		return json({ template });
	} catch (error) {
		console.error(`獲取模板 ${templateId} 詳細信息時出錯：`, error);
		return json({ error: "無法獲取模板詳細信息" }, { status: 500 });
	}
};
