import { env } from "$env/dynamic/private";
import { Client } from "@gradio/client";

export async function GET({ url }) {
	if (env.COMMUNITY_TOOLS !== "true") {
		return new Response("Community tools are not enabled", { status: 403 });
	}

	const space = url.searchParams.get("space");

	if (!space) {
		return new Response("Missing space", { status: 400 });
	}
	// Extract namespace from space URL or use as-is if it's already in namespace format
	let namespace = null;
	if (space.startsWith("https://huggingface.co/spaces/")) {
		namespace = space.split("/").slice(-2).join("/");
	} else if (space.match(/^[^/]+\/[^/]+$/)) {
		namespace = space;
	}

	if (!namespace) {
		return new Response(
			"Invalid space name. Specify a namespace or a full URL on huggingface.co.",
			{ status: 400 }
		);
	}

	try {
		// 取得 HF_ACCESS_TOKEN 從環境變數
		const accessToken = env.HF_TOKEN;
		if (!accessToken) {
			return new Response(JSON.stringify({ error: "HF_TOKEN is not set" }), {
				status: 401,
				headers: { "Content-Type": "application/json" },
			});
		}
		// 使用 HF_ACCESS_TOKEN 來連接到 Hugging Face Space，並傳遞 token 選項
		const api = await (await Client.connect(namespace, { hf_token: accessToken })).view_api();
		//const api = await (await Client.connect(namespace)).view_api();
		return new Response(JSON.stringify(api), {
			status: 200,
			headers: {
				"Content-Type": "application/json",
			},
		});
	} catch (e) {
		return new Response("Error fetching space API. Is the name correct?", {
			status: 400,
			headers: {
				"Content-Type": "application/json",
			},
		});
	}
}
