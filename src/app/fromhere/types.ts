/**
 * FromHere クライアント側で使う列挙型。
 * - カテゴリーは `_product-validation.ts` を一次定義とし、ここからは re-export する。
 *
 * 以前は `FromHereSortKey` / `FromHereRangeKey` も export していたが、
 * ホームのフィルター UI が「期間 / 並べ替え」をやめて 4 セクション固定構成になったため
 * 不要になり削除済み。
 */

export type { FromHereCategory } from "./_product-validation"
