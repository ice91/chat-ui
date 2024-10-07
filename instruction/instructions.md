# 專案需求文件（PRD）

## 一、專案概述

### 1.1 目標

將現有的 **HuggingChat UI** 系統擴展為一個獨立的 **Marketplace** 平台，允許用戶（賣家）創建、管理並銷售 AI 生成的藝術作品。該平台將使用 **Shopify Hydrogen 框架** 作為前端，並在其內部集成後端功能（使用 TypeScript 開發），以處理複雜的業務邏輯和數據管理。

同時，需考慮到買家與賣家是不同的用戶群體：

- **賣家**：與 HuggingChat UI 共用認證機制和數據模型，使用 OIDC 認證。
- **買家**：使用 Shopify 的用戶認證，內建於 Hydrogen 框架中。

### 1.2 背景

- **現有功能**：
  - 用戶認證（透過 OIDC，針對賣家）
  - 訂閱管理（使用 Stripe）
  - MongoDB 數據庫

- **計劃擴展**：
  - 整合 **Gelato API**，實現產品上架到 Shopify 商店
  - 使用 **Shopify Hydrogen 框架**，構建自定義前端
  - 在 Hydrogen 框架內集成後端功能（使用 TypeScript 開發）
  - 考慮買家與賣家不同的用戶身份和認證方式

---

## 二、目標與目的

- **建立獨立的 Marketplace 平台**：允許賣家創建、管理及銷售 AI 生成的藝術作品，買家可以方便地瀏覽和購買產品。
- **整合 Shopify Hydrogen 框架**：使用 Hydrogen 框架構建高度自定義的前端，並在其內部集成後端功能。
- **最小化開發成本**：利用現有的 HuggingChat UI 系統和第三方服務，減少重複開發。
- **區分買家與賣家的用戶體驗**：賣家使用現有的認證系統，買家使用 Shopify 的認證機制。
- **提升用戶體驗**：提供友好的用戶界面和便捷的操作流程，確保優秀的性能和 SEO 表現。

---

## 三、範圍

### 3.1 包含

- **賣家功能**：
  - 用戶認證與授權（共用 HuggingChat UI 的認證）
  - 產品管理
  - 收益管理
  - 用戶店面頁面

- **買家功能**：
  - 商品瀏覽與搜索
  - 購物車與結帳流程（使用 Shopify 內建功能）
  - 訂單追蹤與管理（透過 Shopify 提供）

- **系統功能**：
  - Marketplace 展示
  - 訂單與支付處理
  - 數據同步與一致性

### 3.2 不包含

- 高級分析與推薦系統（可作為未來擴展）
- 非核心功能如社交分享、評論系統等（可後續添加）

---

## 四、核心功能與數據模型

### 4.1 賣家功能

#### 4.1.1 用戶認證與授權（**必須功能**）

**描述**：賣家使用與 HuggingChat UI 共用的認證系統（OIDC）登入和管理產品。

**需求細節**：

- **用戶認證**：
  - 賣家透過 OIDC 認證機制登入。
  - 與 HuggingChat UI 保持一致的用戶體驗。

- **授權與權限控制**：
  - 實施角色基礎的存取控制（RBAC），區分賣家和管理員。
  - 賣家只能管理自己的產品和資料。

**數據模型**：

```typescript
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
  avatarUrl?: string;
  hfUserId: string;
  isAdmin?: boolean;
  isEarlyAccess?: boolean;
  storefrontUrl?: string;
  earnings?: number;
  paymentDetails?: PaymentDetails;
  roles?: string[]; // 新增欄位
}
```

**文件結構影響**：

- **後端（Hydrogen 框架內）**：
  - `/server/auth/`：處理賣家的認證與授權邏輯。

- **前端**：
  - `/app/routes/seller/login.tsx`：賣家登入頁面。
  - `/app/components/SellerAuthProvider.tsx`：處理賣家認證狀態。

#### 4.1.2 產品管理（**必須功能**）

**描述**：賣家可以創建、編輯、刪除藝術作品，並上架至 Shopify 商店。

**需求細節**：

- **創建產品**：
  - 賣家通過 HuggingChat UI 生成藝術作品。
  - 保存產品資料到 MongoDB 的 `Product` 集合。
  - 使用 **Gelato API** 創建產品模板，獲取 `podProductId`。
  - 使用 **Shopify API** 將產品上架，獲取 `shopifyProductId`。

- **編輯與刪除產品**：
  - 賣家可以編輯產品資訊，變更同步至 Shopify 和 Gelato。
  - 刪除產品時，同步刪除 Shopify 商店中的產品。

**數據模型**：

```typescript
export interface Product extends Timestamps {
  _id: ObjectId;
  userId: ObjectId; // 賣家ID，與 User._id 對應
  title: string;
  description: string;
  images: string[];
  price: number;
  shopifyProductId?: string;
  podProductId?: string;
  status: 'draft' | 'published' | 'sold' | 'deleted';
  tags?: string[];
  categoryIds?: ObjectId[]; // 支持多分類
  createdAt: Date;
  updatedAt: Date;
}
```

**文件結構影響**：

- **後端**：
  - `/server/controllers/productController.ts`：處理產品邏輯。
  - `/server/routes/productRoutes.ts`：產品相關的 API 路由。

- **前端**：
  - `/app/routes/seller/products/create.tsx`：產品創建頁面。
  - `/app/routes/seller/products/edit/$productId.tsx`：產品編輯頁面。
  - `/app/components/Seller/ProductForm.tsx`：產品表單組件。

#### 4.1.3 收益管理（**選擇性功能**）

**描述**：賣家可以查看自己的銷售收益，並處理收益結算。

**需求細節**：

- **收益查看**：
  - 賣家在個人中心查看總收益和交易明細。

- **收益結算**：
  - 使用 **Stripe Connect** 進行收益分配和支付。

**數據模型**：

```typescript
export interface Earning extends Timestamps {
  _id: ObjectId;
  userId: ObjectId; // 賣家ID
  orderId: ObjectId;
  amount: number;
  status: 'pending' | 'paid' | 'failed';
  createdAt: Date;
  updatedAt: Date;
}
```

**文件結構影響**：

- **後端**：
  - `/server/controllers/earningsController.ts`：處理收益邏輯。
  - `/server/routes/earningsRoutes.ts`：收益相關的 API 路由。

- **前端**：
  - `/app/routes/seller/earnings.tsx`：收益查看頁面。
  - `/app/components/Seller/EarningsDashboard.tsx`：收益儀表板組件。

#### 4.1.4 用戶店面頁面（**選擇性功能**）

**描述**：為每個賣家提供個人化的店面頁面，展示其所有產品。

**需求細節**：

- **店面頁面**：
  - URL 結構：`/storefront/:sellerUsername`。
  - 顯示賣家的個人資訊和產品列表。

**數據模型**：

```typescript
export interface Storefront extends Timestamps {
  _id: ObjectId;
  userId: ObjectId; // 賣家ID
  storefrontUrl: string;
  bannerImageUrl?: string;
  theme?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

**文件結構影響**：

- **前端**：
  - `/app/routes/storefront/$sellerUsername.tsx`：賣家店面頁面。
  - `/app/components/StorefrontHeader.tsx`：店面頭部組件。

### 4.2 買家功能

#### 4.2.1 商品瀏覽與搜索（**必須功能**）

**描述**：買家可以瀏覽所有上架的產品，並進行搜索和篩選。

**需求細節**：

- **產品列表展示**：
  - 顯示所有 `status: 'published'` 的產品。
  - 支持按分類、標籤、賣家篩選和搜索。

- **產品詳情頁面**：
  - 顯示產品的詳細資訊和購買選項。

**文件結構影響**：

- **前端**：
  - `/app/routes/marketplace/index.tsx`：Marketplace 主頁。
  - `/app/routes/products/$productHandle.tsx`：產品詳情頁面。
  - `/app/components/ProductCard.tsx`：產品卡片組件。
  - `/app/components/FilterSort.tsx`：篩選和排序組件。

#### 4.2.2 購物車與結帳流程（**必須功能**）

**描述**：買家可以將產品加入購物車，並通過 Shopify 的結帳流程完成購買。

**需求細節**：

- **購物車功能**：
  - 買家可以將產品加入購物車。
  - 購物車資訊存儲在 Shopify 的客戶端。

- **結帳流程**：
  - 使用 Shopify 提供的結帳頁面。
  - 買家使用 Shopify 的用戶認證（可選）。

**文件結構影響**：

- **前端**：
  - `/app/components/Cart.tsx`：購物車組件。
  - `/app/routes/cart.tsx`：購物車頁面。
  - 使用 Shopify Hydrogen 提供的購物車和結帳組件。

#### 4.2.3 訂單追蹤與管理（**選擇性功能**）

**描述**：買家可以查看自己的訂單狀態和歷史。

**需求細節**：

- **訂單查看**：
  - 買家可以在個人中心查看訂單狀態。

- **訂單管理**：
  - 透過 Shopify 提供的客戶端功能。

**文件結構影響**：

- **前端**：
  - `/app/routes/account/orders.tsx`：買家訂單頁面。
  - `/app/components/OrderList.tsx`：訂單列表組件。

### 4.3 系統功能

#### 4.3.1 訂單與支付處理（**必須功能**）

**描述**：處理訂單的同步和支付，賣家可以查看訂單狀態。

**需求細節**：

- **訂單同步**：
  - 設置 Shopify Webhook，接收訂單狀態更新。
  - 更新 MongoDB 的 `Order` 集合，保存訂單資訊。

- **收益計算**：
  - 根據訂單金額計算賣家收益，更新 `Earning` 模型。

**數據模型**：

```typescript
export interface Order extends Timestamps {
  _id: ObjectId;
  shopifyOrderId: string;
  productId: ObjectId;
  sellerId: ObjectId;
  amount: number;
  commission: number;
  earnings: number;
  status: 'pending' | 'completed' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
}
```

**文件結構影響**：

- **後端**：
  - `/server/controllers/orderController.ts`：處理訂單邏輯。
  - `/server/routes/orderRoutes.ts`：訂單相關的 API 路由。
  - `/server/webhooks/shopifyWebhook.ts`：處理 Shopify Webhook。

---

## 五、技術細節與文件結構

### 5.1 技術棧

- **開發語言**：TypeScript
- **前端框架**：Shopify Hydrogen（基於 React）
- **後端框架**：Node.js 和 Express（集成在 Hydrogen 框架內）
- **數據庫**：MongoDB（使用 Mongoose 進行數據建模）
- **樣式**：Tailwind CSS
- **狀態管理**：React Hooks 和 Context API
- **認證機制**：
  - **賣家**：使用 OIDC，與 HuggingChat UI 共用。
  - **買家**：使用 Shopify 內建的客戶認證。

### 5.2 文件結構

基於 Hydrogen Demo 商店的檔案結構，進行適當的擴展和調整。

**根目錄結構**：

```
project/
├── app/
│   ├── assets/
│   ├── components/
│   ├── data/
│   ├── entry.client.tsx
│   ├── entry.server.tsx
│   ├── graphql/
│   ├── hooks/
│   ├── lib/
│   ├── root.tsx
│   ├── routes/
│   └── styles/
├── server/
│   ├── controllers/
│   ├── routes/
│   ├── webhooks/
│   ├── models/
│   ├── middlewares/
│   ├── utils/
│   └── index.ts
├── package.json
├── tsconfig.json
├── tailwind.config.js
└── ...
```

**詳細結構與說明**：

- **app/**：前端代碼，包括頁面路由、組件和樣式等。

  - **assets/**：靜態資源，如圖片、圖標等。
  - **components/**：UI 組件。
    - **Seller/**：賣家相關的組件。
      - `ProductForm.tsx`：產品表單。
      - `EarningsDashboard.tsx`：收益儀表板。
    - **Common 組件**：如 `ProductCard.tsx`、`Cart.tsx`、`FilterSort.tsx` 等。
  - **data/**：數據相關文件，如 GraphQL fragments。
  - **graphql/**：GraphQL 查詢和突變。
  - **hooks/**：自定義 Hooks。
  - **lib/**：工具函數、常量等。
  - **routes/**：頁面路由。
    - `/marketplace/index.tsx`：Marketplace 主頁。
    - `/products/$productHandle.tsx`：產品詳情頁。
    - `/seller/*`：賣家相關頁面。
      - `/seller/login.tsx`：賣家登入頁面。
      - `/seller/products/*`：產品管理頁面。
      - `/seller/earnings.tsx`：收益查看頁面。
    - `/storefront/$sellerUsername.tsx`：賣家店面頁面。
    - `/cart.tsx`：購物車頁面。
    - `/account/*`：買家帳戶頁面。
  - **styles/**：樣式文件，使用 Tailwind CSS。

- **server/**：後端代碼，包括控制器、路由、模型和中間件等。

  - **controllers/**：處理業務邏輯。
    - `productController.ts`：產品邏輯。
    - `orderController.ts`：訂單邏輯。
    - `earningsController.ts`：收益邏輯。
    - `authController.ts`：認證與授權。
  - **routes/**：API 路由。
    - `productRoutes.ts`：產品相關 API。
    - `orderRoutes.ts`：訂單相關 API。
    - `earningsRoutes.ts`：收益相關 API。
    - `authRoutes.ts`：認證相關 API。
  - **webhooks/**：處理 Webhook。
    - `shopifyWebhook.ts`：處理 Shopify Webhook。
    - `gelatoWebhook.ts`：處理 Gelato Webhook。
  - **models/**：資料模型。
    - `User.ts`、`Product.ts`、`Order.ts`、`Earning.ts`、`Storefront.ts`。
  - **middlewares/**：中間件。
    - `authMiddleware.ts`：認證中間件。
    - `errorHandler.ts`：錯誤處理。
  - **utils/**：工具函數。
  - **index.ts**：後端入口文件。

### 5.3 關鍵技術點與實施細節

#### 5.3.1 前後端集成

- **自定義服務器**：在 `server/index.ts` 中設置 Express 服務器，並在 `app/entry.server.tsx` 中引入。
- **API 路由**：通過 Express 定義 API 路由，前端通過 Fetch API 或 Axios 調用。
- **Hydrogen 與後端共享**：利用 Remix 的 Loader 和 Action，實現服務器端數據加載和處理。

#### 5.3.2 賣家認證與權限控制

- **OIDC 認證**：在後端設置 OIDC 認證流程，使用相同的認證服務器。
- **前端認證狀態管理**：使用 Context API 管理賣家的認證狀態。
- **路由保護**：對 `/seller/*` 路由進行保護，未登入賣家將被重定向到登入頁面。

#### 5.3.3 賣家產品管理

- **產品創建與編輯**：在前端提供產品表單，提交後調用後端 API 保存到 MongoDB，並同步到 Shopify 和 Gelato。
- **圖片上傳**：支持圖片上傳，存儲在雲端存儲服務，如 AWS S3。
- **產品同步**：使用 Shopify 和 Gelato 的 API，同步產品資料。

#### 5.3.4 買家購物流程

- **購物車與結帳**：使用 Shopify Hydrogen 提供的購物車和結帳組件，無需自行實現複雜的購物流程。
- **產品展示**：從 Shopify Storefront API 獲取產品資料，展示在前端。
- **買家認證**：可選，使用 Shopify 的客戶認證系統。

#### 5.3.5 訂單與收益管理

- **訂單同步**：設置 Shopify Webhook，當有訂單創建或更新時，觸發後端處理，更新訂單和收益資料。
- **收益計算**：在後端根據訂單金額計算賣家的收益，並更新 `Earning` 模型。
- **支付分潤**：使用 Stripe Connect，自動化收益結算流程。

---

## 六、開發指南與最佳實踐

### 6.1 代碼風格與規範

- **TypeScript**：前後端都使用 TypeScript，提高代碼的可維護性。
- **代碼格式化**：使用 Prettier 統一代碼格式。
- **Linting**：使用 ESLint 檢查代碼質量。

### 6.2 組件設計

- **可重用性**：優先開發可重用的組件，減少重複代碼。
- **Tailwind CSS**：使用 Tailwind CSS 提高開發效率，避免寫過多的自定義樣式。
- **Accessibility（無障礙性）**：遵循無障礙設計原則，提高用戶體驗。

### 6.3 性能優化

- **SSR 和 CSR 平衡**：利用 Hydrogen 的服務器端渲染（SSR）特性，提高首屏加載速度。
- **代碼拆分與懶加載**：對大型組件進行代碼拆分，使用懶加載減少初始加載時間。
- **圖片優化**：使用適當的圖片格式和壓縮，減少資源佔用。

### 6.4 安全性

- **API 安全**：保護後端 API，防止未經授權的訪問。
- **數據驗證**：對所有輸入進行驗證和消毒，防止注入攻擊。
- **環境變數管理**：敏感信息如 API 金鑰應存放在環境變數中，不應提交到版本控制系統。

---

## 七、測試與部署

### 7.1 測試計劃

- **單元測試**：使用 Jest 進行單元測試，覆蓋關鍵功能。
- **集成測試**：測試前後端交互，確保 API 和數據流正常。
- **端到端測試**：使用 Cypress 模擬用戶行為，測試完整流程。

### 7.2 持續集成/持續部署（CI/CD）

- **CI 工具**：使用 GitHub Actions 或 Jenkins，自動化測試流程。
- **CD 工具**：自動化部署到測試和生產環境。

### 7.3 部署策略

- **前端部署**：使用 Vercel 或 Netlify，支持 Hydrogen 框架的服務器端渲染。
- **後端部署**：與前端一起部署，利用同一個服務器環境。
- **數據庫**：使用 MongoDB Atlas 作為雲端數據庫服務。

---

## 八、項目管理

### 8.1 任務分配

- **模塊劃分**：根據功能模塊（賣家、買家、系統功能）分配任務。
- **里程碑設定**：設定項目階段性目標，確保按時完成。

### 8.2 溝通與協作

- **每日站會**：短暫的同步會議，了解項目進度和問題。
- **文檔維護**：使用 Confluence 或 GitHub Wiki，保持文檔更新。

### 8.3 風險管理

- **技術培訓**：確保團隊熟悉 Hydrogen 框架和相關技術。
- **問題跟蹤**：使用 Jira 或 Trello 跟蹤問題和進度。

---

## 九、結論

該 PRD 詳細描述了項目的目標、範圍、核心功能、數據模型、技術細節和開發指南。通過整合新的數據模型和 Hydrogen Demo 商店的檔案結構，為開發團隊提供了清晰的實施路徑。

作為 UI/UX 專家、Shopify 和 Hydrogen 框架專家，我們強調了避免不必要的重複與複雜性，選擇最適合的工具和技術，以確保項目順利進行並達成目標。

---

**備註**：此文件已根據您的要求，加入了新的數據模型和文件結構細節，為開發者提供了清晰的指導，便於理解和實施項目。