import "server-only"

import { requireApiUser } from "@/lib/api-auth"

/**
 * 開発用のデバッグエンドポイント。
 *
 * `GET /api/fromhere/profile/_debug` で現在の認証ユーザーが
 * `newvibes_profiles` / `profiles` の各テーブルからどう見えているかを返す。
 *
 * - ヘッダー右に「プロフィール未作成」が出る場合の切り分け用。
 * - 個人情報を含むため `index: noindex`、本人のみ参照可能（認証必須）。
 * - 公開はしないが、勝手に閉じる前にユーザーが内容を共有しやすいよう
 *   JSON 整形で返す。
 */
export async function GET(): Promise<Response> {
  const auth = await requireApiUser()
  if (!auth.ok) {
    return auth.response
  }
  const { supabase, user } = auth.context

  /**
   * 1) 必要最小限のカラムでまず `newvibes_profiles` を取りに行く。
   *    スキーマがどう変わっていても確実に成功するパターン。
   */
  const minimal = await supabase
    .from("newvibes_profiles")
    .select("id, handle, display_name")
    .eq("id", user.id)
    .maybeSingle()

  /** 2) 追加カラム（avatar_url, avatar_path, bio）の単独取得を試す */
  const avatarUrlProbe = await supabase
    .from("newvibes_profiles")
    .select("avatar_url")
    .eq("id", user.id)
    .maybeSingle()
  const avatarPathProbe = await supabase
    .from("newvibes_profiles")
    .select("avatar_path")
    .eq("id", user.id)
    .maybeSingle()
  const bioProbe = await supabase
    .from("newvibes_profiles")
    .select("bio")
    .eq("id", user.id)
    .maybeSingle()

  /** 3) 本体 `profiles` 行の有無確認 */
  const mainProfile = await supabase
    .from("profiles")
    .select("id, avatar_url")
    .eq("id", user.id)
    .maybeSingle()

  /**
   * 4) auth.uid() の値（任意）。
   *    `newvibes_debug_auth_uid` という RPC を作っていない環境では失敗するので、
   *    `data: null, error: <message>` で返してデバッグの判断材料にする。
   */
  type RpcResult = { data: unknown; error: string | null }
  const rpcAuthUid: RpcResult = await supabase
    .rpc("newvibes_debug_auth_uid")
    .maybeSingle()
    .then(
      (res: { data: unknown; error: { message: string } | null }) => ({
        data: res.data,
        error: res.error?.message ?? null,
      }),
      (err: unknown) => ({ data: null, error: errorToString(err) }),
    )

  return Response.json(
    {
      authUser: {
        id: user.id,
        email: user.email ?? null,
      },
      /** 一致しているか視覚的に分かるよう、両方を併記 */
      authUid_rpc: rpcAuthUid,
      newvibes_profiles_minimal: {
        data: minimal.data,
        error: minimal.error?.message ?? null,
        rowFound: Boolean(minimal.data),
      },
      newvibes_profiles_avatar_url: {
        data: avatarUrlProbe.data,
        error: avatarUrlProbe.error?.message ?? null,
      },
      newvibes_profiles_avatar_path: {
        data: avatarPathProbe.data,
        error: avatarPathProbe.error?.message ?? null,
      },
      newvibes_profiles_bio: {
        data: bioProbe.data,
        error: bioProbe.error?.message ?? null,
      },
      main_profiles: {
        data: mainProfile.data,
        error: mainProfile.error?.message ?? null,
        rowFound: Boolean(mainProfile.data),
      },
      hints: buildHints({
        minimalFound: Boolean(minimal.data),
        minimalError: minimal.error?.message ?? null,
        avatarUrlError: avatarUrlProbe.error?.message ?? null,
        avatarPathError: avatarPathProbe.error?.message ?? null,
      }),
    },
    {
      status: 200,
      headers: { "cache-control": "no-store" },
    },
  )
}

function errorToString(err: unknown): string {
  if (err instanceof Error) return err.message
  try {
    return JSON.stringify(err)
  } catch {
    return String(err)
  }
}

function buildHints({
  minimalFound,
  minimalError,
  avatarUrlError,
  avatarPathError,
}: {
  minimalFound: boolean
  minimalError: string | null
  avatarUrlError: string | null
  avatarPathError: string | null
}): string[] {
  const hints: string[] = []
  if (!minimalFound && !minimalError) {
    hints.push(
      "newvibes_profiles に自分の行が見つかりません。/fromhere/onboarding でハンドルを登録してください。",
    )
  }
  if (minimalError) {
    hints.push(
      `newvibes_profiles の SELECT がエラーになっています: ${minimalError}（RLS / スキーマ問題の可能性）`,
    )
  }
  if (avatarUrlError && /column .* does not exist|avatar_url/i.test(avatarUrlError)) {
    hints.push(
      "newvibes_profiles に avatar_url カラムがありません。20260528181000_newvibes_init.sql を適用してください。",
    )
  }
  if (avatarPathError && /column .* does not exist|avatar_path/i.test(avatarPathError)) {
    hints.push(
      "newvibes_profiles に avatar_path カラムがありません。20260528181000_newvibes_init.sql を適用してください。",
    )
  }
  if (hints.length === 0) {
    hints.push("DB 側は正常に見えます。ブラウザのハードリロードを試してください。")
  }
  return hints
}
