import { z } from "zod";

const CmsSchema = z.enum(["drupal", "wordpress", "standalone", "backdrop"]);
const AuthModeSchema = z.enum(["authx", "legacy"]);

const EnvSchema = z.object({
  CIVICRM_BASE_URL: z.string().url(),
  CIVICRM_CMS: CmsSchema.default("drupal"),
  CIVICRM_API_KEY: z.string().min(1),
  CIVICRM_SITE_KEY: z.string().optional(),
  CIVICRM_AUTH_MODE: AuthModeSchema.default("authx"),
  CIVICRM_ALLOW_WRITES: z
    .string()
    .optional()
    .transform((v) => v === "true" || v === "1"),
  CIVICRM_ALLOW_DELETES: z
    .string()
    .optional()
    .transform((v) => v === "true" || v === "1"),
  CIVICRM_TIMEOUT_MS: z
    .string()
    .optional()
    .transform((v) => (v ? Number.parseInt(v, 10) : 30_000)),
});

export type Cms = z.infer<typeof CmsSchema>;
export type AuthMode = z.infer<typeof AuthModeSchema>;

export interface Config {
  baseUrl: string;
  cms: Cms;
  apiKey: string;
  siteKey: string | undefined;
  authMode: AuthMode;
  allowWrites: boolean;
  allowDeletes: boolean;
  timeoutMs: number;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("\n  ");
    throw new Error(`Invalid CiviCRM MCP config:\n  ${issues}`);
  }
  const e = parsed.data;
  return {
    baseUrl: e.CIVICRM_BASE_URL.replace(/\/+$/, ""),
    cms: e.CIVICRM_CMS,
    apiKey: e.CIVICRM_API_KEY,
    siteKey: e.CIVICRM_SITE_KEY,
    authMode: e.CIVICRM_AUTH_MODE,
    allowWrites: e.CIVICRM_ALLOW_WRITES ?? false,
    allowDeletes: e.CIVICRM_ALLOW_DELETES ?? false,
    timeoutMs: e.CIVICRM_TIMEOUT_MS,
  };
}
