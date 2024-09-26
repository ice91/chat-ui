import { assert, it, describe, afterEach, vi, expect } from "vitest";
import type { Cookies } from "@sveltejs/kit";
import { collections } from "$lib/server/database";
import { updateUser } from "./updateUser";
import { ObjectId } from "mongodb";
import { DEFAULT_SETTINGS } from "$lib/types/Settings";
import { defaultModel } from "$lib/server/models";
import { findUser } from "$lib/server/auth";
import { defaultEmbeddingModel } from "$lib/server/embeddingModels";

const userData = {
	preferred_username: "new-username",
	name: "name",
	picture: "https://example.com/avatar.png",
	sub: "1234567890",
};
Object.freeze(userData);

const locals = {
	userId: "1234567890",
	sessionId: "1234567890",
};

// Mock SvelteKit cookies
const cookiesMock: Cookies = {
	set: vi.fn(),
};

// Helper function to insert a random user into the database
const insertRandomUser = async () => {
	const res = await collections.users.insertOne({
		_id: new ObjectId(),
		createdAt: new Date(),
		updatedAt: new Date(),
		username: "base-username",
		name: userData.name,
		avatarUrl: userData.picture,
		hfUserId: userData.sub,
		points: 100, // 初始化积分
		subscriptionStatus: "active", // 初始化订阅状态
	});

	return res.insertedId;
};

// Helper function to insert random conversations into the database
const insertRandomConversations = async (count: number) => {
	const res = await collections.conversations.insertMany(
		new Array(count).fill(0).map(() => ({
			_id: new ObjectId(),
			title: "random title",
			messages: [],
			model: defaultModel.id,
			embeddingModel: defaultEmbeddingModel.id,
			createdAt: new Date(),
			updatedAt: new Date(),
			sessionId: locals.sessionId,
		}))
	);

	return res.insertedIds;
};

// Testing Suite
describe("login", () => {
	// 测试当用户已存在时应更新用户
	it("should update user if existing", async () => {
		await insertRandomUser();

		await updateUser({ userData, locals, cookies: cookiesMock });

		const existingUser = await collections.users.findOne({ hfUserId: userData.sub });

		// 验证更新后的用户信息
		assert.equal(existingUser?.name, userData.name);
		assert.equal(existingUser?.points, 100); // 确认积分未更改
		assert.equal(existingUser?.subscriptionStatus, "active"); // 确认订阅状态未更改

		// 检查 cookies 被调用的次数
		expect(cookiesMock.set).toBeCalledTimes(1);
	});

	// 测试应迁移预先存在的对话到新用户
	it("should migrate pre-existing conversations for new user", async () => {
		const insertedId = await insertRandomUser();

		await insertRandomConversations(2);

		await updateUser({ userData, locals, cookies: cookiesMock });

		// 验证对话已迁移
		const conversationCount = await collections.conversations.countDocuments({
			userId: insertedId,
			sessionId: { $exists: false },
		});

		assert.equal(conversationCount, 2);

		// 清理对话数据
		await collections.conversations.deleteMany({ userId: insertedId });
	});

	// 测试新用户应创建默认设置
	it("should create default settings for new user", async () => {
		await updateUser({ userData, locals, cookies: cookiesMock });

		const user = await findUser(locals.sessionId);

		assert.exists(user);

		const settings = await collections.settings.findOne({ userId: user?._id });

		// 验证新用户的默认设置
		expect(settings).toMatchObject({
			userId: user?._id,
			updatedAt: expect.any(Date),
			createdAt: expect.any(Date),
			ethicsModalAcceptedAt: expect.any(Date),
			...DEFAULT_SETTINGS,
		});

		// 清理设置数据
		await collections.settings.deleteOne({ userId: user?._id });
	});

	// 测试预先存在的用户应迁移预先存在的设置
	it("should migrate pre-existing settings for pre-existing user", async () => {
		const { insertedId } = await collections.settings.insertOne({
			sessionId: locals.sessionId,
			ethicsModalAcceptedAt: new Date(),
			updatedAt: new Date(),
			createdAt: new Date(),
			...DEFAULT_SETTINGS,
			shareConversationsWithModelAuthors: false,
		});

		await updateUser({ userData, locals, cookies: cookiesMock });

		const settings = await collections.settings.findOne({
			_id: insertedId,
			sessionId: { $exists: false },
		});

		assert.exists(settings);

		const user = await collections.users.findOne({ hfUserId: userData.sub });

		// 验证已迁移的设置
		expect(settings).toMatchObject({
			userId: user?._id,
			updatedAt: expect.any(Date),
			createdAt: expect.any(Date),
			ethicsModalAcceptedAt: expect.any(Date),
			...DEFAULT_SETTINGS,
			shareConversationsWithModelAuthors: false,
		});

		// 清理设置数据
		await collections.settings.deleteOne({ userId: user?._id });
	});

	// 测试新用户应初始化积分和订阅字段
	it("should initialize points and subscription fields for new user", async () => {
		await updateUser({ userData, locals, cookies: cookiesMock });

		const user = await collections.users.findOne({ hfUserId: userData.sub });

		assert.exists(user);
		assert.equal(user?.points, 0); // 确认初始积分为 0
		assert.equal(user?.subscriptionStatus, "inactive"); // 确认初始订阅状态为 "inactive"

		expect(cookiesMock.set).toBeCalledTimes(1);
	});

	// 测试处理 Stripe 客户创建和订阅
	it("should handle Stripe customer creation and subscription", async () => {
		await insertRandomUser();

		// 模拟 Stripe 客户和订阅
		const stripeCustomerId = "cus_test123";
		await collections.users.updateOne(
			{ hfUserId: userData.sub },
			{ $set: { stripeCustomerId, subscriptionStatus: "active", subscriptionPlan: "price_test" } }
		);

		const user = await collections.users.findOne({ hfUserId: userData.sub });
		assert.equal(user?.stripeCustomerId, stripeCustomerId); // 确认 Stripe 客户 ID
		assert.equal(user?.subscriptionStatus, "active"); // 确认订阅状态
		assert.equal(user?.subscriptionPlan, "price_test"); // 确认订阅计划
	});
});

// 清理数据库
afterEach(async () => {
	await collections.users.deleteMany({ hfUserId: userData.sub });
	await collections.sessions.deleteMany({});

	locals.userId = "1234567890";
	locals.sessionId = "1234567890";
	vi.clearAllMocks();
});
