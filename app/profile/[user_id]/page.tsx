import ProfilePage from "@/profile/[user_id]/page";

type ProfilePageProps = {
  params: Promise<{ user_id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Page({ params, searchParams }: ProfilePageProps) {
  await params;
  await searchParams;
  return <ProfilePage />;
}
