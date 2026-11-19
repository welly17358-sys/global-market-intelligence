Global Market Intelligence V1.9
以 V1.8 為基礎；GitHub Pages + Supabase + GitHub Actions + Node.js，無 Python。
這版增加
TWSE 最新實際交易日期檢查；API 未提供當日資料時，`sync\_logs` 記錄 `stale`，不把同步完成誤認為當日行情完成。
週一至週五台灣時間 15:00、17:00、19:00 自動嘗試同步；GitHub 排程可能延遲、停用，且台灣休市日仍可能執行。
新增 手動回補十檔觀察股票近兩個月歷史資料的 workflow：`Backfill watchlist history (manual only)`；使用 TWSE `STOCK\_DAY` 每月歷史資料。十檔為 2330、2308、2317、2383、3017、3037、2327、6669、2345、3711。不是全部 1,257 檔的歷史回補。
首頁顯示資料庫最新行情交易日期。重新讀取仍只讀取 Supabase。
更新步驟
解壓縮 ZIP，把所有內容（含 `.github`、`scripts`）覆蓋上傳到原 GitHub Repository。不要刪除原有 `config.js`；ZIP 不包含它。
不需要重新執行 `sql/schema.sql`，也不需要修改 Supabase Secrets 或 RLS。
在 Actions 手動執行 `Market data sync` 一次確認。
需要 5/20 日均量時，再手動執行 `Backfill watchlist history (manual only)`。每檔至多兩個月，若官方 API 拒絕請求會顯示錯誤，不應大量重試。
等 GitHub Pages 發布後強制重新整理。
重要限制
TWSE `STOCK\_DAY\_ALL` 何時更新由官方決定；重試不會使來源提前發布。
`stale` 表示台灣日曆日已晚於官方回傳的最新交易日且為週一至週五；休市日仍可能誤報。網站應以實際 `trade\_date` 為準。
目前只有十檔歷史回補，其他股票的 5/20 日均量需另外取得歷史資料；不能推算不存在的資料。
台股成交量單位為股；回補資料來源欄位為 TWSE 每日成交股數。
歷史回補與一般同步都使用 GitHub Actions Secrets；不可將 `sb\_secret\_` 放在公開網頁。
GitHub Actions 免費額度與排程政策依帳號及 GitHub 當期規則，無法保證永遠零費用。
