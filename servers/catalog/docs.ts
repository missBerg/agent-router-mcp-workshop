// docs: the engineering wiki - runbooks, processes and architecture notes.
import { z } from "zod";
import { paging, tool, type ToolDef } from "../tool.ts";
import { DOCS, type DocPage } from "../world.ts";

const path = z.string().describe("Page path, e.g. 'runbooks/postal-code-validation.md'.");
const space = z.string().optional().describe("Documentation space, e.g. 'runbooks' or 'process'. Defaults to all spaces.");

const STOP_WORDS = new Set(["the", "a", "an", "and", "or", "for", "to", "of", "in", "on", "how", "do", "i", "is", "what", "with"]);

/** Keyword search: title matches weigh most, then keywords, then body text. */
function searchPages(query: string, limit = 5) {
  const terms = (query.toLowerCase().match(/[a-z0-9.#-]+/g) ?? [])
    .filter((w) => !STOP_WORDS.has(w))
    .map((w) => (w.length > 4 ? w.replace(/(ing|ed|es|s)$/, "") : w));
  const score = (p: DocPage) =>
    terms.reduce((sum, t) => sum + (p.title.toLowerCase().includes(t) ? 3 : 0) + (p.keywords.some((k) => k.startsWith(t)) ? 2 : 0) + (`${p.path} ${p.body}`.toLowerCase().includes(t) ? 1 : 0), 0);
  return DOCS.map((p) => ({ p, s: score(p) }))
    .filter((r) => r.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map(({ p }) => ({ title: p.title, path: p.path, excerpt: p.excerpt }));
}

function findPage(wanted: string): DocPage {
  const page = DOCS.find((p) => p.path === wanted.trim() || p.title.toLowerCase() === wanted.trim().toLowerCase());
  if (!page) throw new Error(`Page '${wanted}' not found. Pages: ${DOCS.map((p) => p.path).join(", ")}.`);
  return page;
}

export const docs: ToolDef[] = [
  // --- the tool the ship-it job needs ---
  tool("search_docs", "Searches the engineering docs (runbooks, processes, architecture notes) by keywords and returns matching pages with their title, path and a short excerpt.",
    { query: z.string().describe("Keywords to search for, e.g. 'postal code validation' or 'release process'.") },
    {
      run: ({ query }) => {
        const results = searchPages(query);
        return results.length ? { query, results } : `No docs matched '${query}'. Try keywords such as 'postal code', 'release', 'rollback' or 'incident'.`;
      },
    }),

  // --- reading ---
  tool("search", "Full-text search across all wiki content, including page bodies, comments and attachments. Supports quoted phrases and 'space:' filters.",
    { query: z.string().describe("Search query, e.g. '\"postal code\" space:runbooks'."), ...paging },
    { run: ({ query }) => searchPages(query, 10) }),
  tool("ask_docs", "Answers a natural-language question using the docs as a knowledge base and cites the pages it used.",
    { question: z.string().describe("The question, e.g. 'Who can approve production deploys?'") },
    { run: ({ question }) => { const [top] = searchPages(question, 1); return top ? `${top.excerpt}\n\nSource: ${top.path}` : "I could not find an answer in the docs."; } }),
  tool("get_page", "Gets the full Markdown content of a page by path or exact title.", { path },
    { run: ({ path }) => { const p = findPage(path); return `${p.body}\n\n(path: ${p.path})`; } }),
  tool("list_pages", "Lists pages in a documentation space with their titles and last-edited times.", { space, ...paging },
    { run: ({ space }) => DOCS.filter((p) => !space || p.path.startsWith(`${space}/`)).map(({ title, path }) => ({ title, path })) }),
  tool("list_runbooks", "Lists operational runbooks with their owning team and last review date.", { ...paging },
    { run: () => DOCS.filter((p) => p.path.startsWith("runbooks/")).map(({ title, path }) => ({ title, path, owner: "#checkout-team" })) }),
  tool("get_runbook", "Gets a runbook by name, including its step-by-step procedure and escalation contacts.",
    { name: z.string().describe("Runbook name or slug, e.g. 'rollback'.") }),
  tool("get_page_history", "Lists the revisions of a page with author, timestamp and change summary.", { path, ...paging }),
  tool("get_backlinks", "Lists pages that link to the given page.", { path }),
  tool("get_page_owners", "Gets the owners and reviewers responsible for keeping a page up to date.", { path }),
  tool("list_recent_changes", "Lists recently created or edited pages across the wiki.",
    { space, since: z.string().optional().describe("Only changes after this ISO 8601 timestamp."), ...paging }),
  tool("export_page", "Exports a page as PDF, HTML or Markdown and returns a download URL.",
    { path, format: z.enum(["pdf", "html", "markdown"]).describe("Export format.") }),

  // --- writing ---
  tool("create_page", "Creates a new page in a documentation space.",
    { space: z.string().describe("Space to create the page in."), title: z.string().describe("Page title."), content: z.string().describe("Page content in Markdown."), parent: z.string().optional().describe("Path of the parent page.") }),
  tool("update_page", "Replaces the content of an existing page and records a new revision.",
    { path, content: z.string().describe("New page content in Markdown."), summary: z.string().optional().describe("Change summary for the page history.") }),
  tool("delete_page", "Permanently deletes a page and all of its revisions, comments and attachments. This cannot be undone.",
    { path },
    { danger: "Page '{path}' and all its history permanently deleted. The next on-call engineer will have to improvise." }),
  tool("move_page", "Moves a page to a new path or space. Links to the old path redirect automatically.",
    { path, new_path: z.string().describe("Destination path.") }),
  tool("restore_page_version", "Restores a page to an earlier revision. The current content is kept in history.",
    { path, revision: z.number().int().describe("Revision number to restore.") }),
  tool("create_page_from_template", "Creates a new page from a template such as 'runbook', 'postmortem' or 'design-doc'.",
    { template: z.string().describe("Template name."), space: z.string().describe("Space to create the page in."), title: z.string().describe("Page title.") }),
  tool("publish_page", "Publishes a draft page so it becomes visible to all readers.", { path }),
  tool("request_page_review", "Asks one or more people to review a page.",
    { path, reviewers: z.array(z.string()).min(1).describe("Logins of the reviewers.") }),
  tool("tag_page", "Adds tags to a page to make it easier to find.",
    { path, tags: z.array(z.string()).min(1).describe("Tags to add, e.g. ['checkout', 'postal-code'].") }),
  tool("list_tags", "Lists all tags used in the wiki with the number of pages per tag.", { ...paging }),
  tool("watch_page", "Subscribes the current user to notifications when a page changes.", { path }),

  // --- spaces, templates, comments, attachments ---
  tool("list_spaces", "Lists documentation spaces with their descriptions and owners.", { ...paging }),
  tool("get_space", "Gets a documentation space's description, owners, permissions and home page.", { space: z.string().describe("Space key, e.g. 'runbooks'.") }),
  tool("create_space", "Creates a new documentation space.",
    { key: z.string().describe("Short space key, e.g. 'payments'."), name: z.string().describe("Display name."), description: z.string().optional().describe("What the space is for.") }),
  tool("list_templates", "Lists page templates available in a space.", { space }),
  tool("add_comment", "Adds a comment to a docs page, optionally anchored to a quoted passage.",
    { path, body: z.string().describe("Comment text in Markdown."), quote: z.string().optional().describe("Passage of the page the comment refers to.") }),
  tool("list_comments", "Lists comments on a docs page, including resolved ones if requested.",
    { path, include_resolved: z.boolean().optional().describe("Include resolved comments.") }),
  tool("resolve_comment", "Marks a page comment as resolved.", { comment_id: z.string().describe("Comment id.") }),
  tool("list_attachments", "Lists files attached to a page.", { path }),
  tool("upload_attachment", "Attaches a file to a page from a URL.",
    { path, file_url: z.string().describe("URL of the file to attach."), filename: z.string().optional().describe("Name to store the file under.") }),
];
