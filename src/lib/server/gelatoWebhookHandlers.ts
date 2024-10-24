// src/lib/server/gelatoWebhookHandlers.ts

import type { GelatoWebhookEvent } from "$lib/types/WebhookEvents";
import {
	handleOrderStatusUpdated,
	handleOrderItemStatusUpdated,
} from "./gelatoWebhookEventHandlers";

export async function handleGelatoWebhookEvent(event: GelatoWebhookEvent) {
	switch (event.event) {
		case "order_status_updated":
			await handleOrderStatusUpdated(event);
			break;
		case "order_item_status_updated":
			await handleOrderItemStatusUpdated(event);
			break;
		// ...其他事件处理
		default:
			console.warn(`未处理的事件类型：${event.event}`);
	}
}
