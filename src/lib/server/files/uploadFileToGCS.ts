// src/lib/server/files/uploadFileToGCS.ts

import { Storage } from "@google-cloud/storage";
import { sha256 } from "$lib/utils/sha256";
import { ObjectId } from "mongodb";
import { env } from "$env/dynamic/private"; // 使用 SvelteKit 的 env 模組

// 初始化 GCS 客戶端
const storage = new Storage({
	keyFilename: env.GCS_KEYFILE_PATH, // 從 .env 中讀取服務帳戶憑證路徑
});
const bucketName = env.GCS_BUCKET_NAME; // 從 .env 中讀取 bucket 名稱

/**
 * 上傳文件到 Google Cloud Storage
 * @param file - 要上傳的文件
 * @param sellerId - 賣家 ID，用於區分不同賣家的文件
 * @returns 文件的公共 URL
 */
async function uploadFileToGCS(file: File, sellerId: string): Promise<string> {
	const sha = await sha256(await file.text());
	const buffer = await file.arrayBuffer();
	const fileName = `${sellerId}/${new ObjectId().toString()}-${sha}`; // 基於賣家ID和唯一ID構建文件名

	const bucket = storage.bucket(bucketName);
	const fileHandle = bucket.file(fileName);

	// 上傳文件到 GCS，不設置 ACL
	await fileHandle.save(Buffer.from(buffer), {
		metadata: {
			contentType: file.type, // 設置 MIME 類型
			metadata: { sellerId }, // 保存賣家ID為 metadata
		},
		// 移除 public: true
	});

	// 獲取文件的公共 URL
	const publicUrl = `https://storage.googleapis.com/${bucketName}/${fileName}`;

	return publicUrl;
}

export default uploadFileToGCS;
