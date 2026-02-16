import { setRequestLocale } from "next-intl/server";
import { getQuestions, getUserVotes } from "@/lib/questions/queries";
import { getSession } from "@/lib/auth/session";
import { QuestionsList } from "./questions-list";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function QuestionsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [questions, session] = await Promise.all([
    getQuestions(),
    getSession(),
  ]);

  const userId = session?.user?.id ?? null;
  const questionIds = questions.map((q) => q.id);
  const votedIds = userId ? await getUserVotes(userId, questionIds) : new Set<string>();

  return (
    <QuestionsList
      questions={questions}
      userId={userId}
      votedQuestionIds={Array.from(votedIds)}
    />
  );
}
