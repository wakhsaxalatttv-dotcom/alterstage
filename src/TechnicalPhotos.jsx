import React from "react";
const photos = [
  {
    name: "embedded-systems",
    label: "Systèmes embarqués",
    alt: "Photographie d’une carte Raspberry Pi 5 et de ses connecteurs",
    width: 720,
    height: 480,
  },
  {
    name: "machine-vision",
    label: "Électronique & vision",
    alt: "Photographie d’un module caméra à obturateur global et de son capteur",
    width: 720,
    height: 240,
  },
];
export function TechnicalPhotos() {
  return (
    <aside
      className="technical-photos"
      aria-label="Photographies de matériel technique"
    >
      <div className="technical-photo-grid">
        {photos.map((photo) => (
          <figure key={photo.name}>
            <img
              src={`/images/${photo.name}-360.webp`}
              srcSet={`/images/${photo.name}-360.webp 360w, /images/${photo.name}-720.webp 720w`}
              sizes="(max-width: 700px) 45vw, (max-width: 1000px) 40vw, 190px"
              width={photo.width}
              height={photo.height}
              alt={photo.alt}
              decoding="async"
            />
            <figcaption>{photo.label}</figcaption>
          </figure>
        ))}
      </div>
      <div className="photo-credit">
        Photos d’illustration ·{" "}
        <a
          href="/images/credits.html"
          target="_blank"
          rel="noopener noreferrer"
        >
          Raspberry Pi · CC BY-SA 4.0{" "}
          <span className="sr-only">(crédits, nouvel onglet)</span>
        </a>
      </div>
    </aside>
  );
}
