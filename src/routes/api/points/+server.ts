import { collections } from "$lib/server/database";
import type { RequestHandler } from "@sveltejs/kit";
import type { User } from "$lib/types/User";

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.userId) {
		return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
	}

	const user = (await collections.users.findOne({
		_id: new ObjectId(locals.userId),
	})) as User | null;

	if (!user) {
		return new Response(JSON.stringify({ error: "User not found" }), { status: 404 });
	}

	return new Response(JSON.stringify({ points: user.points }), { status: 200 });
};
