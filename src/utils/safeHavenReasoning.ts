// Turns the top-ranked safe haven into a short, human recommendation.
//
// FREE BY DEFAULT: with no key set, it returns a template sentence built from
// the deterministic scoring factors — $0, no network call. This mirrors the
// email.ts pattern (log-only mode when RESEND_API_KEY is unset): the feature
// must never fail because an optional integration isn't configured.
//
// OPTIONAL UPGRADE: set ANTHROPIC_API_KEY and install `@anthropic-ai/sdk` to get
// a richer, context-aware explanation from Claude. Any failure (missing package,
// network error, refusal) silently falls back to the template. Google Gemini
// could be swapped in behind the same explainRecommendation() signature.

import { categoryLabel, type ScoredPlace } from "./safetyScore.js";

const anthropicConfigured = Boolean(process.env.ANTHROPIC_API_KEY);
// Default to the most capable model; overridable via env.
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";

if (!anthropicConfigured) {
  console.warn("[safe-haven] ANTHROPIC_API_KEY not set — using template explanations.");
}

// Deterministic, always-available explanation.
export function templateReason(top: ScoredPlace): string {
  const label = categoryLabel(top.category);
  const dist = Math.round(top.distanceMeters);
  const highlights = top.reasons.filter((r) => !r.endsWith("m away"));
  const tail = highlights.length ? ` — ${highlights.join(", ")}` : "";
  return `Head to ${top.name}, a ${label} about ${dist} m away${tail}.`;
}

/**
 * Explain why `top` is the safest choice. Uses Claude when configured, otherwise
 * the template. Never throws.
 */
export async function explainRecommendation(
  top: ScoredPlace,
  candidates: ScoredPlace[],
): Promise<string> {
  if (!anthropicConfigured) return templateReason(top);

  try {
    // Dynamic import so the SDK is only required when the key is set — the
    // feature stays dependency-free in its default ($0) configuration. The
    // specifier is built at runtime and typed loosely so `tsc` doesn't require
    // the (optional) package to be installed.
    const sdk: any = await import(/* @vite-ignore */ "@anthropic-ai/sdk".toString());
    const Anthropic = sdk.default;
    const client = new Anthropic();

    const list = candidates
      .slice(0, 5)
      .map(
        (p) =>
          `- ${p.name} (${categoryLabel(p.category)}, ${Math.round(
            p.distanceMeters,
          )} m, factors: ${p.reasons.join("; ")})`,
      )
      .join("\n");

    const response = await client.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 300,
      system:
        "You are a women's-safety assistant. In 1-2 short sentences, tell the user which nearby place to head to and why it is the safest choice right now. Be calm, direct, and practical. Do not invent facts beyond the data given.",
      messages: [
        {
          role: "user",
          content: `Recommended destination: ${top.name} (${categoryLabel(
            top.category,
          )}), ${Math.round(top.distanceMeters)} m away.\n\nNearby options considered:\n${list}\n\nWrite the recommendation.`,
        },
      ],
    });

    const text = (response.content as Array<{ type: string; text?: string }>)
      .filter((b) => b.type === "text" && typeof b.text === "string")
      .map((b) => b.text as string)
      .join(" ")
      .trim();

    return text || templateReason(top);
  } catch (err) {
    console.error("[safe-haven] LLM explanation failed, using template:", (err as Error).message);
    return templateReason(top);
  }
}
