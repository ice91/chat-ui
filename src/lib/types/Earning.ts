import type { ObjectId } from "mongodb";
import type { Timestamps } from "./Timestamps";

export interface Earning extends Timestamps {
	_id: ObjectId;
	userId: ObjectId; // 賣家ID
	orderId: ObjectId;
	amount: number;
	status: "pending" | "paid" | "failed";
	createdAt: Date;
	updatedAt: Date;
}
