import { createServer } from "node:http";
import { getSupabase } from "../supabase/client.js";
import { publishPost } from "../x/publish.js";
import { isXConfigured } from "../x/client.js";
import { getConfig } from "../config/index.js";
import type { PostRow } from "../types/index.js";

// Minimal local-only approval queue. Binds to 127.0.0.1, never 0.0.0.0 —
// this holds the service-role key server-side (never sent to the
// browser) and has no authentication of its own, so it must never be
// exposed beyond localhost. Run it on the same machine/VPS as the
// session loop, view it over an SSH tunnel if remote.
const HOST = "127.0.0.1";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function fetchPending(): Promise<PostRow[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .eq("status", "pending")
    .order("ts", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

function renderPage(posts: PostRow[], notice: string | null): string {
  const xConfigured = isXConfigured();
  const noticeHtml = notice
    ? `<p style="background:#fffbe6;border:1px solid #e2c;padding:8px;">${escapeHtml(notice)}</p>`
    : "";
  const warningHtml = xConfigured
    ? ""
    : `<p style="background:#fee;border:1px solid #c00;padding:8px;">X credentials aren't configured — approving will mark a post approved without actually posting it. Fill in X_API_KEY etc. in .env to post for real.</p>`;

  const rows = posts.length
    ? posts
        .map(
          (p) => `
    <div style="border:1px solid #ccc;border-radius:8px;padding:12px;margin-bottom:12px;">
      <div style="color:#888;font-size:12px;margin-bottom:6px;">
        gen ${p.generation ?? "—"} · ${escapeHtml(p.category)} · ${escapeHtml(p.ts)}
      </div>
      <div style="white-space:pre-wrap;margin-bottom:10px;">${escapeHtml(p.content)}</div>
      <div style="color:#888;font-size:12px;margin-bottom:10px;">
        ${p.content.length} chars · backed by ${p.event_ids.length} event(s)
      </div>
      <form method="POST" action="/approve/${p.id}" style="display:inline">
        <button type="submit">approve${xConfigured ? " & post" : ""}</button>
      </form>
      <form method="POST" action="/reject/${p.id}" style="display:inline;margin-left:8px">
        <button type="submit">reject</button>
      </form>
    </div>`
        )
        .join("\n")
    : `<p>nothing pending.</p>`;

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>xorome — approval queue</title>
  <style>
    body { font-family: ui-monospace, monospace; max-width: 640px; margin: 24px auto; padding: 0 16px; }
    button { cursor: pointer; padding: 4px 10px; }
  </style>
</head>
<body>
  <h1>approval queue</h1>
  <p style="color:#888">${posts.length} pending</p>
  ${warningHtml}
  ${noticeHtml}
  ${rows}
</body>
</html>`;
}

function notFound(res: import("node:http").ServerResponse): void {
  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("not found");
}

function redirectHome(res: import("node:http").ServerResponse, notice?: string): void {
  const query = notice ? `?notice=${encodeURIComponent(notice)}` : "";
  res.writeHead(302, { Location: `/${query}` });
  res.end();
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://${HOST}`);

    if (req.method === "GET" && url.pathname === "/") {
      const posts = await fetchPending();
      const notice = url.searchParams.get("notice");
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(renderPage(posts, notice));
      return;
    }

    if (req.method === "POST" && url.pathname.startsWith("/approve/")) {
      const id = url.pathname.slice("/approve/".length);
      const supabase = getSupabase();
      const { data: post, error } = await supabase.from("posts").select("*").eq("id", id).single();
      if (error || !post) {
        redirectHome(res, `post ${id} not found`);
        return;
      }

      if (!isXConfigured()) {
        await supabase
          .from("posts")
          .update({ status: "approved", reviewed_at: new Date().toISOString(), reviewed_by: "operator" })
          .eq("id", id);
        redirectHome(res, "approved (not posted — X not configured)");
        return;
      }

      const result = await publishPost(post);
      if (result.success) {
        await supabase
          .from("posts")
          .update({ reviewed_at: new Date().toISOString(), reviewed_by: "operator" })
          .eq("id", id);
        redirectHome(res, `posted to X: ${result.xPostId}`);
      } else {
        redirectHome(res, `failed to post: ${result.error}`);
      }
      return;
    }

    if (req.method === "POST" && url.pathname.startsWith("/reject/")) {
      const id = url.pathname.slice("/reject/".length);
      const supabase = getSupabase();
      await supabase
        .from("posts")
        .update({ status: "rejected", reviewed_at: new Date().toISOString(), reviewed_by: "operator" })
        .eq("id", id);
      redirectHome(res, "rejected");
      return;
    }

    notFound(res);
  } catch (err) {
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end(err instanceof Error ? err.message : String(err));
  }
});

const port = getConfig().approvalQueuePort;
server.listen(port, HOST, () => {
  console.log(`approval queue at http://${HOST}:${port} (localhost only)`);
});
