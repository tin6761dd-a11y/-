# 迅頁 AdPage — 廣告落地頁產生器

快速產生產品促銷、服務介紹、活動宣傳與電商商品等行銷落地頁。可即時預覽、儲存專案，並匯出獨立的靜態網站（單一 `index.html` 或 ZIP）。

介面語言：繁體中文（台灣）。

## 功能（第一版）

- 帳號註冊／登入（密碼雜湊、Session Cookie）
- **第一個註冊的帳號自動成為管理員**；也可以設定環境變數 `ADMIN_EMAIL`
- 建立與編輯廣告網站：品牌、產品／服務、標語、說明、特色、售價與優惠、行動按鈕、聯絡資訊、活動時間、圖片網址
- 四種模板：產品促銷、服務介紹、活動宣傳（含倒數計時）、電商商品頁
- 五種風格：專業藍調（預設）、現代簡約、科技深色、活力繽紛、奢華質感，並可自訂主色
- 桌面／手機即時預覽
- 匯出單一 HTML 或 ZIP（內含 `index.html`）
- 專案可儲存、列表、編輯、刪除
- 「載入示例內容」預填 **益芳封口機**（封口機、果糖機等設備之維修與買賣）文案，主色為藍色。聯絡電話與地址使用「請填入電話」等占位文字，不會預填虛構號碼
- 管理後台 `/admin`：使用者列表、所有已生成網站、登入／生成／匯出等活動紀錄、統計卡片；可停用、刪除使用者或提升為管理員。一般使用者無法進入

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

請用瀏覽器開啟上述網址，先註冊第一個帳號（此帳號會是管理員），即可開始建立網站。進入「管理後台」可看到所有使用者與他們生成的網站。

## 環境變數

可複製 `.env.example` 後自行匯出，或在啟動前設定：

| 變數 | 說明 |
| --- | --- |
| `PORT` | 埠號，預設 `3000` |
| `SESSION_SECRET` | Session 加密金鑰。正式環境請改成夠長的隨機字串 |
| `ADMIN_EMAIL` | 可選。此信箱註冊或登入時會自動成為管理員 |
| `DATA_DIR` | 資料存放目錄，預設為專案內 `data/` |

資料以 JSON 檔儲存在 `DATA_DIR`（使用者、網站、活動紀錄、Session），不會上傳到 Git。

## 之後部署到 Vercel / Netlify 的說明

此原型是 **Node.js + Express** 應用，含登入與 JSON 檔儲存，適合先跑在一台長期運作的伺服器（例如 VPS、Railway、Render、Fly.io）。

- **產生出來的廣告網站**本身是純靜態頁（單一 `index.html`）。匯出後可以：
  1. 直接用瀏覽器開啟檢查
  2. 把檔案（或 ZIP 解壓後的資料夾）拖到 [Netlify Drop](https://app.netlify.com/drop) 或用 Vercel／Netlify CLI 發佈
  3. 之後可再接「一鍵發佈到 Vercel / Netlify」的 API（本版尚未串接，需要你提供帳號授權）
- 若要把「迅頁」這個產生器平台本身部署到 Vercel / Netlify：
  - 需要改成 Serverless 或分開前後端
  - JSON 檔不適合無伺服器環境的多次寫入，建議改用資料庫（例如 PostgreSQL、SQLite on volume、或雲端 KV）
  - Session 也需改為集中式儲存
  - 目前尚未設定這些雲端服務，需要時再一起處理

## 專案結構

```
ad-site-builder/
  server.js              # Express 進入點與 API
  src/                   # 資料儲存、模板、Session
  public/                # 前端頁面（無需打包）
    index.html           # 登入／註冊
    app.html             # 工作台與編輯器
    admin.html           # 管理後台
    js/templates.js      # 落地頁模板（前後端共用）
    js/samples.js        # 益芳封口機示例內容
  data/                  # 執行後寫入的 JSON（請勿提交機密資料）
```

## 注意事項

- 這是第一個可用原型，尚未做電子郵件驗證、備份或進階權限分級。
- 匯出的頁面會引用 Google Fonts；圖片需使用你提供的 https 網址，不會自動下載到 ZIP 中。
- 請在正式環境更換 `SESSION_SECRET`，並以 HTTPS 提供服務。
