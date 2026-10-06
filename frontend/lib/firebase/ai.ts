import { getAI, getGenerativeModel, GoogleAIBackend, type GenerativeModel, type ChatSession } from "firebase/ai";
import { app } from "./config";

let aiModel: GenerativeModel | null = null;

/**
 * Returns the configured Gemini GenerativeModel instance via Firebase AI Logic.
 */
export function getFinancialAIModel(): GenerativeModel {
  if (!aiModel) {
    const ai = getAI(app, { backend: new GoogleAIBackend() });
    aiModel = getGenerativeModel(ai, {
      model: "gemini-2.5-flash",
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048,
      },
      systemInstruction: {
        role: "system",
        parts: [
          {
            text: `You are FinPilot AI, an elite financial intelligence copilot built directly with Firebase AI Logic.
You help users analyze cash flow runways, tax implications, spending anomalies, budgeting, and financial planning.
Always provide concise, actionable, structured insights with concrete numbers or recommendations where possible.`,
          },
        ],
      },
    });
  }
  return aiModel;
}

/**
 * Generate a complete answer from Gemini via Firebase AI Logic.
 */
export async function askFinancialAI(prompt: string, context?: string): Promise<string> {
  const model = getFinancialAIModel();
  const content = context ? `Financial Context:\n${context}\n\nUser Query:\n${prompt}` : prompt;
  const result = await model.generateContent(content);
  return result.response.text();
}

/**
 * Stream an answer chunk-by-chunk from Gemini via Firebase AI Logic.
 */
export async function* streamFinancialAI(prompt: string, context?: string): AsyncGenerator<string> {
  const model = getFinancialAIModel();
  const content = context ? `Financial Context:\n${context}\n\nUser Query:\n${prompt}` : prompt;
  const result = await model.generateContentStream(content);
  for await (const chunk of result.stream) {
    const chunkText = chunk.text();
    if (chunkText) {
      yield chunkText;
    }
  }
}

/**
 * Start a multi-turn chat session with conversational memory.
 */
export function createFinancialAIChat(): ChatSession {
  const model = getFinancialAIModel();
  return model.startChat({
    history: [
      {
        role: "user",
        parts: [{ text: "Hello FinPilot!" }],
      },
      {
        role: "model",
        parts: [
          {
            text: "Hello! I am your FinPilot AI copilot powered by Firebase AI Logic. How can I optimize your financial strategy, analyze cash flows, or inspect transactions today?",
          },
        ],
      },
    ],
  });
}
