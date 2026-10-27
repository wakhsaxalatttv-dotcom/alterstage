import { XMLParser, XMLValidator } from "fast-xml-parser";
const array = (value) =>
  value == null ? [] : Array.isArray(value) ? value : [value];
export function parseFeed(source, body) {
  if (source.kind === "json") {
    const parsed = JSON.parse(body);
    const records = Array.isArray(parsed) ? parsed : parsed.offers;
    if (!Array.isArray(records))
      throw new Error("Le flux JSON doit contenir une liste offers.");
    return records.slice(0, 500);
  }
  if (source.kind === "rss") {
    if (
      /<!DOCTYPE|<!ENTITY/i.test(body) ||
      XMLValidator.validate(body) !== true
    )
      throw new Error("XML non autorisé ou invalide");
    const parsed = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      processEntities: false,
    }).parse(body);
    const items = parsed.rss?.channel?.item || parsed.feed?.entry;
    if (!parsed.rss && !parsed.feed)
      throw new Error("Flux RSS/Atom non reconnu");
    return array(items)
      .slice(0, 500)
      .map((item) => {
        const links = array(item.link),
          link =
            typeof links[0] === "string"
              ? links[0]
              : links.find((l) => !l["@_rel"] || l["@_rel"] === "alternate")?.[
                  "@_href"
                ];
        const value = (v) => (typeof v === "string" ? v : v?.["#text"]);
        return {
          ...source.defaults,
          externalId: value(item.guid) || value(item.id) || link,
          title: value(item.title),
          sourceUrl: link,
          description:
            value(item["content:encoded"]) ||
            value(item.content) ||
            value(item.description) ||
            value(item.summary),
          publishedAt: value(item.pubDate) || value(item.published),
          sourceUpdatedAt: value(item.updated),
        };
      });
  }
  throw new Error("Connecteur non pris en charge");
}
