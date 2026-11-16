# 迅頁 AdPage — 廣告落地頁產生器

快速產生產品促銷、服務介紹、活動宣傳與電商商品等行銷落地頁。可即時預覽、儲存專案，發佈公開官網連結，並匯出獨立的靜態網站（單一 `index.html` 或 ZIP）。

介面語言：繁體中文（台灣）。

## 功能

- 帳號註冊／登入（密碼雜湊、Session Cookie）。登入與註冊可使用 **3–40 字英數字帳號** 或電子郵件
- 管理員來源：
  - 若設定 `ADMIN_EMAIL` 與 `ADMIN_PASSWORD_HASH`，啟動時會預先建立該管理員（已存在則略過）
  - 符合 `ADMIN_EMAIL` 的帳號登入或註冊時會成為管理員
  - **僅在未設定 `ADMIN_EMAIL` 時**，第一個註冊的帳號才會自動成為管理員
- 建立與編輯廣告網站：品牌、產品／服務、標語、說明、特色、售價與優惠、行動按鈕、聯絡資訊、活動時間
- **多張圖片**：最多 10 張，可從電腦或手機上傳，或貼上 https 網址；可排序、刪除，並指定一張主圖。上傳時會在瀏覽器縮小（最長邊約 1600px）並壓縮為 JPEG／WebP（約 0.8 品質，單張壓縮後限約 1.5 MB），檔案存在伺服器 `DATA_DIR/uploads/`
- 四種模板皆會使用主圖，並在有多張圖片時顯示響應式圖片集／輪播
- 五種風格：專業藍調（預設）、現代簡約、科技深色、活力繽紛、奢華質感，並可自訂主色
- 桌面／手機即時預覽
- **發佈官網連結**：在編輯器按「發佈網站」，自訂網址代號（小寫英文、數字、連字號）後，公開網址為 `/s/<代號>`，無需登入即可開啟。可複製網址、開新分頁，並顯示 QR code。發佈使用最近一次儲存的內容；可取消發佈（之後該網址會顯示找不到）
- **搜尋引擎（SEO）**：已發佈頁使用 `lang="zh-Hant-TW"`、canonical、可編輯的 SEO 標題／說明／關鍵字、Open Graph 與 Twitter Card，以及 JSON-LD（LocalBusiness／Store；有售價的商品另加 Product／Offer，幣別 TWD）。佔位文字（如「請填入電話」）不會寫入結構化資料。提供 `/robots.txt`（允許 `/s/`，禁止 `/app`、`/admin`、`/api`）與列出所有已發佈頁的 `/sitemap.xml`
- **商品列表**：每個網站可加入多項商品（名稱、售價 NT$、短述、一張或多張圖片、選填購買連結例如蝦皮）。四種模板都會以響應式格狀呈現，也可透過 `PUT /api/sites/:id` 的 `data.products` 以 JSON 設定
- **Google Search Console**：設定環境變數 `GOOGLE_SITE_VERIFICATION` 後，首頁與已發佈頁會加入驗證用 meta
- **管理員備份／還原**：`GET /api/admin/backup` 匯出使用者、網站與上傳圖片（含 base64）；`POST /api/admin/restore`（需 `confirm: true`）還原。管理後台也有下載與還原按鈕
- 匯出單一 HTML（上傳的圖片會以 data URI 內嵌，檔案本身可離線開啟）或 ZIP（圖片放在 `images/` 資料夾）
- 專案可儲存、列表、編輯、刪除
- 「載入示例內容」預填 **益芳封口機**（封口機、果糖機等設備之維修與買賣）文案，主色為藍色。聯絡電話與地址使用「請填入電話」等占位文字，不會預填虛構號碼
- 管理後台 `/admin`：使用者列表、所有已生成網站（含發佈狀態與公開連結）、登入／生成／匯出／發佈等活動紀錄、統計卡片；可停用、刪除使用者或提升為管理員。一般使用者無法進入

## 本機執行

需要 Node.js 18 以上。

```bash
cd ad-site-builder
npm install
npm start
```

預設網址：[http://127.0.0.1:3000](http://127.0.0.1:3000)

開發時可使用自動重整：

```bash
npm run dev
```

請用瀏覽器開啟上述網址並登入或註冊。進入「管理後台」可看到所有使用者與他們生成、發佈的網站。

## 環境變數

可複製 `.env.example` 後自行匯出，或在啟動前設定：

| 變數 | 說明 |
| --- | --- |
| `PORT` | 埠號，預設 `3000` |
| `SESSION_SECRET` | Session 加密金鑰。正式環境請改成夠長的隨機字串 |
| `ADMIN_EMAIL` | 可選。此帳號（信箱或使用者名稱）會成為管理員 |
| `ADMIN_PASSWORD_HASH` | 可選。與 `ADMIN_EMAIL` 一併使用，啟動時預先建立管理員（bcrypt 雜湊） |
| `PUBLIC_BASE_URL` | 建議設定。公開網址來源（robots、sitemap、官網連結、Open Graph），例如 `https://yifang-ad-builder.onrender.com` |
| `PUBLIC_ORIGIN` | 可選。若未設 `PUBLIC_BASE_URL`，會使用此值（相容舊設定） |
| `GOOGLE_SITE_VERIFICATION` | 可選。Google Search Console 提供的驗證碼 |
| `DATA_DIR` | 資料存放目錄，預設為專案內 `data/`。上傳圖片存在 `DATA_DIR/uploads/` |

資料以 JSON 檔與上傳圖片儲存在 `DATA_DIR`（使用者、網站、活動紀錄、Session、uploads），不會上傳到 Git。

## 部署注意（Render 免費方案）

此專案可部署到 Render 等長期運作的 Node 服務。若使用 **免費方案的臨時磁碟（ephemeral disk）**：

- 伺服器重新啟動、睡眠後再醒來，或重新部署時，儲存在磁碟上的資料可能會消失
- 這包含：**已上傳的圖片**、**已發佈的官網頁面**、使用者與專案資料（若也寫在同一顆臨時磁碟上）

正式使用建議改成持久磁碟或外部物件儲存／資料庫，並用管理後台的備份功能把資料移過去。請設定 `PUBLIC_BASE_URL` 為公開網域，讓 sitemap、Open Graph 與官網連結使用正確網址。

## 之後部署到 Vercel / Netlify 的說明

此應用是 **Node.js + Express**，含登入、JSON 檔與本機上傳檔案，適合先跑在一台長期運作的伺服器（例如 VPS、Railway、Render、Fly.io）。

- **產生出來的廣告網站**本身是靜態頁。除了在本平台按「發佈網站」取得 `/s/<代號>` 連結外，也可以：
  1. 匯出 HTML／ZIP，直接用瀏覽器開啟檢查
  2. 把檔案拖到 [Netlify Drop](https://app.netlify.com/drop) 或用 Vercel／Netlify CLI 發佈
- 若要把「迅頁」這個產生器平台本身部署到 Vercel / Netlify：
  - 需要改成 Serverless 或分開前後端
  - JSON 檔與本機 `uploads/` 不適合無伺服器環境的多次寫入，建議改用資料庫與物件儲存
  - Session 也需改為集中式儲存

## 專案結構

```
ad-site-builder/
  server.js              # Express 進入點與 API
  src/                   # 資料儲存、模板、圖片、Session
  public/                # 前端頁面（無需打包）
    index.html           # 登入／註冊
    app.html             # 工作台與編輯器
    admin.html           # 管理後台
    js/templates.js      # 落地頁模板（前後端共用）
    js/samples.js        # 益芳封口機示例內容
    js/vendor/           # 本機 QR code 函式庫（無須外連 CDN）
  data/                  # 執行後寫入的 JSON 與 uploads（請勿提交機密資料）
```

## 商品列表 JSON 格式

擁有者或管理員可在儲存網站時一併送出 `data.products`（一般的 `PUT /api/sites/:id` 或 `POST /api/sites` 即可）：

```json
{
  "products": [
    {
      "name": "益芳手動封口機（通用杯徑）",
      "price": "12800",
      "description": "適合手搖飲與外帶茶飲，封口平整、好保養。",
      "images": [
        "https://example.com/sealer.jpg",
        "/uploads/abc123def456"
      ],
      "buyUrl": "https://shopee.tw/product-example"
    }
  ]
}
```

欄位說明：

- `name`（必填）：商品名稱
- `price`：售價，建議填數字或 `NT$ 12,800`；有可解析的數字時，結構化資料會以 **TWD** 輸出 Offer
- `description`：短述
- `images`：圖片陣列，可為 `https://` 網址或本站上傳路徑 `/uploads/<id>`（一項商品最多 8 張）
- `buyUrl`：選填的購買連結（例如蝦皮商品頁）。輸入時也接受 `buyLink`

每個網站最多 30 項商品。圖片也可在編輯器直接上傳。

## 注意事項


- 這是可用原型，尚未做電子郵件驗證、備份或進階權限分級。
- 匯出的頁面會引用 Google Fonts；以網址加入的外部圖片不會下載進 ZIP，只有「上傳」的圖片會內嵌或打包。
- 請在正式環境更換 `SESSION_SECRET`，並以 HTTPS 提供服務。
