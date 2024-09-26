import type { ObjectId } from "mongodb";
import type { Timestamps } from "./Timestamps";

export interface User extends Timestamps {
	_id: ObjectId;

	username?: string;
	name: string;
	email?: string;
	points: number;
	subscriptionStatus: string;
	subscriptionPlan?: string;
	subscriptionExpiry?: Date;
	referralCode?: string;
	stripeCustomerId?: string;
	avatarUrl: string | undefined;
	hfUserId: string;
	isAdmin?: boolean;
	isEarlyAccess?: boolean;
}
