"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useChatStore, type Message, type VerseReference, type ResponseLanguage } from "@/lib/chat/store";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageBubble } from "./message-bubble";
import { ConversationList } from "./conversation-list";
import { SuggestedQuestions } from "./suggested-questions";
import { Send, Plus, MessageSquare } from "lucide-react";

type Props = {
  userId: string;
  defaultLanguage: ResponseLanguage;
};

export function ChatWindow({ userId, defaultLanguage }: Props) {
  const t = useTranslations("Chat");
  const [input, setInput] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    conversationId,
    messages,
    isStreaming,
    error,
    responseLanguage,
    conversations,
    setConversationId,
    addMessage,
    appendToLastMessage,
    setVerses,
    setIsStreaming,
    setError,
    setResponseLanguage,
    setConversations,
    addConversation,
    clearMessages,
  } = useChatStore();

  // Initialize response language from profile preference
  useEffect(() => {
    setResponseLanguage(defaultLanguage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load conversation list on mount
  useEffect(() => {
    loadConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function loadConversations() {
    const supabase = createClient();
    const { data } = await supabase
      .from("chat_conversations")
      .select("id, title, updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(50);

    if (data) {
      setConversations(
        data.map((c) => ({
          id: c.id,
          title: c.title || "Untitled",
          updatedAt: new Date(c.updated_at),
        }))
      );
    }
  }

  async function loadConversation(id: string) {
    const supabase = createClient();
    const { data } = await supabase
      .from("chat_messages")
      .select("id, role, content, verse_references, created_at")
      .eq("conversation_id", id)
      .order("created_at");

    if (data) {
      clearMessages();
      setConversationId(id);
      for (const msg of data) {
        addMessage({
          id: msg.id,
          role: msg.role as "user" | "assistant",
          content: msg.content,
          verses: msg.verse_references as unknown as VerseReference[] | undefined,
          createdAt: new Date(msg.created_at),
        });
      }
    }
    setSidebarOpen(false);
  }

  /** Fetch full verse details by IDs from Supabase, then update the store */
  async function fetchVerseDetails(verseIds: string[]) {
    if (verseIds.length === 0) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("verses")
      .select("id, book_id, chapter_number, verse_number, text")
      .in("id", verseIds);

    if (!data || data.length === 0) return;

    // Fetch book names for display
    const bookIds = [...new Set(data.map((v) => v.book_id))];
    const { data: books } = await supabase
      .from("books")
      .select("id, name_en, name_my")
      .in("id", bookIds);

    const bookMap = new Map(books?.map((b) => [b.id, b]) || []);

    const verses: VerseReference[] = data.map((v) => {
      const book = bookMap.get(v.book_id);
      return {
        verseId: v.id,
        book: book?.name_en || "Unknown",
        chapter: v.chapter_number,
        verse: v.verse_number,
        text: v.text.slice(0, 200),
      };
    });

    setVerses(verses);
  }

  async function sendMessage(text?: string) {
    const messageText = (text || input).trim();
    if (!messageText || isStreaming) return;

    setInput("");
    setError(null);

    // Add user message to UI
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: messageText,
      createdAt: new Date(),
    };
    addMessage(userMsg);

    // Add placeholder assistant message
    const assistantMsg: Message = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      createdAt: new Date(),
    };
    addMessage(assistantMsg);
    setIsStreaming(true);

    try {
      // Build history from previous messages (excluding current)
      const history = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const response = await fetch("/api/v1/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: messageText,
          conversationId,
          history,
          responseLanguage,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || "Request failed");
      }

      // Read SSE stream
      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6);

          try {
            const event = JSON.parse(jsonStr);

            if (event.type === "meta") {
              if (!conversationId && event.conversationId) {
                setConversationId(event.conversationId);
                addConversation({
                  id: event.conversationId,
                  title: messageText.slice(0, 100),
                  updatedAt: new Date(),
                });
              }
              if (event.verses && event.verses.length > 0) {
                // SSE sends only verse IDs; fetch full details from Supabase
                const ids = event.verses.map((v: { verseId: string }) => v.verseId);
                fetchVerseDetails(ids);
              }
            } else if (event.type === "text") {
              appendToLastMessage(event.content);
            } else if (event.type === "error") {
              setError(event.message);
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorMessage"));
    } finally {
      setIsStreaming(false);
    }
  }

  function handleNewChat() {
    clearMessages();
    setSidebarOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  const isEmpty = messages.length === 0;

  return (
    <div className="relative flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* Sidebar */}
      <div
        className={`absolute inset-y-0 left-0 z-20 w-72 transform border-r bg-background transition-transform duration-200 md:relative md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b p-3">
            <h2 className="text-sm font-semibold">{t("conversations")}</h2>
            <Button variant="ghost" size="sm" onClick={handleNewChat}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <ConversationList
            conversations={conversations}
            activeId={conversationId}
            onSelect={loadConversation}
          />
        </div>
      </div>

      {/* Sidebar overlay for mobile */}
      {sidebarOpen && (
        <div
          className="absolute inset-0 z-10 bg-black/20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main chat area */}
      <div className="flex flex-1 flex-col">
        {/* Header */}
        <div className="flex items-center gap-2 border-b px-4 py-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="md:hidden"
          >
            <MessageSquare className="h-4 w-4" />
          </Button>
          <h1 className="text-lg font-semibold">{t("title")}</h1>
          <div className="flex-1" />
          {/* Language toggle */}
          <div className="flex items-center rounded-lg border bg-muted/50 p-0.5">
            {(["auto", "en", "my"] as const).map((lang) => (
              <button
                key={lang}
                onClick={() => setResponseLanguage(lang)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  responseLanguage === lang
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t(lang === "auto" ? "languageAuto" : lang === "en" ? "languageEn" : "languageMy")}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={handleNewChat}>
            <Plus className="mr-1 h-3 w-3" />
            {t("newChat")}
          </Button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          {isEmpty ? (
            <div className="mx-auto max-w-2xl">
              <div className="mb-8 text-center">
                <h2 className="mb-2 text-2xl font-bold">{t("title")}</h2>
                <p className="text-muted-foreground">{t("placeholder")}</p>
              </div>
              <SuggestedQuestions onSelect={(q) => sendMessage(q)} />
            </div>
          ) : (
            <div className="mx-auto max-w-3xl space-y-4">
              {messages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  isStreaming={
                    isStreaming &&
                    msg.id === messages[messages.length - 1]?.id &&
                    msg.role === "assistant"
                  }
                />
              ))}
              {error && (
                <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t px-4 py-3">
          <div className="mx-auto flex max-w-3xl gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t("placeholder")}
              disabled={isStreaming}
              className="flex-1"
            />
            <Button
              onClick={() => sendMessage()}
              disabled={!input.trim() || isStreaming}
              size="icon"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
