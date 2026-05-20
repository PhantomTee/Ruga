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
