export const APIFY_API_URL = "https://api.apify.com/v2";

/** Apify's run states: still working, or finished well or badly. */
export type RunStatus = "READY" | "RUNNING" | "SUCCEEDED" | "FAILED" | "ABORTING" | "ABORTED" | "TIMING-OUT" | "TIMED-OUT";

export type ApifyClient = {
  /** Starts a scraper ("actor") and returns at once (results are read later). */
  startRun(actor: string, input: object): Promise<{ runId: string; datasetId: string }>;
  getRun(runId: string): Promise<{ status: RunStatus; datasetId: string }>;
  getItems(datasetId: string): Promise<unknown[]>;
  /** Spent this month, in dollars (the free plan gives 5 $). */
  monthlyUsageUsd(): Promise<number>;
};

export class ApifyError extends Error {}

/** Apify through its HTTP API (APIFY_TOKEN). */
export function createApifyClient({ token, baseUrl = APIFY_API_URL }: { token: string; baseUrl?: string }): ApifyClient {
  if (!token) throw new ApifyError("Jeton Apify manquant (réglage APIFY_TOKEN).");

  async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${baseUrl}${path}`, {
        ...init,
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...init.headers },
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      throw new ApifyError("Apify injoignable.");
    }
    if (response.status === 401 || response.status === 403) throw new ApifyError("Jeton Apify refusé (vérifiez APIFY_TOKEN).");
    if (response.status === 402) throw new ApifyError("Crédit gratuit Apify épuisé pour ce mois.");
    if (!response.ok) throw new ApifyError(`Apify a répondu ${response.status}.`);
    return (await response.json()) as T;
  }

  return {
    async startRun(actor, input) {
      const { data } = await call<{ data: { id: string; defaultDatasetId: string } }>(
        `/acts/${actor.replace("/", "~")}/runs`,
        { method: "POST", body: JSON.stringify(input) },
      );
      return { runId: data.id, datasetId: data.defaultDatasetId };
    },
    async getRun(runId) {
      const { data } = await call<{ data: { status: RunStatus; defaultDatasetId: string } }>(`/actor-runs/${runId}`);
      return { status: data.status, datasetId: data.defaultDatasetId };
    },
    async getItems(datasetId) {
      return call<unknown[]>(`/datasets/${datasetId}/items?clean=true&format=json`);
    },
    async monthlyUsageUsd() {
      const { data } = await call<{ data: { current?: { monthlyUsageUsd?: number } } }>("/users/me/limits");
      return data.current?.monthlyUsageUsd ?? 0;
    },
  };
}

export const isFinished = (status: RunStatus) => !["READY", "RUNNING", "ABORTING", "TIMING-OUT"].includes(status);
