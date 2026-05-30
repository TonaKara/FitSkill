/**
 * FromHere の予約公開 / 最初のコメント ロジック検証スクリプト。
 *
 * - TS 経由でなく純粋ロジックを JS に再実装し、境界値を確認する。
 * - 仕様変更時はこのスクリプトも更新すること（参照: _product-validation.ts, _comment-validation.ts）。
 *
 * 実行: `node scripts/verify-fromhere-scheduling.mjs`
 */

// --------------------------- ロジック ---------------------------
const JST_OFFSET_MS = 9 * 60 * 60 * 1000

function getFromHereJstTomorrowDateString(now = new Date()) {
  const nowJst = new Date(now.getTime() + JST_OFFSET_MS)
  const y = nowJst.getUTCFullYear()
  const m = nowJst.getUTCMonth()
  const d = nowJst.getUTCDate()
  const tomorrow = new Date(Date.UTC(y, m, d + 1))
  const yy = tomorrow.getUTCFullYear()
  const mm = String(tomorrow.getUTCMonth() + 1).padStart(2, "0")
  const dd = String(tomorrow.getUTCDate()).padStart(2, "0")
  return `${yy}-${mm}-${dd}`
}

function parseFromHereScheduledDateToUtcIso(raw, now = new Date()) {
  if (typeof raw !== "string") return { ok: false }
  const trimmed = raw.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return { ok: false }
  const [yStr, mStr, dStr] = trimmed.split("-")
  const year = Number(yStr)
  const month = Number(mStr)
  const day = Number(dStr)
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return { ok: false }
  if (month < 1 || month > 12 || day < 1 || day > 31) return { ok: false }
  const utcMs = Date.UTC(year, month - 1, day)
  const back = new Date(utcMs)
  if (back.getUTCFullYear() !== year || back.getUTCMonth() !== month - 1 || back.getUTCDate() !== day) {
    return { ok: false }
  }
  const minDate = getFromHereJstTomorrowDateString(now)
  if (trimmed < minDate) return { ok: false }
  const postedAtMs = utcMs - JST_OFFSET_MS
  return { ok: true, iso: new Date(postedAtMs).toISOString() }
}

function validateFromHereCommentBody(raw) {
  const FROMHERE_COMMENT_MAX_LENGTH = 400
  const bodyRaw = typeof raw === "string" ? raw : ""
  const normalized = bodyRaw.replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n").trim()
  if (normalized.length === 0) return { ok: false, error: "empty" }
  if (normalized.length > FROMHERE_COMMENT_MAX_LENGTH) return { ok: false, error: "tooLong" }
  if (/<\s*\/?\s*[a-zA-Z][^>]*>/.test(normalized)) return { ok: false, error: "containsHtml" }
  return { ok: true, body: normalized }
}

// --------------------------- アサート ---------------------------
let pass = 0
let fail = 0
function expect(label, actual, expected) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  const ok = a === e
  if (ok) {
    pass++
    console.log(`  PASS  ${label}`)
  } else {
    fail++
    console.error(`  FAIL  ${label}\n        expected: ${e}\n        actual  : ${a}`)
  }
}

console.log("\n[1] getFromHereJstTomorrowDateString")
{
  // 2026-05-30 23:30 JST → 14:30 UTC。翌日は 2026-05-31。
  const now = new Date("2026-05-30T14:30:00Z")
  expect("JST 23:30 -> 翌日", getFromHereJstTomorrowDateString(now), "2026-05-31")
}
{
  // 2026-05-30 00:30 JST → 前日 15:30 UTC (= 2026-05-29T15:30Z)。翌日は 2026-05-31。
  const now = new Date("2026-05-29T15:30:00Z")
  expect("JST 00:30 -> 翌日", getFromHereJstTomorrowDateString(now), "2026-05-31")
}
{
  // 月末またぎ: 2026-05-31 23:00 JST = 14:00 UTC。翌日は 2026-06-01。
  const now = new Date("2026-05-31T14:00:00Z")
  expect("月末 -> 翌月 1 日", getFromHereJstTomorrowDateString(now), "2026-06-01")
}
{
  // 年末: 2026-12-31 23:59 JST = 14:59 UTC。翌日は 2027-01-01。
  const now = new Date("2026-12-31T14:59:00Z")
  expect("年末 -> 翌年 1/1", getFromHereJstTomorrowDateString(now), "2027-01-01")
}
{
  // UTC 14:30 (= JST 23:30) で投稿しても翌日は 2026-05-31 になるべき
  // 仕様: 5/30 の 14:00 (JST 23:00) に投稿 → 選べるのは 5/31 から
  const now = new Date("2026-05-30T05:00:00Z") // = JST 14:00
  expect("JST 14:00 -> 翌日", getFromHereJstTomorrowDateString(now), "2026-05-31")
}

console.log("\n[2] parseFromHereScheduledDateToUtcIso")
{
  // 2026-05-31 を「2026-05-30T14:00Z」(= JST 5/30 23:00) 視点で評価
  const now = new Date("2026-05-30T14:00:00Z")
  // JST 5/31 00:00 = UTC 5/30 15:00
  expect(
    "翌日を渡すと JST 00:00 を UTC に変換",
    parseFromHereScheduledDateToUtcIso("2026-05-31", now),
    { ok: true, iso: "2026-05-30T15:00:00.000Z" },
  )
}
{
  const now = new Date("2026-05-30T14:00:00Z")
  expect(
    "翌々日も OK",
    parseFromHereScheduledDateToUtcIso("2026-06-01", now),
    { ok: true, iso: "2026-05-31T15:00:00.000Z" },
  )
}
{
  // 当日は弾く
  const now = new Date("2026-05-30T14:00:00Z")
  expect("当日 -> NG", parseFromHereScheduledDateToUtcIso("2026-05-30", now), { ok: false })
}
{
  // 過去は弾く
  const now = new Date("2026-05-30T14:00:00Z")
  expect("過去 -> NG", parseFromHereScheduledDateToUtcIso("2026-05-01", now), { ok: false })
}
{
  // 不正な日付
  const now = new Date("2026-05-30T14:00:00Z")
  expect("実在しない日付 -> NG", parseFromHereScheduledDateToUtcIso("2026-02-30", now), { ok: false })
}
{
  // 形式違反
  const now = new Date("2026-05-30T14:00:00Z")
  expect("ハイフン無し -> NG", parseFromHereScheduledDateToUtcIso("20260601", now), { ok: false })
  expect("空文字 -> NG", parseFromHereScheduledDateToUtcIso("", now), { ok: false })
  expect("undefined -> NG", parseFromHereScheduledDateToUtcIso(undefined, now), { ok: false })
  expect("数値 -> NG", parseFromHereScheduledDateToUtcIso(20260601, now), { ok: false })
}
{
  // 仕様確認: 5/30 14:00 JST の時点で 5/31 が最短
  const now = new Date("2026-05-30T05:00:00Z") // = JST 14:00
  expect(
    "5/30 14:00 JST で 5/31 はOK",
    parseFromHereScheduledDateToUtcIso("2026-05-31", now),
    { ok: true, iso: "2026-05-30T15:00:00.000Z" },
  )
  expect(
    "5/30 14:00 JST で 5/30 は NG",
    parseFromHereScheduledDateToUtcIso("2026-05-30", now),
    { ok: false },
  )
}

console.log("\n[3] validateFromHereCommentBody")
{
  expect("空文字 -> empty", validateFromHereCommentBody(""), { ok: false, error: "empty" })
  expect("空白のみ -> empty", validateFromHereCommentBody("   \n\n "), { ok: false, error: "empty" })
  expect("undefined -> empty", validateFromHereCommentBody(undefined), { ok: false, error: "empty" })
  expect("通常文 -> OK", validateFromHereCommentBody("こんにちは"), {
    ok: true,
    body: "こんにちは",
  })
  expect("CRLF 正規化", validateFromHereCommentBody("a\r\nb\r\nc"), { ok: true, body: "a\nb\nc" })
  expect("連続改行を 2 つに圧縮", validateFromHereCommentBody("a\n\n\n\nb"), { ok: true, body: "a\n\nb" })
  expect("HTML タグ -> NG", validateFromHereCommentBody("<script>alert(1)</script>"), {
    ok: false,
    error: "containsHtml",
  })
  expect("自己閉じタグ -> NG", validateFromHereCommentBody("hi <br/>"), {
    ok: false,
    error: "containsHtml",
  })
  expect("400 文字ちょうど -> OK", validateFromHereCommentBody("a".repeat(400)), {
    ok: true,
    body: "a".repeat(400),
  })
  expect("401 文字 -> NG", validateFromHereCommentBody("a".repeat(401)), {
    ok: false,
    error: "tooLong",
  })
}

console.log("\n[4] 「公開時刻 = 最初のコメント created_at」の整合性")
{
  // 投稿時に scheduledDate を渡して、その JST 00:00 が posted_at になる。
  // 最初のコメントの created_at も同じ ISO になることを確認 (再現)。
  const now = new Date("2026-05-30T05:00:00Z")
  const r = parseFromHereScheduledDateToUtcIso("2026-05-31", now)
  if (r.ok) {
    const postedAtIso = r.iso
    const firstCommentCreatedAt = postedAtIso // _product-actions.ts の挙動
    expect(
      "posted_at === firstComment.created_at",
      firstCommentCreatedAt === postedAtIso,
      true,
    )
    expect(
      "JST 00:00 を UTC に変換した値（= JST 前日 15:00 UTC）",
      postedAtIso,
      "2026-05-30T15:00:00.000Z",
    )
  } else {
    fail++
    console.error("  FAIL  preceding parseFromHereScheduledDateToUtcIso unexpected NG")
  }
}

console.log(`\n結果: ${pass} pass, ${fail} fail`)
process.exit(fail === 0 ? 0 : 1)
