/** Small presentation helpers shared by server views and AI fallbacks. */

export function complexityLabel(difficulty: string): "easy" | "medium" | "hard" {
  if (difficulty === "easy" || difficulty === "hard") return difficulty;
  return "medium";
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder === 0 ? `${hours} hr` : `${hours} hr ${remainder} min`;
}
