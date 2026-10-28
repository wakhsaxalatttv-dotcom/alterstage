import test from "node:test";
import assert from "node:assert/strict";
import { administrationConfiguration } from "../server/admin-config.js";
test("diagnostic privé : absent, trop court ou actif, sans valeur secrète", () => {
  assert.equal(administrationConfiguration("").reason, "missing");
  const short = "fiction-test";
  const shortDiagnostic = administrationConfiguration(short);
  assert.equal(shortDiagnostic.reason, "too_short");
  assert.equal(shortDiagnostic.configured, false);
  assert.ok(!JSON.stringify(shortDiagnostic).includes(short));
  const secret = "fiction-test-key-only-for-local-tests-123456789";
  const ready = administrationConfiguration(secret);
  assert.equal(ready.configured, true);
  assert.equal(ready.reason, "ready");
  assert.ok(!JSON.stringify(ready).includes(secret));
});
