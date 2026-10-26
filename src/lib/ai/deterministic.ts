import type { EvidenceChunk, GeneratedQuestion } from "@/lib/domain/types";
import { marksFor } from "@/lib/domain/scoring";
import { hashText } from "@/lib/domain/chunking";
import { questionPromptHash } from "@/lib/domain/question-hash";
import { tokenizeForEmbedding } from "@/lib/ai/embeddings";

interface SourceSentence {
  sentence: string;
  chunk: EvidenceChunk;
}

interface DefinitionFact extends SourceSentence {
  concept: string;
  description: string;
  score: number;
}

const MAX_PROMPT_CHARS = 320;

export function splitSentences(text: string): string[] {
  return (text.match(/[^.!?]+[.!?]+(?=\s|$)|[^.!?]+$/g) ?? [text])
    .map((sentence) => sentence.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function sentencesFromEvidence(evidence: EvidenceChunk[]): SourceSentence[] {
  const result: SourceSentence[] = [];
  for (const chunk of evidence) {
    for (const sentence of splitSentences(chunk.text)) {
      if (sentence.length < 60 || sentence.length > MAX_PROMPT_CHARS) continue;
      if (/^(figure|table|source|note|image)\b/i.test(sentence)) continue;
      if (!/[a-z]/.test(sentence)) continue;
      result.push({ sentence, chunk });
    }
  }
  return result;
}

function cleanConcept(value: string): string {
  return value
    .replace(/^(the|a|an)\s+/i, "")
    .replace(/[,;:]$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

const DEFINITION_PATTERNS = [
  /^(?<concept>[^.]{3,70}?)\s+(?:is|are)\s+(?:defined as|known as|called|the process by which|the)\s+(?<description>.{25,260})$/i,
  /^(?<concept>[^.]{3,70}?)\s+(?:refers to|means|is defined as|can be defined as)\s+(?<description>.{25,260})$/i,
  /^(?<concept>[^.]{3,70}?)\s+(?:is|are)\s+(?<description>(?:a|an|the)\s+.{25,260})$/i,
  /^(?<concept>[^.]{3,70}?)\s+(?:occurs|happens|takes place)\s+(?:when|in|during|at)\s+(?<description>.{25,260})$/i,
];

function extractDefinitions(evidence: EvidenceChunk[]): DefinitionFact[] {
  const sentences = sentencesFromEvidence(evidence);
  const facts: DefinitionFact[] = [];

  for (const item of sentences) {
    const sentence = item.sentence.replace(/[.]$/, "").trim();
    for (const pattern of DEFINITION_PATTERNS) {
      const match = pattern.exec(sentence);
      if (!match?.groups) continue;
      const concept = cleanConcept(match.groups.concept ?? "");
      const description = match.groups.description.trim();
      if (concept.length < 3 || concept.split(/\s+/).length > 8) continue;
      if (/^(it|this|that|there|they|these|those|which|what|when|where|why|how)\b/i.test(concept)) continue;
      if (description.length < 25) continue;
      if (description.toLowerCase().includes(concept.toLowerCase())) continue;
      facts.push({
        concept,
        description,
        sentence: item.sentence,
        chunk: item.chunk,
        score: item.chunk.score,
      });
      break;
    }
  }

  const frequency = new Map<string, number>();
  const normalized = evidence.map((chunk) => chunk.text.toLowerCase());
  for (const fact of facts) {
    const needle = fact.concept.toLowerCase();
    const count = normalized.reduce(
      (sum, text) => sum + (text.split(needle).length - 1),
      0,
    );
    frequency.set(fact.concept.toLowerCase(), count);
  }

  return facts
    .map((fact) => ({
      ...fact,
      score:
        fact.score + Math.min(0.2, (frequency.get(fact.concept.toLowerCase()) ?? 0) * 0.02),
    }))
    .sort((a, b) => b.score - a.score);
}

function fallbackTerms(evidence: EvidenceChunk[]): string[] {
  const counts = new Map<string, number>();
  for (const chunk of evidence) {
    for (const token of tokenizeForEmbedding(chunk.text)) {
      if (token.includes(" ") || token.length < 6) continue;
      counts.set(token, (counts.get(token) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([token]) => token);
}

function shuffleWithSeed<T>(items: T[], seed: string): T[] {
  return [...items].sort((a, b) =>
    hashText(`${seed}:${String(a)}`).localeCompare(hashText(`${seed}:${String(b)}`)),
  );
}

function truncate(text: string, limit: number): string {
  if (text.length <= limit) return text;
  return `${text.slice(0, limit).trim()}...`;
}

function rubricConcepts(concept: string, description: string): string[] {
  const conceptWords = new Set(concept.toLowerCase().split(/\s+/));
  const candidates = tokenizeForEmbedding(description)
    .filter((token) => !token.includes(" ") && token.length >= 5 && !conceptWords.has(token))
    .filter((token, index, list) => list.indexOf(token) === index)
    .slice(0, 3);
  if (candidates.length < 2) return [concept];
  return candidates;
}

/**
 * Deterministic question generation from retrieved passages. Every prompt and
 * answer is derived from a stored source sentence; option terms are drawn from
 * the same retrieved evidence, so no external facts are introduced.
 */
export function generateDeterministicQuestions(
  evidence: EvidenceChunk[],
  options: { maxQuestions: number; existingPromptHashes?: Set<string> },
): GeneratedQuestion[] {
  const facts = extractDefinitions(evidence);
  const uniqueFacts: DefinitionFact[] = [];
  const usedConcepts = new Set<string>();
  for (const fact of facts) {
    const key = fact.concept.toLowerCase();
    if (usedConcepts.has(key)) continue;
    usedConcepts.add(key);
    uniqueFacts.push(fact);
  }

  const terms = [
    ...new Set([...uniqueFacts.map((fact) => fact.concept), ...fallbackTerms(evidence)]),
  ];

  const questions: GeneratedQuestion[] = [];
  const usedPromptHashes = new Set(options.existingPromptHashes ?? []);
  const usedChunks = new Set<string>();

  let mcqCount = 0;
  for (const fact of uniqueFacts) {
    if (questions.length >= options.maxQuestions) break;
    if (mcqCount >= 2) break;
    if (terms.length < 4) break;

    const distractors = terms
      .filter((term) => term.toLowerCase() !== fact.concept.toLowerCase())
      .slice(0, 6);
    if (distractors.length < 3) continue;

    const correctTerm = fact.concept;
    const optionTerms = [correctTerm, ...distractors.slice(0, 3)];
    const prompt = `According to the source passage, which term is described as: "${truncate(
      fact.description,
      190,
    )}"?`;
    const promptHash = questionPromptHash(prompt);
    if (usedPromptHashes.has(promptHash)) continue;

    const shuffled = shuffleWithSeed(optionTerms, prompt);
    const correctIndex = shuffled.findIndex((term) => term === correctTerm);
    if (correctIndex < 0) continue;

    questions.push({
      type: "mcq",
      difficulty: fact.description.length > 150 ? "medium" : "easy",
      prompt,
      options: shuffled,
      correctIndex,
      expectedAnswer: correctTerm,
      rubric: [correctTerm],
      sourceChunkIds: [fact.chunk.chunkId],
    });
    usedPromptHashes.add(promptHash);
    usedChunks.add(fact.chunk.chunkId);
    mcqCount += 1;
  }

  const shortAnswerPool = [
    ...uniqueFacts.filter((fact) => !usedChunks.has(fact.chunk.chunkId)),
    ...uniqueFacts.filter((fact) => usedChunks.has(fact.chunk.chunkId)),
  ];
  for (const fact of shortAnswerPool) {
    if (questions.length >= options.maxQuestions) break;
    const prompt = `Explain ${fact.concept} using evidence from your source material.`;
    const promptHash = questionPromptHash(prompt);
    if (usedPromptHashes.has(promptHash)) continue;

    const rubric = rubricConcepts(fact.concept, fact.description);
    if (rubric.length === 0) continue;

    questions.push({
      type: "short_answer",
      difficulty: "medium",
      prompt,
      expectedAnswer: fact.sentence,
      rubric,
      sourceChunkIds: [fact.chunk.chunkId],
    });
    usedPromptHashes.add(promptHash);
    usedChunks.add(fact.chunk.chunkId);
  }

  // If definitions were scarce, fall back to a source-grounded short answer for
  // the strongest passage rather than inventing unsupported questions.
  if (questions.length === 0 && evidence.length > 0) {
    const chunk = evidence[0];
    const sentences = sentencesFromEvidence([chunk]);
    if (sentences.length > 0) {
      const target = sentences[0];
      questions.push({
        type: "short_answer",
        difficulty: "medium",
        prompt: "Summarise the key idea in the cited passage using your own words.",
        expectedAnswer: target.sentence,
        rubric: tokenizeForEmbedding(target.sentence)
          .filter((token) => !token.includes(" ") && token.length >= 5)
          .slice(0, 3),
        sourceChunkIds: [chunk.chunkId],
      });
    }
  }

  return questions;
}

export function questionMarks(question: GeneratedQuestion): number {
  return marksFor(question.type, question.difficulty);
}
