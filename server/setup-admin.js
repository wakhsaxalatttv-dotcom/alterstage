import { readFile, writeFile, chmod } from "node:fs/promises";
import { randomBytes } from "node:crypto";
const file = new URL("../.env", import.meta.url);
let contents = "";
try {
  contents = await readFile(file, "utf8");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const existing = contents.match(/^ADMIN_TOKEN=(.*)$/m);
if (
  process.env.ADMIN_TOKEN?.length >= 32 ||
  existing?.[1].trim().replace(/^['"]|['"]$/g, "").length >= 32
) {
  console.log("Un jeton de modération existe déjà. Il n’a pas été remplacé.");
} else {
  const line = `ADMIN_TOKEN=${randomBytes(32).toString("hex")}`;
  contents = existing
    ? contents.replace(/^ADMIN_TOKEN=.*$/m, line)
    : contents + `${contents.endsWith("\n") || !contents ? "" : "\n"}${line}\n`;
  await writeFile(file, contents, { mode: 0o600 });
  await chmod(file, 0o600);
  console.log(
    "Modération locale configurée dans .env (fichier privé et ignoré par Git). Redémarrez le serveur. Consultez ce fichier dans votre éditeur pour accéder à la clé, sans la publier.",
  );
}
