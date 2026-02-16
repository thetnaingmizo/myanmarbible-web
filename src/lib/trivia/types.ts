export type Difficulty = "easy" | "medium" | "hard";
export type QuizPhase = "setup" | "loading" | "playing" | "results";

export type QuizLanguage = "auto" | "en" | "my";

export const CATEGORIES = [
  "all",
  "old-testament",
  "new-testament",
  "gospels",
  "genesis",
  "psalms-proverbs",
  "prophets",
  "acts-epistles",
] as const;

export type Category = (typeof CATEGORIES)[number];

export interface TriviaQuestion {
  id: number;
  question: string;
  options: string[];
  verseReference: string;
}

export interface QuestionResult {
  questionIndex: number;
  correct: boolean;
  selectedAnswer: number;
  correctAnswer: number;
  explanation: string;
  verseReference: string;
}

export interface LeaderboardEntry {
  rank: number;
  displayName: string;
  score: number;
  totalQuestions: number;
  difficulty: Difficulty;
  completedAt: string;
}

export interface RecentScore {
  id: string;
  score: number;
  totalQuestions: number;
  difficulty: Difficulty;
  category: string | null;
  completedAt: string;
}

/** Shape returned by the generate API (without answers) */
export interface GenerateResponse {
  quizId: string;
  questions: TriviaQuestion[];
}

/** Shape returned by the submit API */
export interface SubmitResponse {
  score: number;
  totalQuestions: number;
  results: QuestionResult[];
}
