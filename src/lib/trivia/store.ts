import { create } from "zustand";
import type {
  Difficulty,
  QuizPhase,
  QuizLanguage,
  Category,
  TriviaQuestion,
  QuestionResult,
  LeaderboardEntry,
  RecentScore,
} from "./types";

interface TriviaState {
  // Quiz state machine
  phase: QuizPhase;
  difficulty: Difficulty;
  category: Category;
  language: QuizLanguage;

  // Quiz data
  quizId: string | null;
  questions: TriviaQuestion[];
  currentQuestionIndex: number;
  selectedAnswers: (number | null)[];

  // Results
  score: number | null;
  results: QuestionResult[];

  // Leaderboard / history
  leaderboard: LeaderboardEntry[];
  recentScores: RecentScore[];

  // UI state
  error: string | null;
  isLoading: boolean;

  // Actions
  setDifficulty: (d: Difficulty) => void;
  setCategory: (c: Category) => void;
  setLanguage: (l: QuizLanguage) => void;
  startLoading: () => void;
  setQuiz: (quizId: string, questions: TriviaQuestion[]) => void;
  selectAnswer: (questionIndex: number, answerIndex: number) => void;
  goToQuestion: (index: number) => void;
  nextQuestion: () => void;
  previousQuestion: () => void;
  setResults: (score: number, results: QuestionResult[]) => void;
  setLeaderboard: (entries: LeaderboardEntry[]) => void;
  setRecentScores: (scores: RecentScore[]) => void;
  setError: (error: string | null) => void;
  setIsLoading: (loading: boolean) => void;
  resetQuiz: () => void;
}

export const useTriviaStore = create<TriviaState>((set) => ({
  phase: "setup",
  difficulty: "easy",
  category: "all",
  language: "auto",

  quizId: null,
  questions: [],
  currentQuestionIndex: 0,
  selectedAnswers: [],

  score: null,
  results: [],

  leaderboard: [],
  recentScores: [],

  error: null,
  isLoading: false,

  setDifficulty: (difficulty) => set({ difficulty }),
  setCategory: (category) => set({ category }),
  setLanguage: (language) => set({ language }),

  startLoading: () => set({ phase: "loading", error: null }),

  setQuiz: (quizId, questions) =>
    set({
      phase: "playing",
      quizId,
      questions,
      currentQuestionIndex: 0,
      selectedAnswers: new Array(questions.length).fill(null),
      error: null,
    }),

  selectAnswer: (questionIndex, answerIndex) =>
    set((state) => {
      const selectedAnswers = [...state.selectedAnswers];
      selectedAnswers[questionIndex] = answerIndex;
      return { selectedAnswers };
    }),

  goToQuestion: (index) => set({ currentQuestionIndex: index }),

  nextQuestion: () =>
    set((state) => ({
      currentQuestionIndex: Math.min(
        state.currentQuestionIndex + 1,
        state.questions.length - 1
      ),
    })),

  previousQuestion: () =>
    set((state) => ({
      currentQuestionIndex: Math.max(state.currentQuestionIndex - 1, 0),
    })),

  setResults: (score, results) =>
    set({ phase: "results", score, results, isLoading: false }),

  setLeaderboard: (leaderboard) => set({ leaderboard }),
  setRecentScores: (recentScores) => set({ recentScores }),

  setError: (error) => set({ error, phase: "setup", isLoading: false }),
  setIsLoading: (isLoading) => set({ isLoading }),

  resetQuiz: () =>
    set({
      phase: "setup",
      quizId: null,
      questions: [],
      currentQuestionIndex: 0,
      selectedAnswers: [],
      score: null,
      results: [],
      error: null,
      isLoading: false,
    }),
}));
