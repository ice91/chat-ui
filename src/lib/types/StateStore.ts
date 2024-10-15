// src/lib/types/StateStore.ts

import type { ObjectId } from "mongodb";

/**
 * 接口定义 stateStore 集合中的文档结构
 */
export interface StateStore {
	_id: ObjectId;
	state: string; // 随机生成的 state 字符串
	sessionId: string; // 关联的 sessionId
	redirectUrl: string; // 重定向的 URL
	expiration: Date; // state 的过期时间
}
