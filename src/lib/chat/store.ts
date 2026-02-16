import { create } from "zustand";

export type ResponseLanguage = "auto" | "en" | "my";

export interface VerseReference {
  verseId?: string;
  book: string;
  chapter: number;
  verse: number;
  text: string;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  verses?: VerseReference[];
  createdAt: Date;
}

export interface Conversation {
  id: string;
  title: string;
  updatedAt: Date;
}

interface ChatState {
  // Current conversation
  conversationId: string | null;
  messages: Message[];
  isStreaming: boolean;
  error: string | null;

  // Language preference
  responseLanguage: ResponseLanguage;

  // Conversation list
  conversations: Conversation[];

  // Actions
  setConversationId: (id: string | null) => void;
  addMessage: (message: Message) => void;
  appendToLastMessage: (chunk: string) => void;
  setVerses: (verses: VerseReference[]) => void;
  setIsStreaming: (streaming: boolean) => void;
  setError: (error: string | null) => void;
  setResponseLanguage: (lang: ResponseLanguage) => void;
  setConversations: (conversations: Conversation[]) => void;
  addConversation: (conversation: Conversation) => void;
  removeConversation: (id: string) => void;
  clearMessages: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  conversationId: null,
  messages: [],
  isStreaming: false,
  error: null,
  responseLanguage: "auto",
  conversations: [],

  setConversationId: (id) => set({ conversationId: id }),
  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),
  appendToLastMessage: (chunk) =>
    set((state) => {
      const messages = [...state.messages];
      const last = messages[messages.length - 1];
      if (last && last.role === "assistant") {
        messages[messages.length - 1] = {
          ...last,
          content: last.content + chunk,
        };
      }
      return { messages };
    }),
  setVerses: (verses) =>
    set((state) => {
      const messages = [...state.messages];
      const last = messages[messages.length - 1];
      if (last && last.role === "assistant") {
        messages[messages.length - 1] = { ...last, verses };
      }
      return { messages };
    }),
  setIsStreaming: (streaming) => set({ isStreaming: streaming }),
  setError: (error) => set({ error }),
  setResponseLanguage: (lang) => set({ responseLanguage: lang }),
  setConversations: (conversations) => set({ conversations }),
  addConversation: (conversation) =>
    set((state) => ({
      conversations: [conversation, ...state.conversations],
    })),
  removeConversation: (id) =>
    set((state) => ({
      conversations: state.conversations.filter((c) => c.id !== id),
      ...(state.conversationId === id
        ? { conversationId: null, messages: [] }
        : {}),
    })),
  clearMessages: () => set({ messages: [], conversationId: null, error: null }),
}));
