import { getSkillOgImageResponse } from "@/lib/skill-og-image-response"

export const runtime = "nodejs"

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params
  return getSkillOgImageResponse(id ?? "")
}
