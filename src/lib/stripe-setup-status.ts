export type StripeSetupProfileFields = {
  stripe_connect_account_id?: string | null
  is_stripe_registered?: boolean | null
  stripe_connect_charges_enabled?: boolean | null
}

/** 出品・売上ページと同じ基準（account/sales と揃える） */
export function isStripeInstructorSetupComplete(
  profile: StripeSetupProfileFields | null | undefined,
): boolean {
  const accountId = profile?.stripe_connect_account_id?.trim() ?? ""
  if (!accountId) {
    return false
  }
  return Boolean(profile?.is_stripe_registered || profile?.stripe_connect_charges_enabled)
}
