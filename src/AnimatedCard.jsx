import React, { useLayoutEffect, useRef } from "react";
export function AnimatedCard({ className, children, ...props }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (
      !element ||
      !("IntersectionObserver" in window) ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    element.classList.add("reveal-pending");
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          element.classList.remove("reveal-pending");
          element.classList.add("reveal-visible");
          observer.disconnect();
        }
      },
      { threshold: 0.08 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return (
    <article {...props} className={className} ref={ref}>
      {children}
    </article>
  );
}
