import { createServer, type IncomingMessage, type ServerResponse, type Server } from "node:http";
import { AddressInfo } from "node:net";

export interface MockCall {
  entity: string;
  action: string;
  params: Record<string, unknown>;
  headers: Record<string, string | string[] | undefined>;
}

export interface MockHandler {
  (call: MockCall): { status?: number; body: unknown };
}

export interface MockCivicrm {
  url: string;
  calls: MockCall[];
  close: () => Promise<void>;
}

export async function startMockCivicrm(handler: MockHandler): Promise<MockCivicrm> {
  const calls: MockCall[] = [];

  const server: Server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = req.url ?? "";
    const m = url.match(/\/civicrm\/ajax\/api4\/([^/?]+)\/([^/?]+)/);
    if (!m) {
      res.statusCode = 404;
      res.end(JSON.stringify({ error_message: "not an api4 URL" }));
      return;
    }
    const entity = decodeURIComponent(m[1]!);
    const action = decodeURIComponent(m[2]!);

    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const body = Buffer.concat(chunks).toString("utf8");

    let params: Record<string, unknown> = {};
    const contentType = (req.headers["content-type"] as string | undefined) ?? "";
    try {
      if (!body) {
        params = {};
      } else if (contentType.includes("application/x-www-form-urlencoded")) {
        const form = new URLSearchParams(body);
        const p = form.get("params");
        params = p ? (JSON.parse(p) as Record<string, unknown>) : {};
      } else {
        params = JSON.parse(body) as Record<string, unknown>;
      }
    } catch {
      params = { _raw: body };
    }

    const call: MockCall = { entity, action, params, headers: { ...req.headers } };
    calls.push(call);

    const out = handler(call);
    res.statusCode = out.status ?? 200;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(out.body));
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address() as AddressInfo;
  const url = `http://127.0.0.1:${addr.port}`;

  return {
    url,
    calls,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      ),
  };
}

export function api4Success<T = unknown>(values: T[]): { body: unknown } {
  return { body: { version: 4, count: values.length, countMatched: values.length, values } };
}

export function api4Error(message: string, code = 1, status = 200): { body: unknown; status: number } {
  return { status, body: { error_code: code, error_message: message } };
}
