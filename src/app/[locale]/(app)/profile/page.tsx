import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { ProfileForm } from "./profile-form";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function ProfilePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <ProfileForm
      profile={{
        displayName: session.profile?.display_name ?? "",
        email: session.user.email ?? "",
        denomination: session.profile?.denomination ?? "",
      }}
    />
  );
}
