# Security Policy

## Reporting a vulnerability

If you believe you have found a security issue in `civicrm-mcp`, please **do not open a public GitHub issue**. Instead, report it privately:

- Open a [private security advisory](https://github.com/YogiAdhik/civicrm-mcp/security/advisories/new) on GitHub, or
- Email the maintainer listed in `package.json` with "civicrm-mcp security" in the subject.

You can expect an acknowledgement within 72 hours and a first assessment within seven days. Fixes for confirmed high-severity issues will be shipped in a patch release; lower-severity issues may be batched into the next minor release.

## Threat model

This server is an **authenticated proxy** between an MCP client (such as Claude Desktop or Claude Code) and a CiviCRM install. Key properties in scope:

- The server should never write data unless the operator has explicitly opted in via `CIVICRM_ALLOW_WRITES=true`. Deletes require the separate `CIVICRM_ALLOW_DELETES=true`.
- Credentials (`CIVICRM_API_KEY`, `CIVICRM_SITE_KEY`) must only leave the server inside the `Authorization` / `X-Civi-Key` headers of outbound HTTPS calls. They must not appear in logs, tool results, or error text passed back to the model.
- Contact responses must strip `api_key` and `hash` fields before returning them.
- The server must not echo arbitrary HTML or script back to the client without it being readable as text content — MCP is a text/structured-content surface, not a web surface.

Out of scope:

- The security of the underlying CiviCRM install (permissions, CMS hardening, TLS configuration). Operators are responsible for their own site.
- The security of the MCP client. Clients should present tool calls for user review before execution.

## Supported versions

Only the most recent minor release receives security fixes. Given the `0.x` versioning, that window is short — upgrade promptly.

## Good practices for operators

- Create a dedicated "MCP Bot" CiviCRM contact with the minimum permissions needed.
- Keep `CIVICRM_ALLOW_WRITES` and `CIVICRM_ALLOW_DELETES` off unless you trust the calling client for the current session.
- Rotate API keys on any suspicion of leak.
- Put the server behind TLS in production deployments.
