// src/migrations/createStateStore.ts

import { ObjectId } from "mongodb";
import { logger } from "$lib/server/logger";
import type { Migration } from ".";

const createStateStore: Migration = {
	_id: new ObjectId("000000000011"), // 确保唯一性
	name: "Create stateStore collection and indexes",
	up: async (client) => {
		const db = client.db(); // 使用 client 获取数据库实例

		// 创建 stateStore 集合
		await db.createCollection("stateStore");

		const stateStore = db.collection("stateStore");

		// 创建索引
		await stateStore.createIndex({ state: 1 }, { unique: true });
		await stateStore.createIndex({ expiration: 1 }, { expireAfterSeconds: 0 });

		logger.info("Created stateStore collection and indexes.");

		return true;
	},
	down: async (client) => {
		const db = client.db(); // 使用 client 获取数据库实例
		// 删除 stateStore 集合
		await db.collection("stateStore").drop();
		logger.info("Dropped stateStore collection.");
		return true;
	},
	runEveryTime: false,
};

export default createStateStore;
