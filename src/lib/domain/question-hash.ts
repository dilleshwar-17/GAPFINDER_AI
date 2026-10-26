import { hashText } from "@/lib/domain/chunking";

export function questionPromptHash(prompt: string): string {
  return hashText(
    prompt
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, "")
      .replace(/\s+/g, " ")
      .trim(),
  );
}
