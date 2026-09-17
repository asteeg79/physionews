/**
 * Schreibzugriff auf das eigene GitHub-Repository.
 *
 * Hintergrund: Die App läuft auf Vercel, wo das Dateisystem read-only ist.
 * Die Datendateien in `data/` liegen deshalb im Repo. Alles, was der
 * Nutzer in der App ändert (Einstellungen, Quellen, Push-Anmeldung),
 * wird über die GitHub-Contents-API committet. Der Push auf `main` löst
 * einen Vercel-Deploy aus, wodurch die neue Fassung ~1 Minute später live ist.
 *
 * Die regelmäßige Datenpflege (Abruf, Klassifizierung, Aufräumen) läuft
 * dagegen komplett in GitHub Actions und schreibt direkt per `fs` —
 * siehe scripts/pipeline/.
 *
 * Benötigte Umgebungsvariablen auf Vercel:
 *   GITHUB_TOKEN   Fine-grained PAT mit "Contents: read and write"
 *                  (für den Refresh-Button zusätzlich "Actions: write")
 *   GITHUB_REPO    "owner/repo", z. B. "asteeg79/physionews"
 *   GITHUB_BRANCH  optional, Default "main"
 */

const API = 'https://api.github.com';

export class GitHubNotConfiguredError extends Error {
  constructor() {
    super(
      'GitHub-Schreibzugriff ist nicht konfiguriert — GITHUB_TOKEN und GITHUB_REPO fehlen.'
    );
    this.name = 'GitHubNotConfiguredError';
  }
}

interface GitHubConfig {
  token: string;
  repo: string;
  branch: string;
}

/** Liefert die Konfiguration oder `null`, wenn kein Token hinterlegt ist. */
export function gitHubConfig(): GitHubConfig | null {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;
  if (!token || !repo) return null;
  return { token, repo, branch: process.env.GITHUB_BRANCH ?? 'main' };
}

function headers(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  };
}

/**
 * Liest eine Datei aus dem Repo.
 *
 * @returns Inhalt und Blob-SHA, oder `null` wenn die Datei nicht existiert.
 */
async function getFile(
  cfg: GitHubConfig,
  filePath: string
): Promise<{ content: string; sha: string } | null> {
  const url = `${API}/repos/${cfg.repo}/contents/${filePath}?ref=${encodeURIComponent(cfg.branch)}`;
  const res = await fetch(url, {
    headers: headers(cfg.token),
    cache: 'no-store',
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`GitHub GET ${filePath} → HTTP ${res.status} ${await res.text()}`);
  }
  const body = (await res.json()) as { content: string; encoding: string; sha: string };
  const content =
    body.encoding === 'base64'
      ? Buffer.from(body.content, 'base64').toString('utf-8')
      : body.content;
  return { content, sha: body.sha };
}

/**
 * Committet eine Datei ins Repo (anlegen oder überschreiben).
 *
 * Bei einem 409 (jemand anderes — in der Regel der Actions-Lauf — hat die
 * Datei zwischenzeitlich geändert) wird der SHA einmal neu geholt und der
 * Commit wiederholt. Das ist bewusst „last write wins": die Dateien, die
 * von hier aus geschrieben werden, ändert der Cron-Lauf höchstens am Rand
 * (Abruf-Status der Quellen).
 */
export async function putRepoFile(
  filePath: string,
  content: string,
  message: string
): Promise<void> {
  const cfg = gitHubConfig();
  if (!cfg) throw new GitHubNotConfiguredError();

  for (let attempt = 1; attempt <= 2; attempt++) {
    const existing = await getFile(cfg, filePath);
    const res = await fetch(`${API}/repos/${cfg.repo}/contents/${filePath}`, {
      method: 'PUT',
      headers: headers(cfg.token),
      body: JSON.stringify({
        message,
        content: Buffer.from(content, 'utf-8').toString('base64'),
        branch: cfg.branch,
        ...(existing ? { sha: existing.sha } : {}),
      }),
    });
    if (res.ok) return;
    if (res.status === 409 && attempt === 1) continue;
    throw new Error(`GitHub PUT ${filePath} → HTTP ${res.status} ${await res.text()}`);
  }
}

/**
 * Stößt einen Workflow-Lauf an (`workflow_dispatch`).
 * Wird vom Refresh-Button bzw. Refresh-on-Open benutzt.
 *
 * @returns true, wenn GitHub den Lauf angenommen hat.
 */
export async function dispatchWorkflow(workflowFile: string): Promise<boolean> {
  const cfg = gitHubConfig();
  if (!cfg) throw new GitHubNotConfiguredError();

  const res = await fetch(
    `${API}/repos/${cfg.repo}/actions/workflows/${workflowFile}/dispatches`,
    {
      method: 'POST',
      headers: headers(cfg.token),
      body: JSON.stringify({ ref: cfg.branch }),
    }
  );
  if (res.status === 204) return true;
  throw new Error(`GitHub dispatch ${workflowFile} → HTTP ${res.status} ${await res.text()}`);
}
