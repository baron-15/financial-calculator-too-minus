/**
 * Register the DSEG7 LCD face for numbers (SIL OFL, see THIRD_PARTY_NOTICES.md). Vite turns the import
 * into a hashed asset URL, so the font ships with the build instead of loading from a CDN.
 * Labels and text values are drawn as SVG segments instead (lcdSegments.ts).
 */
import dseg7Bold from "dseg/fonts/DSEG7-Classic/DSEG7Classic-Bold.woff2";

const CSS = `
@font-face { font-family: "DSEG7 Classic"; src: url("${dseg7Bold}") format("woff2"); font-weight: 400 900; font-display: block; }
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
