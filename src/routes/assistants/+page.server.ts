import { base } from "$app/paths";
import { ENABLE_ASSISTANTS, REQUIRE_FEATURED_ASSISTANTS } from "$env/static/private";
import { collections } from "$lib/server/database.js";
import { SortKey, type Assistant } from "$lib/types/Assistant";
import type { User } from "$lib/types/User";
import { generateQueryTokens } from "$lib/utils/searchTokens.js";
import { error, redirect } from "@sveltejs/kit";
import type { Filter } from "mongodb";

const NUM_PER_PAGE = 24;

export const load = async ({ url, locals }) => {
	if (!ENABLE_ASSISTANTS) {
		throw redirect(302, `${base}/`);
	}

	const modelId = url.searchParams.get("modelId");
	const pageIndex = parseInt(url.searchParams.get("p") ?? "0");
	const username = url.searchParams.get("user");
	const query = url.searchParams.get("q")?.trim() ?? null;
	const sort = url.searchParams.get("sort")?.trim() ?? SortKey.POPULAR;
	const createdByCurrentUser = locals.user?.username && locals.user.username === username;

	const shouldBeFeatured = REQUIRE_FEATURED_ASSISTANTS === "true" ? { featured: true } : {};
	const shouldHaveBeenShared =
		REQUIRE_FEATURED_ASSISTANTS === "true" && !createdByCurrentUser
			? { userCount: { $gt: 1 } }
			: {};

	let user: Pick<User, "_id"> | null = null;
	if (username) {
		user = await collections.users.findOne<Pick<User, "_id">>(
			{ username },
			{ projection: { _id: 1 } }
		);
		if (!user) {
			throw error(404, `User "${username}" doesn't exist`);
		}
	}

	// fetch the top assistants sorted by user count from biggest to smallest. filter by model too if modelId is provided or query if query is provided
	const filter: Filter<Assistant> = {
		...(modelId && { modelId }),
		...(user && { createdById: user._id }),
		...(query && { searchTokens: { $all: generateQueryTokens(query) } }),
		...shouldHaveBeenShared,
		...shouldBeFeatured,
	};
	const assistants = await collections.assistants
		.find(filter)
		.skip(NUM_PER_PAGE * pageIndex)
		.sort({
			...(sort === SortKey.TRENDING && { last24HoursCount: -1 }),
			userCount: -1,
		})
		.limit(NUM_PER_PAGE)
		.toArray();

	const numTotalItems = await collections.assistants.countDocuments(filter);

	return {
		assistants: JSON.parse(JSON.stringify(assistants)) as Array<Assistant>,
		selectedModel: modelId ?? "",
		numTotalItems,
		numItemsPerPage: NUM_PER_PAGE,
		query,
		sort,
	};
};
