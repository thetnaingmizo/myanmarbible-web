import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { getQuestionBySlug, getUserVotes } from "@/lib/questions/queries";
import { getSession } from "@/lib/auth/session";
import { QuestionDetail } from "./question-detail";

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

export default async function QuestionPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const question = await getQuestionBySlug(slug);
  if (!question) notFound();

  const session = await getSession();
  const userId = session?.user?.id ?? null;
  const votedIds = userId
    ? await getUserVotes(userId, [question.id])
    : new Set<string>();

  return (
    <QuestionDetail
      question={question}
      userId={userId}
      hasVoted={votedIds.has(question.id)}
    />
  );
}
