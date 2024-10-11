import type { ObjectId } from "mongodb";
import type { Timestamps } from "./Timestamps";

export interface Product extends Timestamps {
	_id: ObjectId;
	userId: ObjectId; // 賣家ID，與 User._id 對應
	title: string;
	description: string;
	images: string[];
	stock: number;
	price: number;
	shopifyProductId?: string;
	podProductId?: string;
	status: "draft" | "published" | "sold" | "deleted";
	tags?: string[];
	categoryIds?: ObjectId[]; // 支持多分類
	createdAt: Date;
	updatedAt: Date;
}
