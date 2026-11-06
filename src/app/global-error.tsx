"use client";

/** Last-resort boundary (root layout failed). Renders its own document with inline styles. */
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="en-IN">
      <body style={{ margin: 0, background: "#F6F5F1", color: "#18211D", fontFamily: "system-ui, sans-serif" }}>
        <title>Something went wrong · Trip Roulette Kerala</title>
        <main style={{ maxWidth: 560, margin: "0 auto", padding: "48px 16px" }}>
          <div role="alert" style={{ background: "#FCE8E5", border: "1px solid #E6A49B", color: "#7A1D13", borderRadius: 18, padding: 20 }}>
            <h1 style={{ margin: "0 0 8px", fontSize: 26 }}>Something went wrong</h1>
            <p style={{ margin: "0 0 16px", fontSize: 15, lineHeight: 1.5 }}>The app couldn&apos;t load. Please try again.</p>
            <button
              type="button"
              onClick={() => retry()}
              style={{ height: 48, padding: "0 20px", borderRadius: 14, border: "1.5px solid #C9C7BE", background: "#fff", fontSize: 15, fontWeight: 600 }}
            >
              Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
