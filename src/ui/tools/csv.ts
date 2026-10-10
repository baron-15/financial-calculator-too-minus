/** Minimal RFC 4180 CSV writer and a client-side download helper. */

const needsQuotes = /[",\r\n]/;

export function csvCell(v: string | number): string {
  const s = String(v);
  return needsQuotes.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: readonly string[], rows: readonly (readonly (string | number)[])[]): string {
  return [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

/** Save text as a file via a Blob URL (no server round trip). */
export function downloadText(filename: string, text: string, mime = "text/csv;charset=utf-8"): void {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Give the browser a moment to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
