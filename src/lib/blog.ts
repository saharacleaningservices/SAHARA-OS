import fs from "node:fs";
import path from "node:path";

// Markdown blog (owner 2026-11-03): posts live in content/blog/<slug>.md with a frontmatter block (title, date, author, excerpt,
// keywords). Dependency-free on purpose: a tiny renderer for the subset we use (headings, paragraphs, bold/italic, links, lists,
// blockquotes, tables, rules). All text is HTML-escaped before markup is added, so a post can never inject HTML.

export type BlogPost = {
  slug: string;
  title: string;
  date: string;
  author: string;
  excerpt: string;
  keywords: string[];
  body: string;
};

const BLOG_DIR = path.join(process.cwd(), "content", "blog");
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function parsePost(slug: string, raw: string): BlogPost | null {
  const m = raw.replace(/\r\n/g, "\n").match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return null;
  const meta: Record<string, unknown> = {};
  for (const line of m[1].split("\n")) {
    const i = line.indexOf(":");
    if (i < 1) continue;
    const key = line.slice(0, i).trim();
    const val = line.slice(i + 1).trim();
    try {
      meta[key] = JSON.parse(val);
    } catch {
      meta[key] = val;
    }
  }
  const title = str(meta.title);
  if (!title) return null;
  return {
    slug,
    title,
    date: str(meta.date),
    author: str(meta.author) || "Sahara Cleaning Services",
    excerpt: str(meta.excerpt),
    keywords: Array.isArray(meta.keywords) ? meta.keywords.filter((k): k is string => typeof k === "string") : [],
    body: m[2],
  };
}

export function getPost(slug: string): BlogPost | null {
  if (!SLUG_RE.test(slug)) return null;
  try {
    return parsePost(slug, fs.readFileSync(path.join(BLOG_DIR, `${slug}.md`), "utf8"));
  } catch {
    return null;
  }
}

/** All posts, newest first. Returns [] when the content folder does not exist. */
export function getAllPosts(): BlogPost[] {
  let files: string[] = [];
  try {
    files = fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith(".md"));
  } catch {
    return [];
  }
  const posts: BlogPost[] = [];
  for (const f of files) {
    const p = getPost(f.slice(0, -3));
    if (p) posts.push(p);
  }
  return posts.sort((a, b) => b.date.localeCompare(a.date));
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function inline(raw: string): string {
  let s = esc(raw);
  s = s.replace(/\\\*/g, "&#42;");
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" class="text-primary underline">$1</a>');
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  return s;
}

const isBlockStart = (l: string) => /^(#{1,4}\s|>|[-*]\s|\||---+\s*$)/.test(l);

function cells(line: string): string[] {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
}

export function renderMarkdown(md: string): string {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    if (/^---+\s*$/.test(line)) {
      out.push('<hr class="my-8 border-[#0a2540]/10"/>');
      i++;
      continue;
    }
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      // The page header already shows the title as the one H1, so a leading "# Title" is dropped.
      if (h[1].length > 1) {
        const cls = h[1].length === 2 ? "mt-10 text-2xl font-extrabold text-[#0a2540]" : "mt-6 text-lg font-bold text-[#0a2540]";
        out.push(`<h${h[1].length} class="${cls}">${inline(h[2])}</h${h[1].length}>`);
      }
      i++;
      continue;
    }
    if (line.startsWith(">")) {
      const q: string[] = [];
      while (i < lines.length && lines[i].startsWith(">")) {
        q.push(inline(lines[i].replace(/^>\s?/, "")));
        i++;
      }
      out.push(`<blockquote class="mt-5 rounded-2xl border-l-4 border-primary bg-primary/5 p-4 leading-7">${q.join("<br/>")}</blockquote>`);
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push(`<li>${inline(lines[i].replace(/^[-*]\s+/, ""))}</li>`);
        i++;
      }
      out.push(`<ul class="mt-3 list-disc space-y-1 pl-6 leading-7">${items.join("")}</ul>`);
      continue;
    }
    if (line.startsWith("|")) {
      const rows: string[] = [];
      while (i < lines.length && lines[i].startsWith("|")) {
        rows.push(lines[i]);
        i++;
      }
      const head = cells(rows[0]);
      const body = rows.slice(1).filter((r) => !/^\|?\s*:?-+/.test(r)).map(cells);
      const th = head.map((c) => `<th class="border-b border-[#0a2540]/15 px-3 py-2 text-left font-bold">${inline(c)}</th>`).join("");
      const tr = body
        .map((r) => `<tr>${r.map((c) => `<td class="border-b border-[#0a2540]/10 px-3 py-2 align-top">${inline(c)}</td>`).join("")}</tr>`)
        .join("");
      out.push(`<div class="mt-5 overflow-x-auto rounded-2xl bg-white shadow-sm"><table class="w-full text-sm"><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table></div>`);
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i])) {
      para.push(inline(lines[i]));
      i++;
    }
    if (!para.length) {
      i++;
      continue;
    }
    out.push(`<p class="mt-3 leading-7">${para.join("<br/>")}</p>`);
  }
  return out.join("\n");
}
