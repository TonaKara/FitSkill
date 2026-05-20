# i18n（多言語対応）基盤

GritVib のグローバル展開を見据えた軽量 i18n コア。
依存ライブラリは追加せず、後から `next-intl` 等への置換が容易な API を提供する。

---

## 設計概要

- **対応 locale**: `ja`（デフォルト）、`en`
- **URL ロケールプレフィックス無し**（Cookie ベース）
  - `gv_locale` Cookie に保存
  - middleware が初回アクセス時に `Accept-Language` から自動検出
- **DB は常に日本語のまま**
  - 例: `skills.category = "筋トレ"` は変更しない
  - 表示時のみ `labelEn` を引いて出し分け
- **辞書ファイル**: `src/lib/i18n/messages/{ja,en}.json`

---

## 使い方

### Client Component

```tsx
"use client"
import { useTranslations, useLocale, useSetLocale } from "@/lib/i18n/useI18n"

export function Example() {
  const t = useTranslations("header")
  const locale = useLocale()
  const setLocale = useSetLocale()

  return (
    <div>
      <p>{t("teach")}</p>
      <p>locale: {locale}</p>
      <button onClick={() => setLocale("en")}>EN</button>
    </div>
  )
}
```

### Server Component から locale を読む

```ts
import { cookies, headers } from "next/headers"
import { LOCALE_COOKIE_NAME, normalizeLocale } from "@/lib/i18n/locales"
import { pickLocaleFromAcceptLanguage } from "@/lib/i18n/detect-locale"

export async function getServerLocale() {
  const cookieStore = await cookies()
  const fromCookie = cookieStore.get(LOCALE_COOKIE_NAME)?.value
  if (fromCookie) return normalizeLocale(fromCookie)

  const h = await headers()
  return pickLocaleFromAcceptLanguage(h.get("accept-language"))
}
```

### カテゴリなど「日本語ラベル＋英語ラベル」を返すデータ

```ts
import { useLocalizedLabel } from "@/lib/i18n/useI18n"
import { SKILL_CATEGORY_ITEMS } from "@/lib/skill-categories"

function CategoryList() {
  const label = useLocalizedLabel()
  return (
    <ul>
      {SKILL_CATEGORY_ITEMS.map((item) => (
        <li key={item.id}>{label(item)}</li>
      ))}
    </ul>
  )
}
```

---

## 翻訳キーの追加手順（テキスト抽出ガイド）

1. **対象テキストを特定**: 直書きされた日本語（JSX 内、`alert` 文字列、`aria-label`、`placeholder` 等）
2. **`messages/ja.json` にキーを追加**
   - 命名規約: `<namespace>.<feature>.<key>`
   - 例: `chat.composer.placeholder` = `"メッセージを入力..."`
3. **`messages/en.json` に同じキーで英訳を追加**
4. **コード側で置換**

   ```tsx
   const t = useTranslations("chat.composer")
   <textarea placeholder={t("placeholder")} />
   ```

5. **次のフェーズで対象範囲を拡張**
   - フェーズ1（完了）: `header`, `common`, `language`, `nav`, `categories`, `footer`, `errors`, `auth`
   - フェーズ2: `chat`, `transaction`, `mypage`, `discover`, `skill`, `notification`
   - フェーズ3: `admin`, `legal`, `email`

---

## 注意

- **DB に保存されている日本語値を変更しない**（互換性破壊・既存データ移行が必要になる）
- 辞書ファイルは ESM の JSON import で読み込まれるため、ビルド時に静的バンドルされる
- 翻訳が無いキーはキー文字列をそのまま返す（フォールバック）
