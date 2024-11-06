// src/routes/api/templates/+server.ts

import { json } from "@sveltejs/kit";
import type { RequestHandler } from "@sveltejs/kit";
import { collections } from "$lib/server/database";

/**
 * GET /api/templates
 * 返回產品模板列表
 */
export const GET: RequestHandler = async () => {
	try {
		const templates = await collections.productTemplates
			.find({}, { projection: { _id: 0, templateId: 1, title: 1 } })
			.toArray();
		return json({ templates });
	} catch (error) {
		console.error("獲取模板列表時出錯：", error);
		return json({ error: "無法獲取模板列表" }, { status: 500 });
	}
};
