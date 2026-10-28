import React, { useEffect, useState } from "react";
function httpsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password
      ? url
      : null;
  } catch {
    return null;
  }
}
export function companyInitials(name = "") {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return (
    words.length > 1
      ? words
          .slice(0, 2)
          .map((word) => Array.from(word)[0])
          .join("")
      : Array.from(words[0] || "?")
          .slice(0, 2)
          .join("")
  ).toLocaleUpperCase("fr-FR");
}
export function CompanyLogo({ company, size = 48 }) {
  const logo = httpsUrl(company.logoUrl),
    website = httpsUrl(company.website);
  const candidates = [
    ...(logo ? [{ url: logo.href, label: `Logo de ${company.name}` }] : []),
    ...(website
      ? [
          {
            url: `https://www.google.com/s2/favicons?domain_url=${encodeURIComponent(website.origin)}&sz=128`,
            label: `Icône du site officiel de ${company.name}`,
          },
        ]
      : []),
  ];
  const signature = candidates.map((item) => item.url).join("|");
  const [index, setIndex] = useState(0),
    [loaded, setLoaded] = useState("");
  useEffect(() => {
    setIndex(0);
    setLoaded("");
  }, [signature]);
  const current = candidates[index],
    ready = current && loaded === current.url;
  return (
    <span
      className="company-logo"
      style={{ "--logo-size": `${size}px` }}
      role="img"
      aria-label={ready ? current.label : `Initiales de ${company.name}`}
      title={ready ? current.label : company.name}
    >
      {!ready && (
        <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
          <rect width="48" height="48" rx="8" />
          <text x="24" y="25" textAnchor="middle" dominantBaseline="middle">
            {companyInitials(company.name)}
          </text>
        </svg>
      )}
      {current && (
        <img
          key={current.url}
          src={current.url}
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          alt=""
          style={{ opacity: ready ? 1 : 0 }}
          onLoad={(event) => {
            if (event.currentTarget.naturalWidth > 0) setLoaded(current.url);
            else setIndex((value) => value + 1);
          }}
          onError={() => setIndex((value) => value + 1)}
        />
      )}
    </span>
  );
}
