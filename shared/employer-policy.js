const normalized = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
// Check the named employer/sector, never mentions of a school in a legitimate job description.
export function isTrainingEmployer(name = "", sector = "", naf = "") {
  return (
    /^85/.test(String(naf)) ||
    /\b(iscod|studi|openclassrooms|ifcv|isifa|esicad|igefi|groupe alternance|bloom alternance|bretagne alternance|rh alternance)\b/i.test(
      normalized(name),
    ) ||
    /\b(cfa|ecole|campus|universite|university|lycee|centre de formation|organisme de formation|institut de formation)\b/i.test(
      normalized(name),
    ) ||
    /\b(enseignement|education|formation d.adultes)\b/i.test(normalized(sector))
  );
}
