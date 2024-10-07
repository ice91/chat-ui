import type { ObjectId } from "mongodb";
import type { Timestamps } from "./Timestamps";

export interface Storefront extends Timestamps {
	_id: ObjectId;
	userId: ObjectId; // 賣家ID
	storefrontUrl: string;
	bannerImageUrl?: string;
	theme?: string;
	createdAt: Date;
	updatedAt: Date;
}
