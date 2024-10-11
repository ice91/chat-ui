import type { ObjectId } from "mongodb";
import type { Timestamps } from "./Timestamps";

export interface Order extends Timestamps {
	_id: ObjectId;
	shopifyOrderId: string;
	productId: ObjectId;
	sellerId: ObjectId;
	totalAmount: number;
	commission: number;
	earnings: number;
	status: "pending" | "completed" | "cancelled";
	createdAt: Date;
	updatedAt: Date;
}
