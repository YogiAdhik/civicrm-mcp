# Getting a CiviCRM to point the MCP server at

This guide walks you from "no CiviCRM at all" to a running local install with an API key ready to plug into `civicrm-mcp`. Written for macOS on Apple Silicon but the DDEV steps work identically on Intel and Linux.

Total time: **~20 minutes**. Everything runs locally — no hosting required.

---

## Why Standalone (and not Drupal / WordPress)?

CiviCRM normally runs on top of Drupal, WordPress, Backdrop, or Joomla. Each is a full CMS you have to learn. **Standalone** (available since CiviCRM 5.65) strips away the CMS and runs CiviCRM on its own — which is exactly what you want when you're new and just trying to understand CiviCRM.

If you already know Drupal or WordPress, swap in one of the CMS quickstarts from [docs.ddev.com](https://docs.ddev.com/en/stable/users/quickstart/).

---

## Step 1 — Install a Docker provider

DDEV runs each site inside a Docker container. You need one Docker provider:

| Provider | Recommended when | How |
| --- | --- | --- |
| **OrbStack** | Apple Silicon Mac — fastest, lowest RAM | `brew install orbstack`, then launch OrbStack.app once |
| Docker Desktop | Cross-platform familiarity | [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop) |
| Colima | CLI-only, zero GUI | `brew install colima docker`, then `colima start` |

On an Apple-Silicon Mac, **OrbStack** is the path of least friction — native arm64, very low idle overhead.

## Step 2 — Install DDEV

```bash
brew install ddev/ddev/ddev
mkcert -install    # installs a local trust root for HTTPS; run once per machine
```

Verify:

```bash
ddev version
```

## Step 3 — Spin up CiviCRM Standalone

Create a project directory and run the official quickstart. You can paste this whole block:

```bash
mkdir -p ~/Developer/my-civicrm && cd ~/Developer/my-civicrm

ddev config --project-type=php --composer-root=core --upload-dirs=public/media
ddev start -y

ddev exec "curl -LsS https://download.civicrm.org/latest/civicrm-STABLE-standalone.tar.gz -o /tmp/civicrm-standalone.tar.gz"
ddev exec "tar --strip-components=1 -xzf /tmp/civicrm-standalone.tar.gz"
ddev composer require civicrm/cli-tools --no-scripts

ddev exec cv core:install \
    --cms-base-url='$DDEV_PRIMARY_URL' \
    --db=mysql://db:db@db/db \
    -m loadGenerated=1 \
    -m extras.adminUser=admin \
    -m extras.adminPass=admin \
    -m extras.adminEmail=admin@example.com

ddev launch
```

What this does:

- Creates a DDEV project at `~/Developer/my-civicrm`.
- Downloads the latest stable CiviCRM Standalone tarball.
- Installs `cv` (CiviCRM's CLI) inside the container.
- Runs `cv core:install` with **sample data** (`loadGenerated=1`) so you have contacts, contributions, and events to play with immediately.
- Opens your browser at the local URL — something like `https://my-civicrm.ddev.site`.

Login with `admin` / `admin`.

> **Note:** change the admin password before doing anything real. `admin/admin` is fine for a local sandbox, never for anything reachable from the internet.

## Step 4 — Generate an API key for the MCP bot

`civicrm-mcp` authenticates as a single CiviCRM contact. Best practice is a dedicated "bot" contact, but for first-run you can use the admin contact you already have.

1. In CiviCRM, go to **Contacts → Find Contacts**, search for `admin`.
2. Click the admin contact to open their summary page.
3. Click **More → API Key**.
4. Click **Generate**. Copy the resulting key — you'll paste it into `.env` next.

If you don't see the **API Key** option, make sure the AuthX extension is enabled:

1. **Administer → Extensions**.
2. Find **AuthX** in the list; click **Install** if it isn't already installed.

## Step 5 — Grab the site base URL

```bash
ddev describe | grep "Primary URL"
```

You'll see something like:

```
Primary URL:        https://my-civicrm.ddev.site
```

Copy that URL.

## Step 6 — Wire up civicrm-mcp

In your `civicrm-mcp` checkout, copy `.env.example` to `.env` and fill in:

```bash
CIVICRM_BASE_URL=https://my-civicrm.ddev.site
CIVICRM_CMS=standalone
CIVICRM_API_KEY=<the key you generated in Step 4>
CIVICRM_AUTH_MODE=authx
CIVICRM_ALLOW_WRITES=false       # leave off until you trust it
CIVICRM_ALLOW_DELETES=false
```

Note the `CIVICRM_CMS=standalone` — this is important; the URL builder uses it to pick the right endpoint path.

## Step 7 — Smoke test

Build, then ask Claude Desktop (or Claude Code) to run the `civicrm_system_info` tool. Expected output:

```
CiviCRM: 5.79.x
CMS: standalone
PHP: 8.3.x
MySQL: 8.x
Base URL: https://my-civicrm.ddev.site
Auth mode: authx
Writes: disabled
Deletes: disabled
Bot contact: #1 admin
```

Then try `civicrm_find_contacts` with `query: "smith"` — the sample data includes dozens of generated contacts so you'll get hits.

When that works, you can optionally flip `CIVICRM_ALLOW_WRITES=true` to enable `civicrm_create_contact`, `civicrm_log_activity`, etc.

---

## Daily workflow

```bash
cd ~/Developer/my-civicrm
ddev start      # boot the containers
# ... use CiviCRM ...
ddev stop       # shut down when done
ddev delete     # nuke the whole project (containers + DB)
```

DDEV keeps the database on disk between `start`/`stop`; only `delete` wipes it.

---

## Troubleshooting

**"Permission denied" on API calls**
- The contact behind the API key needs the **authenticate with api key** permission. In Standalone that maps to the **Administrator** role, which admin already has. For a real bot, grant it explicitly via **Administer → Users and Permissions → Permissions (Access Control)**.

**`civicrm_system_info` returns 404**
- `CIVICRM_CMS` is probably wrong. Standalone expects `standalone`, not `drupal`.

**`ddev start` fails with port conflicts**
- Another Docker app (or a previous DDEV session) is holding ports 80/443. `ddev poweroff` then `ddev start`.

**Apple Silicon + slow filesystem**
- OrbStack uses virtiofs by default and is fast. If on Docker Desktop, enable "Use VirtioFS for file sharing" in settings.

---

## Upgrading CiviCRM later

```bash
cd ~/Developer/my-civicrm
ddev exec "curl -LsS https://download.civicrm.org/latest/civicrm-STABLE-standalone.tar.gz -o /tmp/civicrm-standalone.tar.gz"
ddev exec "tar --strip-components=1 -xzf /tmp/civicrm-standalone.tar.gz"
ddev exec cv upgrade:db
```

---

## References

- [DDEV CMS quickstarts](https://docs.ddev.com/en/stable/users/quickstart/) — includes Standalone, Drupal, WordPress, Joomla.
- [CiviCRM Standalone installation guide](https://docs.civicrm.org/installation/en/latest/standalone/).
- [AuthX documentation](https://docs.civicrm.org/dev/en/latest/framework/authx/).
