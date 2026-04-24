# civicrm-mcp

A [Model Context Protocol](https://modelcontextprotocol.io) server for [CiviCRM](https://civicrm.org). Lets Claude Desktop, Claude Code, and other MCP-compatible clients talk to a CiviCRM install through its APIv4.

**Status:** v0.1 — stdio transport, three tools, AuthX-first auth.

## Requirements

- Node.js 18.17 or later
- CiviCRM 5.47 or later (tested against 5.59+)
- A CiviCRM install on Drupal, WordPress, Backdrop, or Standalone

## Install

```bash
npm install
npm run build
```

## Don't have a CiviCRM yet?

See [`docs/INSTALL_CIVICRM.md`](docs/INSTALL_CIVICRM.md) for a 20-minute guide to running CiviCRM Standalone locally via DDEV.

## Configure

Generate an API key for a dedicated "MCP Bot" contact:

1. Create a CMS user + CiviCRM contact just for this integration.
2. Grant it the CiviCRM permissions you want exposed (`access CiviCRM`, `view all contacts`, optionally `edit all contacts`, `authenticate with api key`).
3. On that contact's summary page → *More* → *API Key*, generate a random 20+ character key.

Copy `.env.example` to `.env` and fill in:

```bash
CIVICRM_BASE_URL=https://crm.example.org
CIVICRM_CMS=drupal            # or wordpress | standalone | backdrop
CIVICRM_API_KEY=...
CIVICRM_SITE_KEY=...          # only if the site-key guard is enabled
CIVICRM_AUTH_MODE=authx       # or legacy for pre-AuthX sites
CIVICRM_ALLOW_WRITES=false    # writes off by default
CIVICRM_ALLOW_DELETES=false   # deletes off by default
```

## Use with Claude Desktop / Code

Add to your MCP config (`~/Library/Application Support/Claude/claude_desktop_config.json` or the equivalent for Claude Code):

```json
{
  "mcpServers": {
    "civicrm": {
      "command": "node",
      "args": ["/absolute/path/to/civicrm-mcp/dist/index.js"],
      "env": {
        "CIVICRM_BASE_URL": "https://crm.example.org",
        "CIVICRM_CMS": "drupal",
        "CIVICRM_API_KEY": "…",
        "CIVICRM_ALLOW_WRITES": "false"
      }
    }
  }
}
```

## Tools

**Diagnostics**
| Tool | What it does |
| --- | --- |
| `civicrm_system_info` | Connectivity / version sanity check; resolves the authenticated bot contact. |

**Read**
| Tool | What it does |
| --- | --- |
| `civicrm_find_contacts` | Search contacts by name or primary email. |
| `civicrm_get_contact` | Fetch one contact by id, with sensible default fields. |
| `civicrm_get_relationships` | List a contact's relationships with direction resolved. |
| `civicrm_get_contributions` | List contributions with filters (donor, date window, status, type) and running sum. |
| `civicrm_list_events` | List events (defaults to upcoming only). |

**Introspection**
| Tool | What it does |
| --- | --- |
| `civicrm_list_entities` | List every APIv4 entity available on the install (incl. extensions). |
| `civicrm_describe_entity` | Return fields + actions for an entity. Call this before `civicrm_api4` if unsure. |

**Write (require `CIVICRM_ALLOW_WRITES=true`)**
| Tool | What it does |
| --- | --- |
| `civicrm_create_contact` | Create a contact; chains email/phone creation. |
| `civicrm_update_contact` | Update fields on an existing contact by id. |
| `civicrm_log_activity` | Record an Activity (Phone Call, Meeting, Email, custom types). |
| `civicrm_record_contribution` | Record a donation / contribution. |
| `civicrm_add_to_group` | Add a contact to a group (idempotent). |
| `civicrm_remove_from_group` | Mark a contact as Removed from a group (preserves history). |
| `civicrm_register_for_event` | Register a contact for an event (Participant.create). |
| `civicrm_create_membership` | Create a Membership record; CiviCRM auto-calculates dates from the type. |

**Escape hatch**
| Tool | What it does |
| --- | --- |
| `civicrm_api4` | Generic APIv4 passthrough — any entity, any action. Gated by env flags. |

## Safety

- Writes (`create`, `update`, `save`, `submit`) are refused unless `CIVICRM_ALLOW_WRITES=true`.
- Deletes (`delete`, `replace`) are refused unless `CIVICRM_ALLOW_DELETES=true`.
- `api_key` and `hash` fields are stripped from contact responses.
- stdout is reserved for the MCP protocol; logs go to stderr.

## Licence

MIT
