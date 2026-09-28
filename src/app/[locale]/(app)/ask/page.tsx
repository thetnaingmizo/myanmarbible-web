import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { defaultBible, getBooks } from "@/lib/bible/data";
import { AskView, type Conversation } from "@/components/ask/ask-view";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ about?: string; c?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Ask" });
  return { title: t("title") };
}

export default async function AskPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { about, c } = await searchParams;

  const bible = await defaultBible(locale);
  if (!bible) return null;
  const books = await getBooks(bible.id);

  // Signed-in readers: their conversations and today's questions left.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let conversations: Conversation[] = [];
  let remaining: number | null = null;
  if (user) {
    const [{ data }, quota] = await Promise.all([
      supabase.from("chat_conversations").select("id, title, updated_at").order("updated_at", { ascending: false }).limit(50),
      supabase.rpc("ai_quota_left"),
    ]);
    conversations = data ?? [];
    remaining = typeof quota.data === "number" ? quota.data : null;
  }
  const conversationId = c && conversations.some((x) => x.id === c) ? c : undefined;

  return (
    <AskView
      key={conversationId ?? "new"}
      bible={bible}
      books={books}
      signedIn={!!user}
      remaining={remaining}
      conversations={conversations}
      locale={locale}
      about={about?.slice(0, 200)}
      conversationId={conversationId}
    />
  );
}
