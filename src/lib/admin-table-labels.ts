/** 管理画面テーブル共通の列見出し（ダッシュボード・各一覧で共有） */
export const ADMIN_TABLE_HEADER_LABELS: Partial<Record<string, string>> = {
  name: "氏名",
  email: "メールアドレス",
  category: "分類",
  subject: "件名",
  transaction_id: "取引ID",
  submitter_profile_id: "送信者ID",
  status: "処理状況",
  created_at: "送信日時",
  reporter_id: "通報者ID",
  reported_user_id: "被通報者ID",
  product_id: "商品ID",
  reason: "通報理由",
  action: "アクション",
}
