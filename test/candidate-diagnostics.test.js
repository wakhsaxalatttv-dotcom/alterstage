import test from "node:test";
import assert from "node:assert/strict";
import { candidateClient } from "../server/candidates/supabase.js";
import {
  failureJournal,
  providerFailure,
} from "../server/candidates/diagnostics.js";
const privateValue = "private-recipient@example.org private-key do-not-log";
test("SMTP failure classification keeps only fixed labels, without retaining messages, queries or credentials", async () => {
  const logged = [];
  const client = candidateClient({
    onFailure: (e) => logged.push(e),
    fetcher: async () =>
      new Response(
        JSON.stringify({
          code: "unexpected_failure",
          msg: "Error sending confirmation email: " + privateValue,
        }),
        { status: 500 },
      ),
  });
  await assert.rejects(
    client.call("/auth/v1/signup?redirect_to=https://example.org/secret", {
      method: "POST",
      body: {
        email: "private-recipient@example.org",
        password: "private-password",
      },
    }),
    (e) =>
      e.status === 503 &&
      e.message.includes("n’a pas pu être envoyé") &&
      !e.message.includes(privateValue),
  );
  assert.equal(logged.length, 1);
  assert.equal(logged[0].category, "email_delivery");
  assert.equal(logged[0].operation, "signup");
  assert.equal(logged[0].code, "unexpected_failure");
  assert.doesNotMatch(
    JSON.stringify({ logged, diagnostics: client.diagnostics() }),
    /private-recipient|private-key|private-password|redirect_to|secret/,
  );
});
test("network, migration, SMTP rejection, rate limits and unrelated provider failures stay distinct", async () => {
  assert.equal(
    providerFailure("/auth/v1/recover", 500, {
      message: "Error sending recovery email",
    }).category,
    "email_delivery",
  );
  assert.equal(
    providerFailure("/auth/v1/resend", 403, {
      code: "email_address_not_authorized",
    }).category,
    "email_delivery",
  );
  assert.equal(
    providerFailure("/auth/v1/signup", 500, {
      msg: "Database error saving new user",
    }).category,
    "service",
  );
  assert.equal(
    providerFailure("/auth/v1/signup", 500, {
      msg: '535 "5.7.8 Authentication failed"',
    }).category,
    "email_delivery",
  );
  assert.equal(
    providerFailure("/auth/v1/settings", 403, {}).category,
    "credentials",
  );
  assert.equal(
    providerFailure("/rest/v1/rpc/of_setup_status", 404, { code: "PGRST202" })
      .category,
    "schema",
  );
  assert.equal(
    providerFailure("/auth/v1/signup", 429, {}).category,
    "rate_limit",
  );
  const events = [],
    client = candidateClient({
      onFailure: (e) => events.push(e),
      fetcher: async () => {
        throw new Error(privateValue);
      },
    });
  await assert.rejects(
    client.call("/auth/v1/signup", { method: "POST" }),
    (e) => e.status === 503,
  );
  assert.equal(events[0].category, "network");
  assert.doesNotMatch(JSON.stringify(events), /private/);
});
test("diagnostic journal is bounded and does not retain arbitrary provider strings", () => {
  const journal = failureJournal(() => {});
  for (let i = 0; i < 25; i++)
    journal.record("/auth/v1/user", 400, {
      code: privateValue,
      message: privateValue,
    });
  const rows = journal.read();
  assert.equal(rows.length, 20);
  assert.equal(rows[0].code, "unclassified");
  rows[0].code = "modified";
  assert.equal(journal.read()[0].code, "unclassified");
  assert.doesNotMatch(JSON.stringify(journal.read()), /private/);
});
