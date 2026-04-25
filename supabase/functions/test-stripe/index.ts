import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  // 1. プリフライトリクエストの処理
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  // 2. 本来の処理（まずはStripeを触らずレスポンスだけ返す）
  return new Response(JSON.stringify({ message: "Success" }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
})
