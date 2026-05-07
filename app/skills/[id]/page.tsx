import SkillPage from "@/skills/[id]/page"

type SkillPageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function Page({ params, searchParams }: SkillPageProps) {
  await params
  await searchParams
  return <SkillPage />
}
