import { redirect } from "next/navigation";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ about?: string; q?: string }>;
};

// Chat and the verse finder live in Ask now.
export default async function Moved({ params, searchParams }: Props) {
  const { locale } = await params;
  const { about, q } = await searchParams;
  const text = about ?? q;
  redirect(`/${locale}/ask${text ? `?about=${encodeURIComponent(text)}` : ""}`);
}
