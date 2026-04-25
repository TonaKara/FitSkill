Deno.serve(async (req) => {
  // 1. CORS対応
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "*",
      },
    })
  }

  // 2. ここでエラーをすべてキャッチしてレスポンスとして返す
  try {
    const body = await req.json()
    const transactionId = body.transactionId

    // 環境変数の確認
    const url = Deno.env.get("SUPABASE_URL")
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

    if (!url || !key) {
      throw new Error(`環境変数がありません: URL=${!!url}, KEY=${!!key}`)
    }

    return new Response(
      JSON.stringify({
        message: "成功しました",
        transactionId: transactionId,
        debug: "環境変数とJSONパースはOKです",
      }),
      {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      },
    )
  } catch (err) {
    // 【重要】何が起きてもエラーの詳細を必ず返す
    const e = err instanceof Error ? err : new Error(String(err))
    return new Response(
      JSON.stringify({
        error: e.message,
        stack: e.stack,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      },
    )
  }
})
