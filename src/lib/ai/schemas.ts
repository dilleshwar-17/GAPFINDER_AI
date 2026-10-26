import { z } from "zod";

const questionItemSchema = z
  .object({
    type: z.enum(["mcq", "short_answer"]),
    difficulty: z.enum(["easy", "medium", "hard"]),
    prompt: z.string().trim().min(10).max(500),
    options: z.array(z.string().trim().min(1).max(300)).max(6).optional().default([]),
    correctIndex: z.number().int().min(0).max(5).optional().default(0),
    expectedAnswer: z.string().trim().min(3).max(900),
    rubric: z.array(z.string().trim().min(1).max(200)).min(1).max(6),
    sourceLabels: z.array(z.string().trim().min(1).max(16)).min(1).max(4),
  })
  .superRefine((item, context) => {
    if (item.type === "mcq") {
      const unique = new Set(item.options.map((option) => option.toLowerCase().trim()));
      if (item.options.length !== 4 || unique.size !== 4) {
        context.addIssue({
          code: "custom",
          message: "Multiple-choice questions need four distinct options.",
          path: ["options"],
        });
      }
      if (item.correctIndex === undefined || item.correctIndex < 0 || item.correctIndex > 3) {
        context.addIssue({
          code: "custom",
          message: "correctIndex must point at one of the four options.",
          path: ["correctIndex"],
        });
      }
    }
  });

export const llmQuestionPayloadSchema = z.object({
  questions: z.array(questionItemSchema).min(1).max(6),
});

export type LlmQuestionPayload = z.infer<typeof llmQuestionPayloadSchema>;

export const llmEvaluationSchema = z.object({
  scoreFraction: z.number().min(0).max(1),
  matchedConcepts: z.array(z.string().trim().max(160)).max(8).default([]),
  missingConcepts: z.array(z.string().trim().max(160)).max(8).default([]),
  feedback: z.string().trim().min(10).max(1200),
});

export const llmExplanationSchema = z.object({
  explanationMarkdown: z.string().trim().min(40).max(6000),
  citationLabels: z.array(z.string().trim().min(1).max(16)).max(6).default([]),
});

export const attemptSubmissionSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.string().trim().min(1).max(64),
        selectedIndex: z.number().int().min(0).max(3).nullable().optional(),
        answerText: z.string().max(4000).optional(),
      }),
    )
    .min(1)
    .max(30),
});

export type AttemptSubmission = z.infer<typeof attemptSubmissionSchema>;

export const quizRequestSchema = z.object({
  topicIds: z.array(z.string().trim().min(1).max(64)).min(1).max(3),
});

export const planRequestSchema = z.object({
  examDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Use the date format YYYY-MM-DD."),
  minutesPerDay: z.coerce.number().int().min(10, "Choose at least 10 minutes per day.").max(480),
  sessionMinutes: z.coerce.number().int().min(20).max(90).default(45),
});

export const assistantRequestSchema = z.object({
  topicId: z.string().trim().min(1).max(64).optional(),
  question: z.string().trim().min(3, "Ask a short question about the topic.").max(600),
});

export const topicSelectionSchema = z.object({
  topicIds: z.array(z.string().trim().min(1).max(64)).min(1).max(3),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password.").max(200),
  nextPassword: z.string().min(8, "Use at least 8 characters.").max(200),
});

export const GEMINI_QUESTION_SCHEMA: Record<string, unknown> = {
  type: "OBJECT",
  properties: {
    questions: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          type: { type: "STRING", enum: ["mcq", "short_answer"] },
          difficulty: { type: "STRING", enum: ["easy", "medium", "hard"] },
          prompt: { type: "STRING" },
          options: { type: "ARRAY", items: { type: "STRING" } },
          correctIndex: { type: "INTEGER" },
          expectedAnswer: { type: "STRING" },
          rubric: { type: "ARRAY", items: { type: "STRING" } },
          sourceLabels: { type: "ARRAY", items: { type: "STRING" } },
        },
        required: [
          "type",
          "difficulty",
          "prompt",
          "options",
          "correctIndex",
          "expectedAnswer",
          "rubric",
          "sourceLabels",
        ],
      },
    },
  },
  required: ["questions"],
};

export const GEMINI_EVALUATION_SCHEMA: Record<string, unknown> = {
  type: "OBJECT",
  properties: {
    scoreFraction: { type: "NUMBER" },
    matchedConcepts: { type: "ARRAY", items: { type: "STRING" } },
    missingConcepts: { type: "ARRAY", items: { type: "STRING" } },
    feedback: { type: "STRING" },
  },
  required: ["scoreFraction", "matchedConcepts", "missingConcepts", "feedback"],
};

export const GEMINI_EXPLANATION_SCHEMA: Record<string, unknown> = {
  type: "OBJECT",
  properties: {
    explanationMarkdown: { type: "STRING" },
    citationLabels: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["explanationMarkdown", "citationLabels"],
};
