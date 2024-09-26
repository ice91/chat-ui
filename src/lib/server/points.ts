// src/lib/server/points.ts
import { collections } from "$lib/server/database";
import type { ObjectId } from "mongodb";

export async function addPoints(userId: ObjectId, amount: number) {
	await collections.users.updateOne({ _id: userId }, { $inc: { points: amount } });
}

export async function deductPoints(userId: ObjectId, amount: number) {
	await collections.users.updateOne({ _id: userId }, { $inc: { points: -amount } });
}
