/**
 * Register the DSEG LCD faces (SIL OFL, see THIRD_PARTY_NOTICES.md). Vite turns these imports
 * into hashed asset URLs, so the fonts ship with the build instead of loading from a CDN.
 */
import dseg7Bold from "dseg/fonts/DSEG7-Classic/DSEG7Classic-Bold.woff2";
import dseg14Bold from "dseg/fonts/DSEG14-Classic/DSEG14Classic-Bold.woff2";

const CSS = `
@font-face { font-family: "DSEG7 Classic"; src: url("${dseg7Bold}") format("woff2"); font-weight: 400 900; font-display: block; }
@font-face { font-family: "DSEG14 Classic"; src: url("${dseg14Bold}") format("woff2"); font-weight: 400 900; font-display: block; }
`;

let installed = false;

export function installLcdFonts(): void {
  if (installed || typeof document === "undefined") return;
  installed = true;
  const style = document.createElement("style");
  style.dataset.lcdFonts = "";
  style.textContent = CSS;
  document.head.appendChild(style);
}
