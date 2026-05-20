export type GitHubCommitListItem = {
  sha: string;
  commit: { message: string; author?: { date?: string } };
};

export type GitHubCommitDetail = GitHubCommitListItem & {
  files?: Array<{ filename: string; patch?: string; status?: string }>;
};

export function githubHeaders() {
  const token = process.env.GITHUB_TOKEN || process.env.GH_PAT;
  if (!token) throw new Error("GITHUB_TOKEN (or GH_PAT) is required");
  return {
    accept: "application/vnd.github.v3+json",
    authorization: `Bearer ${token}`
  };
}

export async function fetchCommits() {
  const response = await fetch("https://api.github.com/repos/iterativv/NostalgiaForInfinity/commits?per_page=20", {
    headers: githubHeaders(),
    next: { revalidate: 0 }
  });
  if (!response.ok) throw new Error(`GitHub commits fetch failed: ${response.status}`);
  return (await response.json()) as GitHubCommitListItem[];
}

export async function fetchCommitDetail(sha: string) {
  const response = await fetch(`https://api.github.com/repos/iterativv/NostalgiaForInfinity/commits/${sha}`, {
    headers: githubHeaders(),
    next: { revalidate: 0 }
  });
  if (!response.ok) throw new Error(`GitHub commit ${sha} fetch failed: ${response.status}`);
  return (await response.json()) as GitHubCommitDetail;
}

export function extractPatch(detail: GitHubCommitDetail) {
  return (detail.files || [])
    .map((file) => `diff --git a/${file.filename} b/${file.filename}\n${file.patch || ""}`)
    .join("\n");
}

export function extractBlacklistSymbols(diff: string) {
  const symbols = new Set<string>();
  const lines = diff.split(/\r?\n/);
  let inBlacklistBlock = false;

  for (const line of lines) {
    if (line.startsWith("+++") || line.startsWith("---")) continue;
    const isAddition = line.startsWith("+");
    const isContext = line.startsWith(" ");
    if (!isAddition && !isContext) {
      inBlacklistBlock = false;
      continue;
    }

    const content = line.slice(1);
    const lower = content.toLowerCase();
    const startsBlacklistBlock = /black[_-]?list|badcoins/.test(lower) && /[\[({]/.test(content);
    const directBlacklistAddition = /black[_-]?list|badcoins/.test(lower) && /["'][A-Z]{2,10}["']/.test(content);
    if (startsBlacklistBlock) inBlacklistBlock = true;

    const quotedSymbols = [...content.matchAll(/["']([A-Z]{2,10})["']/g)].map((match) => match[1]);

    if (isAddition && (directBlacklistAddition || inBlacklistBlock)) {
      for (const symbol of quotedSymbols) symbols.add(symbol);
    }

    if (inBlacklistBlock && /[\])}]/.test(content)) inBlacklistBlock = false;
  }

  return [...symbols];
}
