import Groq from "groq-sdk";

type GroqVerdict = {
  legitimate: boolean;
  reasoning: string;
  confidenceScore: number;
};

let client: Groq | null = null;

function getGroq() {
  if (client) return client;
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is required");
  client = new Groq({ apiKey });
  return client;
}

function parseJson(content: string) {
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Groq response did not contain JSON");
  return JSON.parse(match[0]) as GroqVerdict;
}

export async function validateRugSignal(input: { symbol: string; message: string; diff: string }) {
  const request = getGroq().chat.completions.create({
    model: "llama-3.3-70b-versatile",
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You are a crypto rugpull detection AI. Given a token symbol and commit diff, determine if this is likely a genuine blacklist addition indicating rugpull risk. Reply with JSON: { legitimate: boolean, reasoning: string, confidenceScore: number 0-100 }"
      },
      {
        role: "user",
        content: `Token: ${input.symbol}. Commit message: ${input.message}. Diff excerpt: ${input.diff.slice(0, 8000)}`
      }
    ]
  });

  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error("Groq validation timed out after 10 seconds")), 10_000);
  });

  const result = await Promise.race([request, timeout]);
  const content = result.choices[0]?.message?.content || "{}";
  const parsed = parseJson(content);

  return {
    legitimate: Boolean(parsed.legitimate),
    reasoning: String(parsed.reasoning || "No reasoning returned"),
    confidenceScore: Math.max(0, Math.min(100, Number(parsed.confidenceScore || 0)))
  };
}

/**
 * Validates a token flagged by one or more external signal sources
 * (RugCheck, DexScreener, GoPlusSecurity, etc.)
 * Multi-source confirmation lowers the required threshold in the caller.
 */
export async function validateMultiSourceSignal(input: {
  symbol: string;
  sources: string[];
  reasons: string[];
}) {
  const sourceList = input.sources.join(", ");
  const signalLines = input.reasons.map((r, i) => `${i + 1}. ${r}`).join("\n");
  const multiConfirm =
    input.sources.length >= 2
      ? `\n\nNOTE: ${input.sources.length} independent sources flagged this token, which is strong corroborating evidence.`
      : "";

  const request = getGroq().chat.completions.create({
    model: "llama-3.3-70b-versatile",
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You are a crypto rugpull detection AI. Given a token and signals from external detection sources, decide whether to open a prediction market for it. Reply with JSON: { legitimate: boolean (SET TRUE if the signals indicate real rugpull risk and a market should be opened; SET FALSE only if the signals are clearly noise or a false positive), reasoning: string, confidenceScore: number 0-100 (confidence that this token will lose 80%+ of value within 7 days) }"
      },
      {
        role: "user",
        content: `Token: ${input.symbol}\nDetected by: ${sourceList}\n\nSignals:\n${signalLines}${multiConfirm}`
      }
    ]
  });

  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error("Groq validation timed out")), 10_000);
  });

  const result = await Promise.race([request, timeout]);
  const content = result.choices[0]?.message?.content || "{}";
  const parsed = parseJson(content);

  return {
    legitimate: Boolean(parsed.legitimate),
    reasoning: String(parsed.reasoning || "No reasoning returned"),
    confidenceScore: Math.max(0, Math.min(100, Number(parsed.confidenceScore || 0)))
  };
}
