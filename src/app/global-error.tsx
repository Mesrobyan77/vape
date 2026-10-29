"use client";

/** Last-resort boundary (root layout failed). Plain markup: providers may be unavailable. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="hy">
      <body style={{ background: "#0c0c0d", color: "#fafafa", fontFamily: "system-ui, sans-serif", minHeight: "100vh", display: "grid", placeItems: "center", margin: 0 }}>
        <main style={{ textAlign: "center", padding: 24, maxWidth: 560 }}>
          <h1 style={{ fontSize: 28, marginBottom: 12 }}>Ինչ-որ բան սխալ գնաց · Что-то пошло не так · Something went wrong</h1>
          {error.digest ? <p style={{ color: "#92949f", marginBottom: 24 }}>Ref: {error.digest}</p> : null}
          <button
            type="button"
            onClick={reset}
            style={{ background: "#7641ba", color: "#fafafa", border: 0, padding: "12px 24px", fontWeight: 700, cursor: "pointer" }}
          >
            ↻
          </button>
        </main>
      </body>
    </html>
  );
}
