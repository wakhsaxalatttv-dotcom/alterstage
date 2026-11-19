import { dispatcher } from "../ingestion/http.js";
// This transport sends transactional mail only; no public API exposes its key.
export function candidateMailer(env = process.env) {
  const sender = env.MAIL_FROM_EMAIL || "";
  const ready = Boolean(
    env.BREVO_API_KEY && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sender),
  );
  return {
    ready,
    async send({ to, subject, text }) {
      if (!ready) throw new Error("Mail unavailable");
      const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        dispatcher,
        signal: AbortSignal.timeout(15000),
        headers: {
          "Content-Type": "application/json",
          "api-key": env.BREVO_API_KEY,
        },
        body: JSON.stringify({
          sender: {
            email: sender,
            name: env.MAIL_FROM_NAME || "Offres Fraîches",
          },
          to: [{ email: to }],
          subject,
          textContent: text,
        }),
      });
      // Do not propagate provider error bodies, recipients or authentication headers.
      if (!response.ok) {
        await response.body?.cancel();
        throw new Error("Mail delivery failed");
      }
      await response.body?.cancel();
    },
  };
}
