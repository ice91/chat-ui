import { buildPrompt } from "$lib/buildPrompt.js";
import { PUBLIC_SEP_TOKEN } from "$lib/constants/publicSepToken.js";
import { abortedGenerations } from "$lib/server/abortedGenerations.js";
import { collections } from "$lib/server/database.js";
import { modelEndpoint } from "$lib/server/modelEndpoint.js";
import { defaultModel, models } from "$lib/server/models.js";
import type { Message } from "$lib/types/Message.js";
import { concatUint8Arrays } from "$lib/utils/concatUint8Arrays.js";
import { streamToAsyncIterable } from "$lib/utils/streamToAsyncIterable";
import { trimPrefix } from "$lib/utils/trimPrefix.js";
import { trimSuffix } from "$lib/utils/trimSuffix.js";
import type { TextGenerationStreamOutput } from "@huggingface/inference";
import { error } from "@sveltejs/kit";
import { ObjectId } from "mongodb";
import { z } from "zod";

export async function POST({ request, fetch, locals, params }) {
	// todo: add validation on params.id
	const convId = new ObjectId(params.id);
	const date = new Date();

	const conv = await collections.conversations.findOne({
		_id: convId,
		sessionId: locals.sessionId,
	});

	if (!conv) {
		throw error(404, "Conversation not found");
	}

	const model = conv.model ?? defaultModel.name;

	const json = await request.json();
	const {
		inputs: newPrompt,
		options: { id: messageId, is_retry },
	} = z
		.object({
			inputs: z.string().trim().min(1),
			options: z.object({
				id: z.optional(z.string().uuid()),
				is_retry: z.optional(z.boolean()),
			}),
		})
		.parse(json);

	const messages = (() => {
		if (is_retry && messageId) {
			let retryMessageIdx = conv.messages.findIndex((message) => message.id === messageId);
			if (retryMessageIdx === -1) {
				retryMessageIdx = conv.messages.length;
			}
			return [
				...conv.messages.slice(0, retryMessageIdx),
				{ content: newPrompt, from: "user", id: messageId as Message["id"] },
			];
		}
		return [
			...conv.messages,
			{ content: newPrompt, from: "user", id: (messageId as Message["id"]) || crypto.randomUUID() },
		];
	})() satisfies Message[];

	// Todo: on-the-fly migration, remove later
	for (const message of messages) {
		if (!message.id) {
			message.id = crypto.randomUUID();
		}
	}

	const modelInfo = models.find((m) => m.name === model);

	if (!modelInfo) {
		throw error(400, "Model not availalbe anymore");
	}

	const prompt = buildPrompt(messages, modelInfo);

	const randomEndpoint = modelEndpoint(model);

	const abortController = new AbortController();

	const resp = await fetch(randomEndpoint.url, {
		headers: {
			"Content-Type": request.headers.get("Content-Type") ?? "application/json",
			Authorization: randomEndpoint.authorization,
		},
		method: "POST",
		body: JSON.stringify({
			...json,
			inputs: prompt,
		}),
		signal: abortController.signal,
	});

	if (!resp.body) {
		throw new Error("Response body is empty");
	}

	const [stream1, stream2] = resp.body.tee();

	async function saveMessage() {
		let generated_text = await parseGeneratedText(stream2, convId, date, abortController);

		// We could also check if PUBLIC_ASSISTANT_MESSAGE_TOKEN is present and use it to slice the text
		if (generated_text.startsWith(prompt)) {
			generated_text = generated_text.slice(prompt.length);
		}

		generated_text = trimSuffix(
			trimPrefix(generated_text, "<|startoftext|>"),
			PUBLIC_SEP_TOKEN
		).trim();

		for (const stop of [...(modelInfo?.parameters?.stop ?? []), "<|endoftext|>"]) {
			if (generated_text.endsWith(stop)) {
				generated_text = generated_text.slice(0, -stop.length).trim();
			}
		}

		messages.push({ from: "assistant", content: generated_text, id: crypto.randomUUID() });

		await collections.conversations.updateOne(
			{
				_id: convId,
			},
			{
				$set: {
					messages,
					updatedAt: new Date(),
				},
			}
		);
	}

	saveMessage().catch(console.error);

	// Todo: maybe we should wait for the message to be saved before ending the response - in case of errors
	return new Response(stream1, {
		headers: Object.fromEntries(resp.headers.entries()),
		status: resp.status,
		statusText: resp.statusText,
	});
}

export async function DELETE({ locals, params }) {
	const convId = new ObjectId(params.id);

	const conv = await collections.conversations.findOne({
		_id: convId,
		sessionId: locals.sessionId,
	});

	if (!conv) {
		throw error(404, "Conversation not found");
	}

	await collections.conversations.deleteOne({ _id: conv._id });

	return new Response();
}

async function parseGeneratedText(
	stream: ReadableStream,
	conversationId: ObjectId,
	promptedAt: Date,
	abortController: AbortController
): Promise<string> {
	const inputs: Uint8Array[] = [];
	for await (const input of streamToAsyncIterable(stream)) {
		inputs.push(input);

		const date = abortedGenerations.get(conversationId.toString());

		if (date && date > promptedAt) {
			abortController.abort("Cancelled by user");
			const completeInput = concatUint8Arrays(inputs);

			const lines = new TextDecoder()
				.decode(completeInput)
				.split("\n")
				.filter((line) => line.startsWith("data:"));

			const tokens = lines.map((line) => {
				try {
					const json: TextGenerationStreamOutput = JSON.parse(line.slice("data:".length));
					return json.token.text;
				} catch {
					return "";
				}
			});
			return tokens.join("");
		}
	}

	// Merge inputs into a single Uint8Array
	const completeInput = concatUint8Arrays(inputs);

	// Get last line starting with "data:" and parse it as JSON to get the generated text
	const message = new TextDecoder().decode(completeInput);

	let lastIndex = message.lastIndexOf("\ndata:");
	if (lastIndex === -1) {
		lastIndex = message.indexOf("data");
	}

	if (lastIndex === -1) {
		console.error("Could not parse last message", message);
	}

	let lastMessage = message.slice(lastIndex).trim().slice("data:".length);
	if (lastMessage.includes("\n")) {
		lastMessage = lastMessage.slice(0, lastMessage.indexOf("\n"));
	}

	const lastMessageJSON = JSON.parse(lastMessage);

	if (lastMessageJSON.error) {
		throw new Error(lastMessageJSON.error);
	}

	const res = lastMessageJSON.generated_text;

	if (typeof res !== "string") {
		throw new Error("Could not parse generated text");
	}

	return res;
}

export async function PATCH({ request, locals, params }) {
	const { title } = z
		.object({ title: z.string().trim().min(1).max(100) })
		.parse(await request.json());

	const convId = new ObjectId(params.id);

	const conv = await collections.conversations.findOne({
		_id: convId,
		sessionId: locals.sessionId,
	});

	if (!conv) {
		throw error(404, "Conversation not found");
	}

	await collections.conversations.updateOne(
		{
			_id: convId,
		},
		{
			$set: {
				title,
			},
		}
	);

	return new Response();
}
