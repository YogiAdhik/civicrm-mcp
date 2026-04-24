import type { Config } from "../config.js";
import { buildApi4Url } from "./url.js";
import {
  isApi4Error,
  isDeleteAction,
  isWriteAction,
  type Api4Response,
  type Api4Success,
} from "./types.js";

export class CivicrmError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly errorCode?: number,
  ) {
    super(message);
    this.name = "CivicrmError";
  }
}

export class CivicrmClient {
  constructor(private readonly cfg: Config) {}

  async api4<T = unknown>(
    entity: string,
    action: string,
    params: Record<string, unknown> = {},
  ): Promise<Api4Success<T>> {
    this.assertActionAllowed(action);

    const url = buildApi4Url({
      baseUrl: this.cfg.baseUrl,
      cms: this.cfg.cms,
      entity,
      action,
    });

    const headers: Record<string, string> = {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Requested-With": "XMLHttpRequest",
      Accept: "application/json",
    };

    if (this.cfg.authMode === "authx") {
      headers.Authorization = `Bearer ${this.cfg.apiKey}`;
      if (this.cfg.siteKey) {
        headers["X-Civi-Key"] = this.cfg.siteKey;
      }
    }

    // APIv4 REST expects params as a form-urlencoded `params` field, not a raw
    // JSON body — despite what the docs snippet implies. Legacy mode additionally
    // carries the api_key / site_key as form fields.
    const bodyFields: Record<string, string> = {
      params: JSON.stringify(params),
    };
    if (this.cfg.authMode === "legacy") {
      bodyFields.api_key = this.cfg.apiKey;
      if (this.cfg.siteKey) bodyFields.key = this.cfg.siteKey;
    }
    const body = new URLSearchParams(bodyFields).toString();

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.cfg.timeoutMs);

    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers,
        body,
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof Error && err.name === "AbortError") {
        throw new CivicrmError(`Request timed out after ${this.cfg.timeoutMs}ms`);
      }
      throw new CivicrmError(
        `Network error calling ${entity}.${action}: ${(err as Error).message}`,
      );
    } finally {
      clearTimeout(timer);
    }

    if (res.status === 401 || res.status === 403) {
      throw new CivicrmError(
        `Authentication failed (HTTP ${res.status}). Verify CIVICRM_API_KEY, CIVICRM_SITE_KEY, and that the bot contact has "authenticate with api key" permission.`,
        res.status,
      );
    }

    if (res.status === 404) {
      throw new CivicrmError(
        `Endpoint not found (HTTP 404). Verify CIVICRM_BASE_URL and CIVICRM_CMS (${this.cfg.cms}). URL tried: ${url}`,
        404,
      );
    }

    const text = await res.text();
    let json: Api4Response<T>;
    try {
      json = JSON.parse(text) as Api4Response<T>;
    } catch {
      throw new CivicrmError(
        `Non-JSON response (HTTP ${res.status}). First 200 chars: ${text.slice(0, 200)}`,
        res.status,
      );
    }

    if (isApi4Error(json)) {
      throw new CivicrmError(json.error_message, res.status, json.error_code);
    }

    if (!res.ok) {
      throw new CivicrmError(`HTTP ${res.status} with no error body`, res.status);
    }

    return json;
  }

  private assertActionAllowed(action: string): void {
    if (isDeleteAction(action) && !this.cfg.allowDeletes) {
      throw new CivicrmError(
        `Refusing "${action}" — set CIVICRM_ALLOW_DELETES=true to enable destructive actions.`,
      );
    }
    if (isWriteAction(action) && !this.cfg.allowWrites) {
      throw new CivicrmError(
        `Refusing write action "${action}" — set CIVICRM_ALLOW_WRITES=true to enable writes.`,
      );
    }
  }
}
