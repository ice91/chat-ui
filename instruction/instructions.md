# HuggingChat UI 项目中实现 Marketplace 卖家用户 OIDC 认证与授权的完整代码整理

根据您的需求，以下是 **HuggingChat UI** 项目中实现 **Marketplace** 卖家用户通过 **OIDC** 认证与授权的完整代码整理。本文将详细列出需要新增和修改的文件，包括其在项目目录结构中的位置、完整的代码内容以及对应的修改说明。

## 目录结构概览

在开始之前，以下是涉及到的新增和修改文件在项目目录结构中的位置：

```
chat-ui/
├── src/
│   ├── lib/
│   │   ├── server/
│   │   │   ├── auth.ts                # 修改文件
│   │   │   ├── database.ts            # 修改文件
│   │   │   └── ...                     # 其他文件
│   │   └── utils/
│   │       └── sha256.ts               # 确保存在，用于生成哈希
│   ├── routes/
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   │   ├── seller/
│   │   │   │   │   ├── login/
│   │   │   │   │   │   └── +server.ts        # 新增文件
│   │   │   │   │   ├── callback/
│   │   │   │   │   │   └── +server.ts        # 新增文件
│   │   │   │   │   └── user/
│   │   │   │   │       └── +server.ts        # 新增文件
│   │   │   ├── marketplace/
│   │   │   │   ├── products/
│   │   │   │   │   ├── +server.ts            # 新增文件
│   │   │   │   │   └── [id]/
│   │   │   │   │       └── +server.ts        # 新增文件
│   │   │   │   └── orders/
│   │   │   │       └── +server.ts            # 新增文件
│   │   │   └── ...                           # 其他 API 文件
│   │   └── ...                                 # 其他路由文件
│   └── ...                                     # 其他目录
├── ...                                           # 其他文件
```

## 一、需要新增的文件

### 1.1 `src/routes/api/auth/seller/login/+server.ts`

**位置**：`src/routes/api/auth/seller/login/+server.ts`

**功能**：启动卖家 OIDC 认证流程，重定向用户至 OIDC 提供商的授权 URL。

**代码内容**：

```typescript
// src/routes/api/auth/seller/login/+server.ts

import type { RequestHandler } from '@sveltejs/kit';
import { getOIDCAuthorizationUrl } from '$lib/server/auth';
import { redirect } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ locals }) => {
  // 生成回调 URI
  const redirectURI = `${import.meta.env.VITE_BASE_URL}/api/auth/seller/callback`;

  // 获取授权 URL
  const authorizationUrl = await getOIDCAuthorizationUrl(
    { redirectURI },
    { sessionId: locals.sessionId }
  );

  // 重定向用户至授权 URL
  throw redirect(302, authorizationUrl);
};
```

**修改说明**：

- **新增**：创建 `/api/auth/seller/login` 端点，用于启动卖家的 OIDC 认证流程。
- **功能**：生成授权 URL 并重定向用户至 OIDC 提供商进行认证。

### 1.2 `src/routes/api/auth/seller/callback/+server.ts`

**位置**：`src/routes/api/auth/seller/callback/+server.ts`

**功能**：处理 OIDC 回调，交换授权码获取用户数据，创建或更新用户，生成 JWT 并设置在 HttpOnly Cookie 中。

**代码内容**：

```typescript
// src/routes/api/auth/seller/callback/+server.ts

import type { RequestHandler } from '@sveltejs/kit';
import { getOIDCUserData, validateAndParseCsrfToken } from '$lib/server/auth';
import { collections } from '$lib/server/database';
import { ObjectId } from 'mongodb';
import { sha256 } from '$lib/utils/sha256';
import { addWeeks } from 'date-fns';
import { redirect, error } from '@sveltejs/kit';
import { z } from 'zod';
import jwt from 'jsonwebtoken';

export const GET: RequestHandler = async ({ url, locals, request }) => {
  const params = Object.fromEntries(url.searchParams.entries());

  // 验证回调参数
  const schema = z.object({
    code: z.string(),
    state: z.string(),
    iss: z.string().optional(),
  });

  const result = schema.safeParse(params);
  if (!result.success) {
    throw error(400, 'Invalid callback parameters');
  }

  const { code, state, iss } = result.data;

  // 解析并验证 CSRF Token
  const csrfToken = Buffer.from(state, 'base64').toString('utf-8');
  const validatedToken = await validateAndParseCsrfToken(csrfToken, locals.sessionId);

  if (!validatedToken) {
    throw error(403, 'Invalid or expired CSRF token');
  }

  // 获取用户数据
  const { userData, token } = await getOIDCUserData(
    { redirectURI: validatedToken.redirectUrl },
    code,
    iss
  );

  const email = userData.email;
  if (!email) {
    throw error(400, 'Email not provided by OIDC provider');
  }

  // 查找现有用户
  let user = await collections.users.findOne({ email });

  if (!user) {
    // 创建新用户，并赋予 'seller' 角色
    const newUser = {
      username: userData.preferred_username || email,
      name: userData.name,
      email,
      roles: ['seller'], // 赋予 'seller' 角色
      avatarUrl: userData.picture || '',
      hfUserId: userData.sub,
      points: 0,
      subscriptionStatus: 'inactive',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const insertResult = await collections.users.insertOne(newUser);
    user = { ...newUser, _id: insertResult.insertedId };
  } else {
    // 更新现有用户信息
    await collections.users.updateOne(
      { _id: user._id },
      {
        $set: {
          username: userData.preferred_username || user.email,
          name: userData.name,
          avatarUrl: userData.picture || user.avatarUrl,
          updatedAt: new Date(),
        },
      }
    );
  }

  // 生成 JWT
  const jwtSecret = env.JWT_SECRET;
  if (!jwtSecret) {
    throw error(500, 'JWT secret not configured');
  }

  const tokenPayload = {
    userId: user._id.toString(),
    roles: user.roles,
  };

  const jwtToken = jwt.sign(tokenPayload, jwtSecret, { expiresIn: '2h' });

  // 设置 JWT 在 HttpOnly Cookie 中
  return new Response(null, {
    status: 302,
    headers: {
      'Set-Cookie': `jwt=${jwtToken}; HttpOnly; Path=/; Max-Age=${60 * 60 * 2}; Secure; SameSite=Strict`,
      Location: validatedToken.redirectUrl,
    },
  });
};
```

**修改说明**：

- **新增**：创建 `/api/auth/seller/callback` 端点，用于处理 OIDC 提供商的回调。
- **功能**：
  - 验证回调参数和 CSRF Token。
  - 交换授权码获取用户数据。
  - 创建或更新用户信息，确保新用户拥有 `seller` 角色。
  - 生成 JWT 令牌，并设置在 HttpOnly Cookie 中。

### 1.3 `src/routes/api/auth/seller/user/+server.ts`

**位置**：`src/routes/api/auth/seller/user/+server.ts`

**功能**：获取当前卖家的用户信息，基于 JWT 令牌进行认证。

**代码内容**：

```typescript
// src/routes/api/auth/seller/user/+server.ts

import type { RequestHandler } from '@sveltejs/kit';
import { verify } from 'jsonwebtoken';
import { collections } from '$lib/server/database';
import { env } from '$env/dynamic/private';
import { ObjectId } from 'mongodb';
import { error } from '@sveltejs/kit';
import type { User } from '$lib/types/User';

export const GET: RequestHandler = async ({ request }) => {
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.split(' ')[1] || request.cookies.get('jwt');

  if (!token) {
    return new Response(JSON.stringify({ error: '未授权' }), { status: 401 });
  }

  const jwtSecret = env.JWT_SECRET;
  if (!jwtSecret) {
    return new Response(JSON.stringify({ error: '未配置JWT密钥' }), { status: 500 });
  }

  try {
    const decoded = verify(token, jwtSecret) as { userId: string; roles: string[] };

    if (!decoded.roles.includes('seller')) {
      return new Response(JSON.stringify({ error: '无访问权限' }), { status: 403 });
    }

    const user = await collections.users.findOne({ _id: new ObjectId(decoded.userId) });

    if (!user) {
      return new Response(JSON.stringify({ error: '用户未找到' }), { status: 404 });
    }

    // 返回用户数据
    const userData = {
      id: user._id.toString(),
      username: user.username,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl || null,
      roles: user.roles,
      // 可根据需求添加更多字段
    };

    return new Response(JSON.stringify({ user: userData }), { status: 200 });
  } catch (err) {
    console.error('JWT verification error:', err);
    return new Response(JSON.stringify({ error: '无效的令牌' }), { status: 401 });
  }
};
```

**修改说明**：

- **新增**：创建 `/api/auth/seller/user` 端点，用于获取当前卖家的用户信息。
- **功能**：
  - 解析并验证 JWT 令牌。
  - 确认用户具有 `seller` 角色。
  - 返回用户的详细信息，包括 `roles` 字段。

### 1.4 `src/routes/api/marketplace/products/+server.ts`

**位置**：`src/routes/api/marketplace/products/+server.ts`

**功能**：处理卖家产品的获取（GET）和创建（POST）。

**代码内容**：

```typescript
// src/routes/api/marketplace/products/+server.ts

import type { RequestHandler } from '@sveltejs/kit';
import { authenticateSeller } from '$lib/server/auth';
import { collections } from '$lib/server/database';
import { ObjectId } from 'mongodb';
import { z } from 'zod';

export const GET: RequestHandler = async ({ request }) => {
  try {
    const user = await authenticateSeller(request);

    // 获取卖家的所有产品
    const products = await collections.marketplaceProducts.find({ sellerId: new ObjectId(user._id) }).toArray();

    // 格式化响应数据
    const response = products.map(product => ({
      id: product._id.toString(),
      title: product.title,
      description: product.description,
      price: product.price,
      images: product.images,
      stock: product.stock,
      status: product.status,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    }));

    return new Response(JSON.stringify({ data: response }), { status: 200 });
  } catch (err: any) {
    console.error('Error fetching products:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: err.status || 500 });
  }
};

export const POST: RequestHandler = async ({ request }) => {
  try {
    const user = await authenticateSeller(request);

    const body = await request.json();

    // 定义请求体的验证模式
    const schema = z.object({
      title: z.string().min(1),
      description: z.string().min(1),
      price: z.number().positive(),
      images: z.array(z.string().url()).optional(),
      stock: z.number().int().nonnegative().optional(),
      status: z.enum(['draft', 'published', 'sold', 'deleted']).default('draft'),
    });

    const result = schema.safeParse(body);

    if (!result.success) {
      return new Response(JSON.stringify({ error: '无效的数据', details: result.error.errors }), { status: 400 });
    }

    const { title, description, price, images = [], stock = 0, status } = result.data;

    const newProduct = {
      sellerId: new ObjectId(user._id),
      title,
      description,
      price,
      images,
      stock,
      status,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // 插入新产品
    const insertResult = await collections.marketplaceProducts.insertOne(newProduct);

    return new Response(JSON.stringify({ data: { id: insertResult.insertedId.toString(), ...newProduct } }), { status: 201 });
  } catch (err: any) {
    console.error('Error creating product:', err);
    return new Response(JSON.stringify({ error: err.message || '无法创建产品' }), { status: err.status || 500 });
  }
};
```

**修改说明**：

- **新增**：创建 `/api/marketplace/products` 端点，支持 GET 和 POST 请求。
- **功能**：
  - **GET**：获取当前卖家的所有产品。
  - **POST**：创建新的产品，卖家需要提供必要的产品信息。

### 1.5 `src/routes/api/marketplace/products/[id]/+server.ts`

**位置**：`src/routes/api/marketplace/products/[id]/+server.ts`

**功能**：处理单个产品的获取（GET）、更新（PUT）和删除（DELETE）。

**代码内容**：

```typescript
// src/routes/api/marketplace/products/[id]/+server.ts

import type { RequestHandler } from '@sveltejs/kit';
import { authenticateSeller } from '$lib/server/auth';
import { collections } from '$lib/server/database';
import { ObjectId } from 'mongodb';
import { z } from 'zod';

export const GET: RequestHandler = async ({ params, request }) => {
  try {
    const { id } = params;

    if (!ObjectId.isValid(id)) {
      return new Response(JSON.stringify({ error: '无效的产品ID' }), { status: 400 });
    }

    const user = await authenticateSeller(request);

    const product = await collections.marketplaceProducts.findOne({ _id: new ObjectId(id), sellerId: new ObjectId(user._id) });

    if (!product) {
      return new Response(JSON.stringify({ error: '产品未找到' }), { status: 404 });
    }

    const productData = {
      id: product._id.toString(),
      title: product.title,
      description: product.description,
      price: product.price,
      images: product.images,
      stock: product.stock,
      status: product.status,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };

    return new Response(JSON.stringify({ data: productData }), { status: 200 });
  } catch (err: any) {
    console.error('Error fetching product:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: err.status || 500 });
  }
};

export const PUT: RequestHandler = async ({ params, request }) => {
  try {
    const { id } = params;

    if (!ObjectId.isValid(id)) {
      return new Response(JSON.stringify({ error: '无效的产品ID' }), { status: 400 });
    }

    const user = await authenticateSeller(request);

    const body = await request.json();

    // 定义请求体的验证模式
    const schema = z.object({
      title: z.string().min(1).optional(),
      description: z.string().min(1).optional(),
      price: z.number().positive().optional(),
      images: z.array(z.string().url()).optional(),
      stock: z.number().int().nonnegative().optional(),
      status: z.enum(['draft', 'published', 'sold', 'deleted']).optional(),
    });

    const result = schema.safeParse(body);

    if (!result.success) {
      return new Response(JSON.stringify({ error: '无效的数据', details: result.error.errors }), { status: 400 });
    }

    const updateData = { ...result.data, updatedAt: new Date() };

    const updateResult = await collections.marketplaceProducts.updateOne(
      { _id: new ObjectId(id), sellerId: new ObjectId(user._id) },
      { $set: updateData }
    );

    if (updateResult.matchedCount === 0) {
      return new Response(JSON.stringify({ error: '产品未找到或无权限' }), { status: 404 });
    }

    const updatedProduct = await collections.marketplaceProducts.findOne({ _id: new ObjectId(id) });

    return new Response(JSON.stringify({ data: { id: updatedProduct._id.toString(), ...updatedProduct } }), { status: 200 });
  } catch (err: any) {
    console.error('Error updating product:', err);
    return new Response(JSON.stringify({ error: err.message || '无法更新产品' }), { status: err.status || 500 });
  }
};

export const DELETE: RequestHandler = async ({ params, request }) => {
  try {
    const { id } = params;

    if (!ObjectId.isValid(id)) {
      return new Response(JSON.stringify({ error: '无效的产品ID' }), { status: 400 });
    }

    const user = await authenticateSeller(request);

    const deleteResult = await collections.marketplaceProducts.deleteOne({ _id: new ObjectId(id), sellerId: new ObjectId(user._id) });

    if (deleteResult.deletedCount === 0) {
      return new Response(JSON.stringify({ error: '产品未找到或无权限' }), { status: 404 });
    }

    return new Response(JSON.stringify({ message: '产品已删除' }), { status: 200 });
  } catch (err: any) {
    console.error('Error deleting product:', err);
    return new Response(JSON.stringify({ error: err.message || '无法删除产品' }), { status: err.status || 500 });
  }
};
```

**修改说明**：

- **新增**：创建 `/api/marketplace/products/[id]` 端点，支持 GET、PUT 和 DELETE 请求。
- **功能**：
  - **GET**：获取指定 ID 的产品信息。
  - **PUT**：更新指定 ID 的产品信息。
  - **DELETE**：删除指定 ID 的产品。

### 1.6 `src/routes/api/marketplace/orders/+server.ts`

**位置**：`src/routes/api/marketplace/orders/+server.ts`

**功能**：处理卖家订单的获取（GET）。

**代码内容**：

```typescript
// src/routes/api/marketplace/orders/+server.ts

import type { RequestHandler } from '@sveltejs/kit';
import { authenticateSeller } from '$lib/server/auth';
import { collections } from '$lib/server/database';
import { ObjectId } from 'mongodb';
import { z } from 'zod';

export const GET: RequestHandler = async ({ request }) => {
  try {
    const user = await authenticateSeller(request);

    // 获取卖家相关的所有订单
    const orders = await collections.marketplaceOrders.find({ sellerId: new ObjectId(user._id) }).toArray();

    // 格式化响应数据
    const response = orders.map(order => ({
      id: order._id.toString(),
      buyerName: order.buyerName,
      productTitle: order.productTitle,
      totalAmount: order.totalAmount,
      status: order.status,
      createdAt: order.createdAt,
    }));

    return new Response(JSON.stringify({ data: response }), { status: 200 });
  } catch (err: any) {
    console.error('Error fetching orders:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: err.status || 500 });
  }
};
```

**修改说明**：

- **新增**：创建 `/api/marketplace/orders` 端点，支持 GET 请求。
- **功能**：
  - **GET**：获取当前卖家的所有订单信息。

## 二、需要修改的文件

### 2.1 `src/lib/server/database.ts`

**位置**：`src/lib/server/database.ts`

**功能**：更新数据库模式，新增 `marketplaceProducts` 和 `marketplaceOrders` 集合，确保 `User` 接口包含 `roles` 字段，并为新集合创建必要的索引。

**修改内容**：

```typescript
// src/lib/server/database.ts

import { env } from "$env/dynamic/private";
import { GridFSBucket, MongoClient } from "mongodb";
import type { Conversation } from "$lib/types/Conversation";
import type { SharedConversation } from "$lib/types/SharedConversation";
import type { AbortedGeneration } from "$lib/types/AbortedGeneration";
import type { Settings } from "$lib/types/Settings";
import type { User } from "$lib/types/User";
import type { MessageEvent } from "$lib/types/MessageEvent";
import type { Session } from "$lib/types/Session";
import type { Assistant } from "$lib/types/Assistant";
import type { Report } from "$lib/types/Report";
import type { ConversationStats } from "$lib/types/ConversationStats";
import type { MigrationResult } from "$lib/types/MigrationResult";
import type { Semaphore } from "$lib/types/Semaphore";
import type { AssistantStats } from "$lib/types/AssistantStats";
import type { CommunityToolDB } from "$lib/types/Tool";
import type { ReferralCode } from "$lib/types/ReferralCode"; // 新增的类型

import { logger } from "$lib/server/logger";
import { building } from "$app/environment";
import type { TokenCache } from "$lib/types/TokenCache";
import { onExit } from "./exitHandler";

// 定义 MarketplaceProduct 接口
export interface MarketplaceProduct {
  _id: ObjectId;
  sellerId: ObjectId;
  title: string;
  description: string;
  price: number;
  images: string[];
  stock: number;
  status: 'draft' | 'published' | 'sold' | 'deleted';
  createdAt: Date;
  updatedAt: Date;
}

// 定义 MarketplaceOrder 接口
export interface MarketplaceOrder {
  _id: ObjectId;
  sellerId: ObjectId;
  buyerId: ObjectId;
  buyerName: string;
  productId: ObjectId;
  productTitle: string;
  totalAmount: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

// 更新 User 接口，添加 roles 字段
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
  roles: string[]; // 新增 roles 字段
}

export const CONVERSATION_STATS_COLLECTION = "conversations.stats";

export class Database {
  private client: MongoClient;

  private static instance: Database;

  private constructor() {
    if (!env.MONGODB_URL) {
      throw new Error(
        "Please specify the MONGODB_URL environment variable inside .env.local. Set it to mongodb://localhost:27017 if you are running MongoDB locally, or to a MongoDB Atlas free instance for example."
      );
    }

    this.client = new MongoClient(env.MONGODB_URL, {
      directConnection: env.MONGODB_DIRECT_CONNECTION === "true",
    });

    this.client.connect().catch((err) => {
      logger.error(err, "Connection error");
      process.exit(1);
    });
    this.client.db(env.MONGODB_DB_NAME + (import.meta.env.MODE === "test" ? "-test" : ""));
    this.client.on("open", () => this.initDatabase());

    // Disconnect DB on exit
    onExit(() => this.client.close(true));
  }

  public static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }

    return Database.instance;
  }

  /**
   * Return mongoClient
   */
  public getClient(): MongoClient {
    return this.client;
  }

  /**
   * Return map of database's collections
   */
  public getCollections() {
    const db = this.client.db(
      env.MONGODB_DB_NAME + (import.meta.env.MODE === "test" ? "-test" : "")
    );

    const conversations = db.collection<Conversation>("conversations");
    const conversationStats = db.collection<ConversationStats>(CONVERSATION_STATS_COLLECTION);
    const assistants = db.collection<Assistant>("assistants");
    const assistantStats = db.collection<AssistantStats>("assistants.stats");
    const reports = db.collection<Report>("reports");
    const sharedConversations = db.collection<SharedConversation>("sharedConversations");
    const abortedGenerations = db.collection<AbortedGeneration>("abortedGenerations");
    const settings = db.collection<Settings>("settings");
    const users = db.collection<User>("users");
    const sessions = db.collection<Session>("sessions");
    const messageEvents = db.collection<MessageEvent>("messageEvents");
    const bucket = new GridFSBucket(db, { bucketName: "files" });
    const migrationResults = db.collection<MigrationResult>("migrationResults");
    const semaphores = db.collection<Semaphore>("semaphores");
    const tokenCaches = db.collection<TokenCache>("tokens");
    const tools = db.collection<CommunityToolDB>("tools");
    const referralCodes = db.collection<ReferralCode>("referralCodes"); // 新增的集合

    // 新增 Marketplace 相关的集合
    const marketplaceProducts = db.collection<MarketplaceProduct>('marketplaceProducts');
    const marketplaceOrders = db.collection<MarketplaceOrder>('marketplaceOrders');

    return {
      conversations,
      conversationStats,
      assistants,
      assistantStats,
      reports,
      sharedConversations,
      abortedGenerations,
      settings,
      users,
      sessions,
      messageEvents,
      bucket,
      migrationResults,
      semaphores,
      tokenCaches,
      tools,
      referralCodes,
      marketplaceProducts,
      marketplaceOrders, // 添加到返回的对象中
    };
  }

  /**
   * Init database once connected: Index creation
   * @private
   */
  private initDatabase() {
    const {
      conversations,
      conversationStats,
      assistants,
      assistantStats,
      reports,
      sharedConversations,
      abortedGenerations,
      settings,
      users,
      sessions,
      messageEvents,
      semaphores,
      tokenCaches,
      tools,
      referralCodes, // 引用新增的集合
      marketplaceProducts,
      marketplaceOrders,
    } = this.getCollections();

    // 创建 marketplaceProducts 的索引
    marketplaceProducts.createIndex({ sellerId: 1, title: 1 }).catch(e => logger.error(e));
    marketplaceProducts.createIndex({ status: 1 }).catch(e => logger.error(e));

    // 创建 marketplaceOrders 的索引
    marketplaceOrders.createIndex({ sellerId: 1, status: 1 }).catch(e => logger.error(e));
    marketplaceOrders.createIndex({ createdAt: 1 }).catch(e => logger.error(e));

    // 创建现有集合的索引...
    conversations
      .createIndex(
        { sessionId: 1, updatedAt: -1 },
        { partialFilterExpression: { sessionId: { $exists: true } } }
      )
      .catch((e) => logger.error(e));
    conversations
      .createIndex(
        { userId: 1, updatedAt: -1 },
        { partialFilterExpression: { userId: { $exists: true } } }
      )
      .catch((e) => logger.error(e));
    conversations
      .createIndex(
        { "message.id": 1, "message.ancestors": 1 },
        { partialFilterExpression: { userId: { $exists: true } } }
      )
      .catch((e) => logger.error(e));
    conversations
      .createIndex({ "messages.createdAt": 1 }, { sparse: true })
      .catch((e) => logger.error(e));
    conversationStats
      .createIndex(
        {
          type: 1,
          "date.field": 1,
          "date.span": 1,
          "date.at": 1,
          distinct: 1,
        },
        { unique: true }
      )
      .catch((e) => logger.error(e));
    conversationStats
      .createIndex({
        type: 1,
        "date.field": 1,
        "date.at": 1,
      })
      .catch((e) => logger.error(e));
    abortedGenerations
      .createIndex({ updatedAt: 1 }, { expireAfterSeconds: 30 })
      .catch((e) => logger.error(e));
    abortedGenerations
      .createIndex({ conversationId: 1 }, { unique: true })
      .catch((e) => logger.error(e));
    sharedConversations.createIndex({ hash: 1 }, { unique: true }).catch((e) => logger.error(e));
    settings
      .createIndex({ sessionId: 1 }, { unique: true, sparse: true })
      .catch((e) => logger.error(e));
    settings
      .createIndex({ userId: 1 }, { unique: true, sparse: true })
      .catch((e) => logger.error(e));
    settings.createIndex({ assistants: 1 }).catch((e) => logger.error(e));
    users.createIndex({ hfUserId: 1 }, { unique: true }).catch((e) => logger.error(e));
    users
      .createIndex({ sessionId: 1 }, { unique: true, sparse: true })
      .catch((e) => logger.error(e));
    users.createIndex({ username: 1 }).catch((e) => logger.error(e));
    messageEvents
      .createIndex({ createdAt: 1 }, { expireAfterSeconds: 60 })
      .catch((e) => logger.error(e));
    sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }).catch((e) => logger.error(e));
    sessions.createIndex({ sessionId: 1 }, { unique: true }).catch((e) => logger.error(e));
    assistants.createIndex({ createdById: 1, userCount: -1 }).catch((e) => logger.error(e));
    assistants.createIndex({ userCount: 1 }).catch((e) => logger.error(e));
    assistants.createIndex({ featured: 1, userCount: -1 }).catch((e) => logger.error(e));
    assistants.createIndex({ modelId: 1, userCount: -1 }).catch((e) => logger.error(e));
    assistants.createIndex({ searchTokens: 1 }).catch((e) => logger.error(e));
    assistants.createIndex({ last24HoursCount: 1 }).catch((e) => logger.error(e));
    assistants
      .createIndex({ last24HoursUseCount: -1, useCount: -1, _id: 1 })
      .catch((e) => logger.error(e));
    assistantStats
      // Order of keys is important for the queries
      .createIndex({ "date.span": 1, "date.at": 1, assistantId: 1 }, { unique: true })
      .catch((e) => logger.error(e));
    reports.createIndex({ assistantId: 1 }).catch((e) => logger.error(e));
    reports.createIndex({ createdBy: 1, assistantId: 1 }).catch((e) => logger.error(e));

    // Unique index for semaphore and migration results
    semaphores.createIndex({ key: 1 }, { unique: true }).catch((e) => logger.error(e));
    semaphores
      .createIndex({ createdAt: 1 }, { expireAfterSeconds: 60 })
      .catch((e) => logger.error(e));
    tokenCaches
      .createIndex({ createdAt: 1 }, { expireAfterSeconds: 5 * 60 })
      .catch((e) => logger.error(e));
    tokenCaches.createIndex({ tokenHash: 1 }).catch((e) => logger.error(e));
    tools.createIndex({ createdById: 1, userCount: -1 }).catch((e) => logger.error(e));
    tools.createIndex({ userCount: 1 }).catch((e) => logger.error(e));
    tools.createIndex({ last24HoursCount: 1 }).catch((e) => logger.error(e));

    // 创建 referralCodes 的索引
    referralCodes.createIndex({ code: 1 }, { unique: true }).catch((e) => logger.error(e));
    referralCodes.createIndex({ createdBy: 1 }).catch((e) => logger.error(e));
    referralCodes.createIndex({ usedBy: 1 }, { sparse: true }).catch((e) => logger.error(e));

    // 创建 marketplaceProducts 的索引
    marketplaceProducts.createIndex({ sellerId: 1, title: 1 }).catch(e => logger.error(e));
    marketplaceProducts.createIndex({ status: 1 }).catch(e => logger.error(e));

    // 创建 marketplaceOrders 的索引
    marketplaceOrders.createIndex({ sellerId: 1, status: 1 }).catch(e => logger.error(e));
    marketplaceOrders.createIndex({ createdAt: 1 }).catch(e => logger.error(e));

    // 其他索引创建...
  }
}

export const collections = building
  ? ({} as unknown as ReturnType<typeof Database.prototype.getCollections>)
  : Database.getInstance().getCollections();
```

**修改说明**：

- **新增**：
  - **接口定义**：新增 `MarketplaceProduct` 和 `MarketplaceOrder` 接口，用于定义 Marketplace 产品和订单的数据结构。
  - **集合定义**：在 `getCollections` 方法中新增 `marketplaceProducts` 和 `marketplaceOrders` 两个集合。
  - **索引创建**：在 `initDatabase` 方法中为 `marketplaceProducts` 和 `marketplaceOrders` 创建必要的索引，以优化查询性能。
- **更新**：
  - **User 接口**：在 `User` 接口中新增 `roles: string[]` 字段，用于存储用户的角色（如 `seller`）。

### 2.2 `src/lib/server/auth.ts`

**位置**：`src/lib/server/auth.ts`

**功能**：修改认证逻辑，新增 `authenticateSeller` 和 `requireSeller` 函数，用于验证用户是否具有 `seller` 角色。

**修改内容**：

```typescript
// src/lib/server/auth.ts

import {
  Issuer,
  type BaseClient,
  type UserinfoResponse,
  type TokenSet,
  custom,
} from "openid-client";
import { addHours, addWeeks } from "date-fns";
import { env } from "$env/dynamic/private";
import { sha256 } from "$lib/utils/sha256";
import { z } from "zod";
import { dev } from "$app/environment";
import type { Cookies } from "@sveltejs/kit";
import { collections } from "$lib/server/database";
import JSON5 from "json5";
import { logger } from "$lib/server/logger";

import {
  verify
} from 'jsonwebtoken'; // 新增导入
import { error } from '@sveltejs/kit'; // 新增导入
import type { User } from '$lib/types/User'; // 新增导入

export interface OIDCSettings {
  redirectURI: string;
}

export interface OIDCUserInfo {
  token: TokenSet;
  userData: UserinfoResponse;
}

const stringWithDefault = (value: string) =>
  z
    .string()
    .default(value)
    .transform((el) => (el ? el : value));

export const OIDConfig = z
  .object({
    CLIENT_ID: stringWithDefault(env.OPENID_CLIENT_ID),
    CLIENT_SECRET: stringWithDefault(env.OPENID_CLIENT_SECRET),
    PROVIDER_URL: stringWithDefault(env.OPENID_PROVIDER_URL),
    SCOPES: stringWithDefault(env.OPENID_SCOPES),
    NAME_CLAIM: stringWithDefault(env.OPENID_NAME_CLAIM).refine(
      (el) => !["preferred_username", "email", "picture", "sub"].includes(el),
      { message: "nameClaim cannot be one of the restricted keys." }
    ),
    TOLERANCE: stringWithDefault(env.OPENID_TOLERANCE),
    RESOURCE: stringWithDefault(env.OPENID_RESOURCE),
  })
  .parse(JSON5.parse(env.OPENID_CONFIG));

export const requiresUser = !!OIDConfig.CLIENT_ID && !!OIDConfig.CLIENT_SECRET;

export function refreshSessionCookie(cookies: Cookies, sessionId: string) {
  cookies.set(env.COOKIE_NAME, sessionId, {
    path: "/",
    // So that it works inside the space's iframe
    sameSite: dev || env.ALLOW_INSECURE_COOKIES === "true" ? "lax" : "none",
    secure: !dev && !(env.ALLOW_INSECURE_COOKIES === "true"),
    httpOnly: true,
    expires: addWeeks(new Date(), 2),
  });
}

export async function findUser(sessionId: string) {
  const session = await collections.sessions.findOne({ sessionId });

  if (!session) {
    return null;
  }

  return await collections.users.findOne({ _id: session.userId });
}

export const authCondition = (locals: App.Locals) => {
  return locals.user
    ? { userId: locals.user._id }
    : { sessionId: locals.sessionId, userId: { $exists: false } };
};

/**
 * Generates a CSRF token using the user sessionId. Note that we don't need a secret because sessionId is enough.
 */
export async function generateCsrfToken(sessionId: string, redirectUrl: string): Promise<string> {
  const data = {
    expiration: addHours(new Date(), 1).getTime(),
    redirectUrl,
  };

  return Buffer.from(
    JSON.stringify({
      data,
      signature: await sha256(JSON.stringify(data) + "##" + sessionId),
    })
  ).toString("base64");
}

async function getOIDCClient(settings: OIDCSettings): Promise<BaseClient> {
  const issuer = await Issuer.discover(OIDConfig.PROVIDER_URL);

  return new issuer.Client({
    client_id: OIDConfig.CLIENT_ID,
    client_secret: OIDConfig.CLIENT_SECRET,
    redirect_uris: [settings.redirectURI],
    response_types: ["code"],
    [custom.clock_tolerance]: OIDConfig.TOLERANCE || undefined,
  });
}

export async function getOIDCAuthorizationUrl(
  settings: OIDCSettings,
  params: { sessionId: string }
): Promise<string> {
  const client = await getOIDCClient(settings);
  const csrfToken = await generateCsrfToken(params.sessionId, settings.redirectURI);

  return client.authorizationUrl({
    scope: OIDConfig.SCOPES,
    state: csrfToken,
    resource: OIDConfig.RESOURCE || undefined,
  });
}

export async function getOIDCUserData(
  settings: OIDCSettings,
  code: string,
  iss?: string
): Promise<OIDCUserInfo> {
  const client = await getOIDCClient(settings);
  const token = await client.callback(settings.redirectURI, { code, iss });
  const userData = await client.userinfo(token);

  return { token, userData };
}

// 新增 authenticateSeller 函数
export async function authenticateSeller(request: Request): Promise<User> {
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.split(' ')[1] || request.cookies.get('jwt');

  if (!token) {
    throw error(401, '未授权');
  }

  const jwtSecret = env.JWT_SECRET;
  if (!jwtSecret) {
    throw error(500, '未配置JWT密钥');
  }

  try {
    const decoded = verify(token, jwtSecret) as { userId: string; roles: string[] };

    if (!decoded.roles.includes('seller')) {
      throw error(403, '无访问权限');
    }

    const user = await collections.users.findOne({ _id: new ObjectId(decoded.userId) });

    if (!user) {
      throw error(404, '用户未找到');
    }

    return user;
  } catch (err) {
    console.error('Authentication error:', err);
    throw error(401, '无效的令牌');
  }
}

// 新增 requireSeller 函数
export async function requireSeller(event: { request: Request; locals: any }) {
  const user = await authenticateSeller(event.request);
  return user;
}
```

**修改说明**：

- **新增**：
  - **导入**：引入 `jsonwebtoken` 库中的 `verify` 函数，用于验证 JWT。
  - **`authenticateSeller` 函数**：解析并验证 JWT，确保用户具有 `seller` 角色，返回用户对象。
  - **`requireSeller` 函数**：中间件函数，在需要保护的 API 路由中调用，确保只有认证且具有 `seller` 角色的用户才能访问。
- **功能扩展**：
  - 在 `User` 接口中添加 `roles` 字段，用于存储用户角色（如 `seller`）。
  - 修改现有的认证逻辑，确保卖家用户通过 `roles` 字段进行权限控制。

### 2.3 `src/routes/api/user/+server.ts`

**位置**：`src/routes/api/user/+server.ts`

**功能**：确保返回的用户数据包含 `roles` 字段，以便前端能够根据角色进行渲染和权限控制。

**修改内容**：

```typescript
// src/routes/api/user/+server.ts

import { collections } from "$lib/server/database";
import type { RequestHandler } from "@sveltejs/kit";
import { ObjectId } from "mongodb";

export const GET: RequestHandler = async ({ locals }) => {
  const userId = locals.userId;

  if (!userId) {
    return new Response(JSON.stringify({ error: "未授权" }), { status: 401 });
  }

  try {
    const user = await collections.users.findOne({ _id: new ObjectId(userId) });

    if (!user) {
      return new Response(JSON.stringify({ error: "用户未找到" }), { status: 404 });
    }

    return new Response(
      JSON.stringify({
        id: user._id.toString(),
        username: user.username,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl || null,
        hfUserId: user.hfUserId || null,
        points: user.points || 0,
        subscriptionStatus: user.subscriptionStatus || "inactive",
        subscriptionPlan: user.subscriptionPlan || null,
        subscriptionExpiry: user.subscriptionExpiry ? user.subscriptionExpiry.toISOString() : null,
        referralCode: user.referralCode || null,
        stripeCustomerId: user.stripeCustomerId || null,
        roles: user.roles, // 确保 roles 被返回
      }),
      { status: 200 }
    );
  } catch (err) {
    console.error("Error fetching user data:", err);
    return new Response(JSON.stringify({ error: "无法获取用户数据" }), { status: 500 });
  }
};
```

**修改说明**：

- **更新**：在返回的用户数据中添加 `roles` 字段，以确保前端可以根据用户角色进行权限控制。

## 三、确保现有文件支持新增功能

### 3.1 确保 `src/lib/utils/sha256.ts` 存在

**位置**：`src/lib/utils/sha256.ts`

**功能**：提供 SHA-256 哈希函数，用于生成 CSRF Token 和会话 ID 哈希。

**代码内容**：

```typescript
// src/lib/utils/sha256.ts

import { createHash } from 'crypto';

/**
 * 生成 SHA-256 哈希
 * @param data 输入字符串
 * @returns 哈希字符串
 */
export async function sha256(data: string): Promise<string> {
  return createHash('sha256').update(data).digest('hex');
}
```

**说明**：

- **确认存在**：确保 `sha256.ts` 文件存在并正确实现哈希功能，以支持认证流程中的安全操作。

## 四、其他注意事项

### 4.1 环境变量配置

确保以下环境变量在您的项目中正确配置，以支持 OIDC 认证和 JWT 生成：

```env
# OIDC 配置
OPENID_CLIENT_ID=your_client_id
OPENID_CLIENT_SECRET=your_client_secret
OPENID_PROVIDER_URL=https://your-oidc-provider.com
OPENID_SCOPES=openid profile email
OPENID_NAME_CLAIM=name
OPENID_TOLERANCE=60
OPENID_RESOURCE=your_resource

# JWT 配置
JWT_SECRET=your_jwt_secret

# MongoDB 配置
MONGODB_URL=mongodb://localhost:27017
MONGODB_DB_NAME=your_db_name

# 其他相关配置
VITE_BASE_URL=http://localhost:3000
ALLOW_INSECURE_COOKIES=false
```

**说明**：

- **`OPENID_*`**：用于配置 OIDC 提供商的信息。
- **`JWT_SECRET`**：用于签名和验证 JWT 令牌，确保其安全性。
- **`MONGODB_URL` 和 `MONGODB_DB_NAME`**：用于连接 MongoDB 数据库。
- **`VITE_BASE_URL`**：前端应用的基础 URL，用于生成回调 URI。
- **`ALLOW_INSECURE_COOKIES`**：控制 Cookie 的安全属性，生产环境应设置为 `false`。

### 4.2 安装必要的依赖

确保项目中已安装 `jsonwebtoken` 及其类型定义，以支持 JWT 的生成和验证：

```bash
npm install jsonwebtoken
npm install --save-dev @types/jsonwebtoken
```

## 五、示例 API 调用

以下是如何在前端调用新增的 Marketplace API 路由的示例代码：

### 5.1 获取卖家的所有产品

```javascript
// 示例：获取卖家的所有产品
const response = await fetch('/api/marketplace/products', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${jwtToken}`,
  },
});
const data = await response.json();
console.log(data);
```

### 5.2 创建新产品

```javascript
// 示例：创建新产品
const newProduct = {
  title: '新产品',
  description: '这是一个新产品',
  price: 99.99,
  images: ['https://example.com/image1.jpg'],
  stock: 10,
  status: 'draft',
};

const createResponse = await fetch('/api/marketplace/products', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${jwtToken}`,
  },
  body: JSON.stringify(newProduct),
});
const createdData = await createResponse.json();
console.log(createdData);
```

### 5.3 获取卖家的所有订单

```javascript
// 示例：获取卖家的所有订单
const ordersResponse = await fetch('/api/marketplace/orders', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${jwtToken}`,
  },
});
const ordersData = await ordersResponse.json();
console.log(ordersData);
```

### 5.4 更新指定产品

```javascript
// 示例：更新指定产品
const updatedProductData = {
  price: 89.99,
  stock: 15,
  status: 'published',
};

const updateResponse = await fetch('/api/marketplace/products/<product_id>', {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${jwtToken}`,
  },
  body: JSON.stringify(updatedProductData),
});
const updatedData = await updateResponse.json();
console.log(updatedData);
```

### 5.5 删除指定产品

```javascript
// 示例：删除指定产品
const deleteResponse = await fetch('/api/marketplace/products/<product_id>', {
  method: 'DELETE',
  headers: {
    'Authorization': `Bearer ${jwtToken}`,
  },
});
const deleteData = await deleteResponse.json();
console.log(deleteData);
```

**说明**：

- **替换 `<product_id>`**：将 `<product_id>` 替换为实际的产品 ID。
- **`jwtToken`**：确保在前端存储并正确传递 JWT 令牌，以进行认证。

## 六、总结

通过上述步骤和代码整理，您可以在 **HuggingChat UI** 项目中成功实现 **Marketplace** 卖家用户的 **OIDC** 认证与授权功能。主要步骤包括：

1. **更新数据库模式**：新增 Marketplace 相关的集合，并确保用户角色管理。
2. **修改认证逻辑**：确保通过 JWT 验证用户身份及其角色。
3. **新增 API 路由**：为卖家登录、回调、用户信息获取及 Marketplace 功能（产品和订单管理）创建相应的 API 端点。
4. **前端调用示例**：提供了如何在前端调用这些 API 的示例代码，确保前后端协同工作。

### 关键点

- **安全性**：
  - 使用 HttpOnly 和 Secure 属性的 Cookie 存储 JWT，防止 XSS 攻击。
  - 验证用户角色，确保只有具备 `seller` 角色的用户可以访问 Marketplace 功能。
  
- **错误处理**：
  - 在 API 路由中妥善处理各种错误情况，提供明确的错误信息，提升用户体验。
  
- **数据同步与索引**：
  - 确保 Marketplace 数据（产品、订单）与数据库同步，并通过创建索引优化查询性能。
  
- **环境变量管理**：
  - 确保所有必要的环境变量已正确配置，以支持 OIDC 认证和 JWT 生成。

如有更多具体需求或问题，欢迎进一步交流！