import { Inngest } from "inngest";

export const inngest = new Inngest({ id: "finpilot" });

const BACKEND = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";

/** Calls the FastAPI backend from a durable, retried step. Send "finpilot/backend.ping" to try it. */
export const backendPing = inngest.createFunction(
  { id: "backend-ping", triggers: [{ event: "finpilot/backend.ping" }] },
  async ({ step }) => {
    return step.run("GET /api/health", async () => {
      const res = await fetch(`${BACKEND}/api/health`);
      if (!res.ok) throw new Error(`backend health ${res.status}`);
      return res.json();
    });
  },
);
