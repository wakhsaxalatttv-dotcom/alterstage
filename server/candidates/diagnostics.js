// Only fixed labels leave this classifier. Never retain provider messages, URLs,
// identifiers, recipient addresses, request bodies or authentication headers.
const operations = new Map([
  ["/auth/v1/signup", "signup"],
  ["/auth/v1/recover", "recovery"],
  ["/auth/v1/resend", "confirmation"],
  ["/auth/v1/token", "session"],
  ["/auth/v1/verify", "verification"],
  ["/auth/v1/settings", "settings"],
  ["/auth/v1/user", "user"],
  ["/auth/v1/logout", "logout"],
  ["/rest/v1/rpc/of_setup_status", "schema"],
]);
const safeCodes = new Set([
  "unexpected_failure",
  "email_address_not_authorized",
  "email_address_invalid",
  "email_address_not_confirmed",
  "email_provider_disabled",
  "signup_disabled",
  "over_email_send_rate_limit",
  "over_request_rate_limit",
  "invalid_credentials",
  "user_already_exists",
  "email_exists",
  "weak_password",
  "captcha_failed",
  "request_timeout",
  "bad_jwt",
  "session_not_found",
  "refresh_token_not_found",
  "refresh_token_already_used",
  "validation_failed",
  "PGRST202",
  "42P01",
  "23505",
  "42501",
  "PT400",
  "PT401",
  "PT403",
  "PT404",
  "PT409",
]);
export function providerFailure(path, status, data) {
  const pathname = path.split("?")[0];
  const operation =
    operations.get(pathname) ||
    (pathname.startsWith("/auth/") ? "auth" : "database");
  const code = safeCodes.has(data?.code) ? data.code : "unclassified";
  const message = String(
    data?.msg || data?.message || data?.error_description || "",
  ).slice(0, 2000);
  const mailOperation = [
    "signup",
    "recovery",
    "confirmation",
    "verification",
  ].includes(operation);
  let category =
    status === null
      ? "network"
      : status === 429
        ? "rate_limit"
        : status >= 500
          ? "service"
          : "request";
  if (
    mailOperation &&
    ((status >= 500 &&
      /(?:error|fail(?:ed|ure)?) sending.{0,60}(?:email|e-mail|confirmation|recovery)|smtp|email provider|\b535\b.{0,30}(?:5\.7\.8|authentication failed)/i.test(
        message,
      )) ||
      code === "email_address_not_authorized")
  )
    category = "email_delivery";
  else if (operation === "schema" && [404, 400].includes(status))
    category = "schema";
  else if (
    ["settings", "schema", "signup", "recovery", "confirmation"].includes(
      operation,
    ) &&
    [401, 403].includes(status)
  )
    category = "credentials";
  else if (["email_provider_disabled", "signup_disabled"].includes(code))
    category = "registration_disabled";
  return { operation, category, status, code };
}
export function failureJournal(
  onFailure = (event) =>
    console.error("[Comptes] Échec fournisseur", JSON.stringify(event)),
) {
  const entries = [];
  return {
    record(path, status, data) {
      const event = {
        at: new Date().toISOString(),
        ...providerFailure(path, status, data),
      };
      entries.unshift(event);
      if (entries.length > 20) entries.length = 20;
      if (
        status === null ||
        status >= 500 ||
        [
          "credentials",
          "schema",
          "email_delivery",
          "registration_disabled",
        ].includes(event.category)
      )
        onFailure(event);
      return event;
    },
    read() {
      return entries.map((e) => ({ ...e }));
    },
  };
}
