export function administrationConfiguration(token) {
  if (!token)
    return {
      configured: false,
      reason: "missing",
      message:
        "[Administration] ADMIN_TOKEN absent du serveur en cours d’exécution.",
    };
  if (typeof token !== "string" || token.length < 32)
    return {
      configured: false,
      reason: "too_short",
      message:
        "[Administration] ADMIN_TOKEN reçu mais trop court : 32 caractères minimum sont nécessaires.",
    };
  return {
    configured: true,
    reason: "ready",
    message: "[Administration] ADMIN_TOKEN reçu : accès privé activé.",
  };
}
