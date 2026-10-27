export async function request(url, { token, ...options } = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(
      "Le serveur n’a pas renvoyé une réponse lisible. Vérifiez son démarrage.",
    );
  }
  if (!response.ok) throw new Error(data.message || "La demande a échoué.");
  return data;
}
