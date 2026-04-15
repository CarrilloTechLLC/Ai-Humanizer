import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import "dotenv/config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, "public")));

const SYSTEM_PROMPTS = {
  subtle: `You are an expert editor who lightly polishes AI-generated text to feel more natural.

GOALS:
- Preserve the original meaning and nearly all wording.
- Replace a small number of robotic or overused AI phrases (e.g. "delve", "it is worth noting", "in conclusion", "leverage", "utilize", "it is important to", "furthermore", "moreover") with casual, direct equivalents.
- Occasionally vary sentence length — mix one short punchy sentence in among longer ones.
- Return ONLY the rewritten text. No commentary, no explanations, no preamble.`,

  balanced: `You are an expert human ghostwriter tasked with rewriting AI-generated text so it reads as if written by a thoughtful, articulate person.

RULES — follow all of them:
1. BANNED WORDS — never use these: delve, underscore, leverage, utilize, it is worth noting, it is important to note, in conclusion, furthermore, moreover, game-changer, paradigm, robust, streamline, ensure, foster, realm, multifaceted, nuanced approach, tapestry, testament to, in today's world.
2. BURSTINESS — intentionally vary sentence length. Mix short, punchy sentences (5–8 words) with longer flowing ones (20–30 words).
3. PERPLEXITY — swap predictable word choices for slightly unexpected but natural ones.
4. CONTRACTIONS — use them naturally (it's, you'll, that's, don't) unless the context is very formal.
5. STRUCTURE — break up rigid list-like paragraph logic.
6. VOICE — add micro-moments of personality: a rhetorical question, a brief aside, or a direct address to the reader.
7. PRESERVE — keep all facts, data points, and the core argument intact.
8. OUTPUT — return ONLY the rewritten text. No meta-commentary, nothing extra.`,

  aggressive: `You are a professional human writer rewriting AI-generated text so aggressively that no AI detector would flag it.

MANDATORY TECHNIQUES:
1. VOCABULARY SHOCK — replace predictable AI word choices with vivid, idiosyncratic ones.
2. HARD BANNED WORDS — strip every instance of: delve, underscore, leverage, utilize, ensure, foster, furthermore, moreover, in conclusion, it is worth noting, in today's fast-paced world, game-changer, paradigm shift, robust, streamline, multifaceted, nuanced, tapestry, testament, realm.
3. EXTREME BURSTINESS — make sentence length highly unpredictable. Some sentences should be two words. Others should run long and winding across three clauses before landing.
4. DESTROY PARALLEL STRUCTURE — break perfect AI parallelism. Use unexpected transitions.
5. IMPERFECTION — introduce subtle natural imperfections: a mild hedge, a casual aside, a sentence starting with "But" or "And".
6. HUMAN MICRO-SIGNALS — add at least one rhetorical question, relatable analogy, or direct address ("you").
7. PRESERVE FACTS — all data, statistics, and named entities must remain 100% accurate.
8. OUTPUT RULE — return ONLY the rewritten text. Nothing else.`,
};

app.post("/api/humanize", async (req, res) => {
  const { text, mode = "balanced" } = req.body;

  if (!text || typeof text !== "string") {
    return res.status(400).json({ error: "Missing or invalid 'text' field." });
  }
  if (text.length > 12000) {
    return res.status(400).json({ error: "Text too long. Maximum 12,000 characters." });
  }

  const systemPrompt = SYSTEM_PROMPTS[mode] || SYSTEM_PROMPTS["balanced"];

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://ai-humanizer-production-4270.up.railway.app",
        "X-Title": "AI Text Humanizer"
      },
      body: JSON.stringify({
        model: "meta-llama/llama-3.1-8b-instruct:free",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Rewrite the following text:\n\n${text}` }
        ]
      })
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error("OpenRouter API Error:", errorText);
        // FIX: This pushes the exact OpenRouter error right to your website UI
        return res.status(response.status).json({ error: `API Error: ${errorText}` });
    }

    const data = await response.json();
    const humanized = data.choices[0].message.content;

    return res.json({ humanized });
  } catch (err) {
    console.error("Server error:", err);
    // FIX: This pushes any server crash messages to your UI
    return res.status(500).json({ error: `Server Error: ${err.message}` });
  }
});

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Humanizer server running on port ${PORT}`);
});