import { ObjectId } from "mongodb";
import type { Migration } from ".";
import { logger } from "$lib/server/logger";

const createProductEarningStorefrontOrder: Migration = {
	_id: new ObjectId("000000000010"), // 確保唯一性
	name: "Create Product, Earning, Storefront, Order collections",
	up: async (client) => {
		// 添加了 client 參數
		const db = client.db(); // 使用 client 獲取數據庫實例

		// 創建 products 集合
		await db.createCollection("products");
		const products = db.collection("products");
		await products.createIndex({ userId: 1 });
		await products.createIndex({ shopifyProductId: 1 }, { unique: true, sparse: true });
		await products.createIndex({ status: 1 });

		// 創建 earnings 集合
		await db.createCollection("earnings");
		const earnings = db.collection("earnings");
		await earnings.createIndex({ userId: 1 });
		await earnings.createIndex({ orderId: 1 }, { unique: true });

		// 創建 storefronts 集合
		await db.createCollection("storefronts");
		const storefronts = db.collection("storefronts");
		await storefronts.createIndex({ userId: 1 }, { unique: true });
		await storefronts.createIndex({ storefrontUrl: 1 }, { unique: true });

		// 創建 orders 集合
		await db.createCollection("orders");
		const orders = db.collection("orders");
		await orders.createIndex({ shopifyOrderId: 1 }, { unique: true });
		await orders.createIndex({ productId: 1 });
		await orders.createIndex({ sellerId: 1 });
		await orders.createIndex({ status: 1 });

		logger.info("Created Product, Earning, Storefront, Order collections and indexes.");
		return true;
	},
	down: async (client) => {
		// 添加了 client 參數
		const db = client.db(); // 使用 client 獲取數據庫實例

		await db.collection("products").drop();
		await db.collection("earnings").drop();
		await db.collection("storefronts").drop();
		await db.collection("orders").drop();

		logger.info("Dropped Product, Earning, Storefront, Order collections.");
		return true;
	},
	runEveryTime: false,
};

export default createProductEarningStorefrontOrder;
