"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { CharacterCard } from "./character-card";

type Character = {
  id: string;
  name_en: string;
  name_my: string | null;
  slug: string;
  description_en: string | null;
  description_my: string | null;
  testament: string | null;
  image_url: string | null;
};

type Props = {
  characters: Character[];
};

export function CharactersList({ characters }: Props) {
  const t = useTranslations("Characters");
  const [filter, setFilter] = useState<"all" | "OT" | "NT">("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    let result = characters;
    if (filter !== "all") {
      result = result.filter((c) => c.testament === filter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.name_en.toLowerCase().includes(q) ||
          (c.name_my && c.name_my.includes(search.trim()))
      );
    }
    return result;
  }, [characters, filter, search]);

  const tabs = [
    { key: "all" as const, label: t("allCharacters") },
    { key: "OT" as const, label: t("oldTestament") },
    { key: "NT" as const, label: t("newTestament") },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="mt-1 text-muted-foreground">{t("description")}</p>
      </div>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Testament filter tabs */}
        <div className="flex gap-1 rounded-lg border p-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                filter === tab.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <Input
          placeholder={t("searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-64"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">
          {t("noCharacters")}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((character) => (
            <CharacterCard key={character.id} character={character} />
          ))}
        </div>
      )}
    </div>
  );
}
