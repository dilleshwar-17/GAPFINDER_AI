"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          background: "#f9fafb",
          color: "#1d2939",
          fontFamily:
            "'Onest Variable', Onest, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
        }}
      >
        <main id="main-content" style={{ maxWidth: "560px" }}>
          <p
            style={{
              margin: 0,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: "0.68rem",
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "#7a5af8",
            }}
          >
            GapFinder AI
          </p>
          <h1 style={{ margin: "10px 0 0", fontSize: "1.8rem", lineHeight: 1.2 }}>
            The application shell failed to load.
          </h1>
          <p style={{ margin: "12px 0 0", fontSize: "0.92rem", lineHeight: 1.6, color: "#475467" }}>
            A root-level error stopped the page before it could render. No study data is displayed in a
            degraded state. Retry, and if it repeats, report the digest below to the operator.
          </p>
          {error.digest ? (
            <p
              style={{
                margin: "14px 0 0",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                fontSize: "0.7rem",
                color: "#b54708",
              }}
            >
              Digest: {error.digest}
            </p>
          ) : null}
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "22px",
              border: "1px solid #171f2e",
              background: "#171f2e",
              color: "#f9fafb",
              padding: "10px 16px",
              borderRadius: "8px",
              fontSize: "0.86rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Reload the application
          </button>
        </main>
      </body>
    </html>
  );
}
