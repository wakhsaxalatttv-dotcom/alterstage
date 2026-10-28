import React from "react";
export function HeroDecoration() {
  return (
    <svg
      className="hero-decoration"
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 240 240"
      fill="none"
    >
      <circle cx="120" cy="120" r="104" stroke="currentColor" strokeWidth="1" />
      <g
        transform="translate(48 44) scale(6)"
        stroke="currentColor"
        strokeWidth="0.45"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 19 2c1 2 2 4.2 2 8 0 5.5-4.8 10-10 10Z" />
        <path d="M2 22c0-6 6-10 12-12" />
      </g>
    </svg>
  );
}
