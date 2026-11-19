Global Market Intelligence V1.7 — GitHub Pages + Supabase (JavaScript / Node.js)
這是純 JavaScript 技術棧的基礎原型，沒有 Python、Streamlit 或本機後端。網站由 GitHub Pages 提供，資料庫由 Supabase 提供，擷取程式由 GitHub Actions 的 Node.js 執行。
部署
在 Supabase 新增專案，於 SQL Editor 執行 `sql/schema.sql`。
複製 `config.example.js` 為 `config.js`，填入 Supabase Project URL 和公開的 anon/publishable key。這是公開網站設定，不可填 service_role key。
建立 GitHub repository，例如 `global-market-intelligence`，將本 ZIP 解壓後的資料夾內所有檔案上傳至 repository 根目錄，包含 `.github` 隱藏資料夾。
在 GitHub → Settings → Secrets and variables → Actions 設定 `SUPABASE\_URL` 和 `SUPABASE\_SERVICE\_ROLE\_KEY`（機密，僅供 Actions）。
GitHub → Actions → `Manual market data sync` → Run workflow，查看同步日誌。
GitHub → Settings → Pages → Deploy from a branch → `main` / `(root)`，使用產生的網址開啟。
重要限制
開啟網站只會讀取 Supabase 資料，不會自動更新；目前透過 Actions 手動同步。
TechNews RSS、TWSE OpenAPI 尚需實際網路驗證；TWSE 資料若沒有可確認的交易日期，會明確報錯而非使用錯誤日期。
鉅亨網、MOPS、TPEx 擷取、AI 摘要、歷史回補與長期封存尚未實作。
`npm install` 使用免費的 npm 套件；GitHub Actions 依 GitHub 免費額度執行。
GitHub Pages 需有 `config.js`，可公開 anon key；絕對不要把 service_role key 或私人 Token 寫入網站。
新聞內容只保存標題、來源連結與發布時間，不保存全文或圖片。擷取仍須遵守網站條款。
Supabase 免費方案的資料庫容量有限，請定期備份；自動封存尚未完成。
專案結構
`index.html`、`site.js`、`config.example.js`：純前端網站
`sql/schema.sql`：Supabase 資料表與 RLS
`scripts/ingest.mjs`：Node.js 新聞與行情擷取
`.github/workflows/manual-sync.yml`：GitHub Actions 手動更新
`package.json`：Node.js 依賴
下一階段
確認來源與日期格式 → 增加 TPEx/MOPS/鉅亨網 → 歷史行情與事件分析 → 安全按需更新。
V1.8 更新說明
網頁可重新讀取 Supabase，不會觸發 GitHub Actions 擷取。
新聞與行情筆數改用資料庫精確 COUNT。
台股支援依代號搜尋，不再僅在前 100 筆內過濾。
日漲跌幅、5/20 日均量、量比僅由資料庫已有歷史資料計算；不足時顯示「—」。
鉅亨網及 MOPS 擷取尚未接入，不宣稱已有資料。
更新前請保留原本 GitHub 上的 `config.js`；此 ZIP 中的 `config.js` 已刻意清除個人連線設定。切勿把 `sb\_secret\_` 放到公開網站。
請保留 GitHub Repository Secrets 與 Supabase 既有資料表／權限，不需要重新執行 schema.sql。
