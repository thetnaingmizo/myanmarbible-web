import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getUserBookmarks } from "@/lib/bookmarks/queries";
import { BookmarksList } from "./bookmarks-list";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function BookmarksPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getSession();
  if (!session) {
    redirect(`/${locale}/login?next=/${locale}/bookmarks`);
  }

  const bookmarks = await getUserBookmarks(session.user.id);

  return <BookmarksList bookmarks={bookmarks} userId={session.user.id} />;
}
