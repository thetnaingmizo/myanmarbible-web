"use client";

import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { useChatStore, type Conversation } from "@/lib/chat/store";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

type Props = {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
};

export function ConversationList({ conversations, activeId, onSelect }: Props) {
  const t = useTranslations("Chat");
  const { removeConversation } = useChatStore();

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    if (!confirm(t("confirmDelete"))) return;

    const supabase = createClient();
    await supabase.from("chat_conversations").delete().eq("id", id);
    removeConversation(id);
  }

  if (conversations.length === 0) {
    return (
      <div className="flex-1 p-4 text-center text-sm text-muted-foreground">
        {t("noConversations")}
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {conversations.map((conv) => (
        <div
          key={conv.id}
          role="button"
          tabIndex={0}
          onClick={() => onSelect(conv.id)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onSelect(conv.id); }}
          className={`group flex w-full cursor-pointer items-center gap-2 border-b px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent ${
            activeId === conv.id ? "bg-accent" : ""
          }`}
        >
          <span className="flex-1 truncate">{conv.title}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100"
            onClick={(e) => handleDelete(e, conv.id)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      ))}
    </div>
  );
}
