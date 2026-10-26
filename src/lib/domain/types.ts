export type TopicClassification = "not_assessed" | "weak" | "developing" | "strong";

export type QuestionType = "mcq" | "short_answer";
export type Difficulty = "easy" | "medium" | "hard";

export interface EvidenceChunk {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  documentKind: string;
  pageNumber: number | null;
  sectionHeading: string | null;
  text: string;
  semanticScore: number;
  lexicalScore: number;
  score: number;
  rank: number;
}

export interface CitationView {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  pageNumber: number | null;
  sectionHeading: string | null;
  excerpt: string;
}

export interface GeneratedQuestion {
  type: QuestionType;
  difficulty: Difficulty;
  prompt: string;
  options?: string[];
  correctIndex?: number;
  expectedAnswer: string;
  rubric: string[];
  sourceChunkIds: string[];
}

export interface TopicWithMastery {
  topicId: string;
  name: string;
  description: string | null;
  parentId: string | null;
  parentName: string | null;
  importance: number;
  mastery: number | null;
  classification: TopicClassification;
  sufficient: boolean;
  evidenceAnswers: number;
  evidenceMarks: number;
  questionCount: number;
  lastAssessedAt: string | null;
}

export interface AnswerEvidence {
  topicId: string;
  questionId: string;
  attemptId: string;
  score: number;
  maxMarks: number;
  difficulty: Difficulty;
  submittedAt: string;
}
