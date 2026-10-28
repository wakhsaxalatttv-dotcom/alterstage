import { AppLogo } from "./AppLogo";
import React from "react";
import { createRoot } from "react-dom/client";
import { Moderation } from "./Moderation";
import "@fontsource-variable/inter/wght.css";
import "./styles.css";
import "./appearance.css";
function Administration() {
  return (
    <>
      <header>
        <div className="nav wrap">
          <a className="brand" href="/">
            <AppLogo /> offres fraîches
          </a>
          <a href="/">Retour au site</a>
        </div>
      </header>
      <main className="wrap private-admin">
        <Moderation onChanged={() => {}} />
      </main>
    </>
  );
}
createRoot(document.getElementById("root")).render(<Administration />);
