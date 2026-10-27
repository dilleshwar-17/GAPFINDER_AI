"use client";

import { useEffect } from "react";

export function DemoSessionLifecycle() {
  useEffect(() => {
    function endDemoSession() {
      navigator.sendBeacon(
        "/api/auth/demo/exit",
        new Blob(["{}"], { type: "application/json" }),
      );
    }

    window.addEventListener("pagehide", endDemoSession);
    return () => window.removeEventListener("pagehide", endDemoSession);
  }, []);

  return null;
}
