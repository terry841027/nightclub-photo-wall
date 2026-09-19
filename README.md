# 現場照片牆 (Nightclub Photo Wall)

客人掃 QR Code 上傳直式照片 + 留言,照片自動輪播在 9:16 LED 大螢幕上,並可串接 Resolume Arena 播放。不需要 VJ 人員,也不需要 OBS 或擷取卡。

三個頁面:

- `/upload` — 客人用手機掃 QR Code 進來,拍照 + 留言 + 送出
- `/admin` — 工作人員用手機登入(密碼),審核待審照片、開關「是否需要審核」、顯示上傳用 QR Code
- `/display` — 給 LED 用的全螢幕頁面,自動輪播已通過的照片與留言

## 1. 建立 Supabase 專案

1. 到 [supabase.com](https://supabase.com) 建立一個新專案(免費方案即可)
2. 打開 **SQL Editor**,貼上並執行 `supabase/schema.sql` 的內容
3. 打開 **Storage**,建立一個新的 bucket,名稱 `photos`,並設定為 **Public bucket**
4. 到 **Project Settings -> API**,複製:
   - `Project URL` → 對應 `.env` 的 `SUPABASE_URL`
   - `service_role` key(不是 `anon` key!) → 對應 `.env` 的 `SUPABASE_SERVICE_ROLE_KEY`

`service_role` key 有完整讀寫權限,絕對不能出現在瀏覽器端程式碼裡。這個專案的設計是:瀏覽器完全不直接連 Supabase,所有存取都經過 Next.js 的 API routes,在伺服器端使用這個 key。

## 2. 本地開發

```bash
npm install
cp .env.example .env.local
# 編輯 .env.local 填入上面拿到的值,並自訂 ADMIN_PASSCODE

npm run dev
```

打開 http://localhost:3000/upload、/admin、/display 測試。

## 3. 部署到 Vercel

1. 到 [vercel.com](https://vercel.com),用 GitHub 帳號登入,Import 這個 repo
2. 在 Environment Variables 設定 `SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`、`SUPABASE_STORAGE_BUCKET`、`ADMIN_PASSCODE`
3. Deploy,拿到一個公開網址,例如 `https://nightclub-photo-wall.vercel.app`

之後每次改程式、推上 GitHub,Vercel 會自動重新部署。

## 4. 現場使用方式

- 印出 `/admin` 頁面上的 QR Code(或直接用手機打開 `/admin` 截圖),貼在現場給客人掃
- 工作人員手機開 `/admin`,輸入密碼登入,平時放著就好,有新照片時審核即可(也可以直接關掉審核,全自動)
- 控台電腦用瀏覽器全螢幕開 `https://你的網址/display`

## 5. 串接 Resolume Arena(不需要 OBS / 擷取卡)

最簡單的方式是用 **NDI**:

1. 到 [ndi.video/tools](https://ndi.video/tools) 下載並安裝免費的 **NDI Tools**,裡面有一個 **NDI Screen Capture** 程式
2. 開 **NDI Screen Capture**,選擇要擷取「開著 `/display` 頁面的那個瀏覽器視窗」,按開始 — 它就會把畫面變成一個 NDI 訊號,完全不需要碰任何複雜設定
3. 在 Resolume Arena 裡新增一個 **NDI** 來源(Arena 內建支援 NDI),選到剛剛那個訊號的名字,放進你的 9:16 layer 裡就完成了

整個流程只需要「開瀏覽器 -> 開 NDI Screen Capture 按開始 -> Arena 選 NDI 來源」,現場人員不需要懂 OBS 或任何擷取卡設定。

如果現場電腦有獨立顯卡且已經在用 Spout 生態,也可以改用 Spout 相關的瀏覽器擷取工具,效果類似,依現場習慣選一種即可。

## 資料模型

- `photos`:每張上傳的照片(圖片網址、留言、狀態 pending/approved、時間)
- `settings`:目前只有一個開關 `require_approval`(是否需要人工審核才顯示)

兩張表都開啟 RLS 且沒有掛任何 policy,代表只有伺服器端用 `service_role` key 才能讀寫,瀏覽器端(anon）完全無法直接存取,所有寫入都必須經過這個專案的 API 驗證。
