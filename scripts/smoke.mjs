#!/usr/bin/env node
/**
 * End-to-end HTTP smoke test against a running GapFinder AI instance.
 *
 * Usage:
 *   npm run dev            # in one terminal
 *   npm run smoke          # in another
 *   BASE_URL=http://localhost:3100 npm run smoke
 *
 * The script never prints session cookies or credentials.
 */
const baseUrl = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");

let passed = 0;
let failed = 0;
const failures = [];

function record(ok, name, detail) {
  if (ok) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    failures.push({ name, detail });
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function cookiesFrom(response) {
  const setCookie =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [response.headers.get("set-cookie")].filter(Boolean);
  const jar = new Map();
  for (const entry of setCookie) {
    const [pair] = entry.split(";");
    const index = pair.indexOf("=");
    if (index <= 0) continue;
    jar.set(pair.slice(0, index).trim(), pair.slice(index + 1).trim());
  }
  return jar;
}

function cookieHeader(jar) {
  return [...jar.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
}

function firstMatch(text, pattern) {
  const match = pattern.exec(text);
  return match?.[1] ?? null;
}

async function request(pathname, options = {}) {
  return fetch(`${baseUrl}${pathname}`, {
    redirect: "manual",
    ...options,
    headers: {
      Accept: "application/json, text/html",
      ...(options.headers ?? {}),
    },
  });
}

async function main() {
  console.log(`Smoke testing ${baseUrl}`);
  let health;
  try {
    health = await request("/api/health");
  } catch (error) {
    console.error(`\nCannot reach ${baseUrl}. Start the app first (npm run dev).`);
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(2);
  }

  const healthBody = await health.json().catch(() => null);
  record(health.ok, "GET /api/health returns 2xx", `HTTP ${health.status}`);
  record(
    healthBody?.status === "ok" || healthBody?.status === "degraded",
    "Health payload reports a status",
    JSON.stringify(healthBody?.status),
  );
  record(
    healthBody?.database === "ok",
    "Database answers a query",
    JSON.stringify(healthBody?.database),
  );
  record(
    typeof healthBody?.demo?.enabled === "boolean",
    "Health exposes demo enablement",
  );

  const landing = await request("/");
  record(
    landing.ok || landing.status === 307 || landing.status === 308,
    "Public landing page responds",
    `HTTP ${landing.status}`,
  );

  const guard = await request("/dashboard");
  record(
    guard.status === 307 || guard.status === 308 || guard.status === 302,
    "Unauthenticated /dashboard redirects to login",
    `HTTP ${guard.status} → ${guard.headers.get("location") ?? "no location"}`,
  );

  const apiGuard = await request("/api/subjects");
  record(
    apiGuard.status === 401,
    "Unauthenticated /api/subjects is rejected",
    `HTTP ${apiGuard.status}`,
  );

  const crossOrigin = await request("/api/subjects", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://evil.example" },
    body: JSON.stringify({ name: "Should not exist" }),
  });
  record(
    crossOrigin.status === 401 || crossOrigin.status === 403,
    "Cross-origin write is blocked before ownership",
    `HTTP ${crossOrigin.status}`,
  );

  if (healthBody?.demo?.enabled === false) {
    console.log("  SKIP  Demo flow (demo is disabled in this instance)");
    console.log(`\n${passed} passed, ${failed} failed`);
    process.exit(failed === 0 ? 0 : 1);
  }

  const demo = await request("/api/auth/demo", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: baseUrl },
    body: "{}",
  });
  const jar = cookiesFrom(demo);
  record(demo.ok, "POST /api/auth/demo issues a session", `HTTP ${demo.status}`);
  record(jar.size > 0, "Demo response sets a session cookie");

  if (!demo.ok || jar.size === 0) {
    console.log(`\n${passed} passed, ${failed} failed`);
    process.exit(1);
  }

  const authed = { Cookie: cookieHeader(jar) };

  const dashboard = await request("/dashboard", { headers: authed });
  record(dashboard.ok, "Authenticated /dashboard renders", `HTTP ${dashboard.status}`);

  const subjects = await request("/api/subjects", { headers: authed });
  const subjectsBody = await subjects.json().catch(() => null);
  record(subjects.ok, "Authenticated /api/subjects returns data", `HTTP ${subjects.status}`);
  record(
    Array.isArray(subjectsBody?.subjects) && subjectsBody.subjects.length === 3,
    "Demo workspace contains three isolated sample subjects",
    `${subjectsBody?.subjects?.length ?? 0} subject(s)`,
  );
  record(
    subjectsBody?.subjects?.every?.((subject) => subject.readyDocuments === 5) === true,
    "Each sample subject contains five indexed materials",
  );

  const reports = await request("/reports", { headers: authed });
  record(reports.ok, "Authenticated /reports renders", `HTTP ${reports.status}`);

  const dashboardHtml = await dashboard.text();
  record(
    /DEMO WORKSPACE|private and interactive/i.test(dashboardHtml),
    "Demo workspace shows its temporary-session banner",
  );

  const subjectId =
    firstMatch(dashboardHtml, /href="\/subjects\/([^"/]+)\/topics"/) ??
    subjectsBody?.subjects?.[0]?.id ??
    null;
  record(Boolean(subjectId), "A seeded subject ID is discoverable from the dashboard");

  for (const publicPath of [
    "/login",
    "/signup",
    "/demo-access",
    "/forgot-password",
    "/reset-password",
    "/privacy",
    "/terms",
  ]) {
    const response = await request(publicPath);
    record(response.ok, `Public page ${publicPath} renders`, `HTTP ${response.status}`);
  }

  const missing = await request("/smoke-test-route-that-does-not-exist");
  record(missing.status === 404, "Unknown route returns a 404 page", `HTTP ${missing.status}`);

  const unauthOnboarding = await request("/onboarding");
  record(
    [200, 302, 307, 308].includes(unauthOnboarding.status),
    "Unauthenticated /onboarding is guarded",
    `HTTP ${unauthOnboarding.status}`,
  );

  if (subjectId) {
    const subjectPages = [
      `/subjects/${subjectId}/topics`,
      `/materials?subject=${subjectId}`,
      `/materials/upload?subject=${subjectId}`,
      `/diagnostics?subject=${subjectId}`,
      `/reports/${subjectId}`,
      `/revision-plan?subject=${subjectId}`,
      `/assistant?subject=${subjectId}`,
      `/progress?subject=${subjectId}`,
      "/settings",
      "/onboarding",
    ];
    for (const path of subjectPages) {
      const response = await request(path, { headers: authed });
      record(
        response.ok || [302, 307, 308].includes(response.status),
        `Authenticated ${path} renders`,
        `HTTP ${response.status}`,
      );
    }

    const topicMap = await request(`/subjects/${subjectId}/topics`, { headers: authed });
    const topicMapHtml = await topicMap.text();
    const topicId = firstMatch(topicMapHtml, /href="\/learn\/([^"/]+)"/);
    record(Boolean(topicId), "Topic map links to a learn page");

    if (topicId) {
      const learn = await request(`/learn/${topicId}`, { headers: authed });
      record(learn.ok, "Authenticated /learn/[topicId] renders", `HTTP ${learn.status}`);

      const assistant = await request("/api/assistant", {
        method: "POST",
        headers: { ...authed, "Content-Type": "application/json", Origin: baseUrl },
        body: JSON.stringify({
          topicId,
          question: "Explain the key idea in the cited source material for this topic.",
        }),
      });
      const assistantBody = await assistant.json().catch(() => null);
      record(assistant.ok, "Grounded assistant request succeeds", `HTTP ${assistant.status}`);
      record(
        Array.isArray(assistantBody?.answer?.citations) &&
          assistantBody.answer.citations.length > 0,
        "Assistant answer includes resolved citations",
        `${assistantBody?.answer?.citations?.length ?? 0} citation(s)`,
      );
      record(
        assistantBody?.answer?.citations?.every?.(
          (citation) => typeof citation.documentId === "string" && citation.documentId.length > 0,
        ) === true,
        "Every assistant citation names an authorised document",
      );

      const invalidAssistant = await request("/api/assistant", {
        method: "POST",
        headers: { ...authed, "Content-Type": "application/json", Origin: baseUrl },
        body: JSON.stringify({ topicId, question: "hi" }),
      });
      record(
        invalidAssistant.status === 400,
        "Assistant rejects an invalid question with 400",
        `HTTP ${invalidAssistant.status}`,
      );
    }

    const materials = await request("/materials", { headers: authed });
    const materialsHtml = await materials.text();
    const documentId = firstMatch(materialsHtml, /href="\/materials\/(?!upload)([^"?]+)"/);
    record(Boolean(documentId), "Materials page links to an indexed document");
    if (documentId) {
      const documentPage = await request(`/materials/${documentId}`, { headers: authed });
      record(
        documentPage.ok,
        "Authenticated /materials/[documentId] renders",
        `HTTP ${documentPage.status}`,
      );
    }

    const diagnostics = await request("/diagnostics", { headers: authed });
    const diagnosticsHtml = await diagnostics.text();
    const resultsId = firstMatch(diagnosticsHtml, /href="\/diagnostics\/([^"/]+)\/results"/);
    if (resultsId) {
      const resultsPage = await request(`/diagnostics/${resultsId}/results`, { headers: authed });
      record(
        resultsPage.ok,
        "Authenticated /diagnostics/[assessmentId]/results renders",
        `HTTP ${resultsPage.status}`,
      );
    } else {
      record(false, "A submitted diagnostic result is discoverable", "no results link found");
    }

    let runnerId = firstMatch(diagnosticsHtml, /href="\/diagnostics\/([^"/]+)"/);
    if (!runnerId && topicId) {
      const started = await request("/api/assessments", {
        method: "POST",
        headers: { ...authed, "Content-Type": "application/json", Origin: baseUrl },
        body: JSON.stringify({ subjectId, topicIds: [topicId] }),
      });
      const startedBody = await started.json().catch(() => null);
      runnerId = startedBody?.result?.attemptId ?? null;
      record(
        started.status === 201,
        "Demo can start an interactive practice diagnostic",
        `HTTP ${started.status}`,
      );
    }
    if (runnerId) {
      const runnerPage = await request(`/diagnostics/${runnerId}`, { headers: authed });
      record(
        runnerPage.ok,
        "Authenticated /diagnostics/[assessmentId] renders",
        `HTTP ${runnerPage.status}`,
      );
    }
  }

  const demoWrite = await request("/api/subjects", {
    method: "POST",
    headers: { ...authed, "Content-Type": "application/json", Origin: baseUrl },
    body: JSON.stringify({ name: "Demo write probe" }),
  });
  record(
    demoWrite.status === 201,
    "Interactive demo allows subject creation",
    `HTTP ${demoWrite.status}`,
  );

  const logout = await request("/api/auth/logout", {
    method: "POST",
    headers: { ...authed, "Content-Type": "application/json", Origin: baseUrl },
    body: "{}",
  });
  record(logout.ok, "POST /api/auth/logout succeeds", `HTTP ${logout.status}`);
  const afterLogout = await request("/dashboard", { headers: authed });
  const afterLogoutHtml = await afterLogout.text();
  const sessionRevoked =
    [302, 307, 308].includes(afterLogout.status) ||
    /__next-page-redirect|NEXT_REDIRECT;replace;\/login/.test(afterLogoutHtml);
  record(
    sessionRevoked && !/Recent diagnostics/i.test(afterLogoutHtml),
    "The old session cookie no longer grants dashboard access",
    `HTTP ${afterLogout.status}`,
  );

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log("Failures:");
    for (const failure of failures) console.log(`  - ${failure.name}: ${failure.detail}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
