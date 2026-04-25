export const CMS_SETTINGS_SINGLETON_ID = 1

export type CmsSettingsValues = {
  site_name: string
  address: string
  email: string
  phone: string
  price_info: string
  payment_method: string
  delivery_info: string
  return_policy: string
  refund_policy: string
  service_terms: string
}

export type CmsSettingsRow = CmsSettingsValues & {
  id: number
  created_at?: string
  updated_at?: string
}

export const EMPTY_CMS_SETTINGS: CmsSettingsValues = {
  site_name: "",
  address: "",
  email: "",
  phone: "",
  price_info: "",
  payment_method: "",
  delivery_info: "",
  return_policy: "",
  refund_policy: "",
  service_terms: "",
}

export function normalizeCmsSettings(row: Partial<CmsSettingsRow> | null | undefined): CmsSettingsValues {
  return {
    site_name: typeof row?.site_name === "string" ? row.site_name : "",
    address: typeof row?.address === "string" ? row.address : "",
    email: typeof row?.email === "string" ? row.email : "",
    phone: typeof row?.phone === "string" ? row.phone : "",
    price_info: typeof row?.price_info === "string" ? row.price_info : "",
    payment_method: typeof row?.payment_method === "string" ? row.payment_method : "",
    delivery_info: typeof row?.delivery_info === "string" ? row.delivery_info : "",
    return_policy: typeof row?.return_policy === "string" ? row.return_policy : "",
    refund_policy: typeof row?.refund_policy === "string" ? row.refund_policy : "",
    service_terms: typeof row?.service_terms === "string" ? row.service_terms : "",
  }
}

export const CMS_SETTINGS_FIELDS: Array<{ key: keyof CmsSettingsValues; label: string; multiline?: boolean }> = [
  { key: "site_name", label: "販売事業者名" },
  { key: "address", label: "所在地", multiline: true },
  { key: "email", label: "メールアドレス" },
  { key: "phone", label: "電話番号" },
  { key: "price_info", label: "販売価格" },
  { key: "payment_method", label: "支払方法・支払時期", multiline: true },
  { key: "delivery_info", label: "提供役務の提供時期・引き渡し時期", multiline: true },
  { key: "return_policy", label: "返品について", multiline: true },
  { key: "refund_policy", label: "返金・キャンセルについて", multiline: true },
  { key: "service_terms", label: "その他の販売条件", multiline: true },
]
