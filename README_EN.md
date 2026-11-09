# OpenViking Status for DSH

Adds an **OpenViking status** page to the DeepSeek Harness (DSH) Settings dialog: connection state, service health, memory and session counts, the auto-capture switch, and a redacted server configuration.

中文说明见 [README.md](./README.md)

> ## ⚠️ Prerequisite: deploy OpenViking first
>
> **This plugin does not ship an OpenViking service.** It only surfaces the state of an
> OpenViking instance that is **already running and configured**.
>
> - No reachable OpenViking instance → the page shows “not connected” and the counters stay empty.
> - OpenViking running but not configured → same.
> - OpenViking running and configured → the page shows live data (version, memory count, session count, queue, component readiness).
>
> In other words: **deploy OpenViking first, then install this plugin** — otherwise there is nothing meaningful to show.

## Deploying OpenViking (the prerequisite)

1. Deploy an OpenViking service reachable from this machine (e.g. `http://<host>:<port>`).
2. Configure the connection. The same configuration is shared with the OpenViking memory
   plugin (`@openviking/dsh-memory-plugin`):

   | Priority | Source | Fields |
   | --- | --- | --- |
   | 1 | Environment | `OPENVIKING_URL` (or `OPENVIKING_BASE_URL`), `OPENVIKING_API_KEY` (or `OPENVIKING_BEARER_TOKEN`) |
   | 2 | `~/.openviking/ovcli.conf` | `url`, `api_key` |
   | 3 | `~/.openviking/ov.conf` | `server.url`, `server.root_api_key` |

3. The server must expose `/health` and `/ready`; the authenticated `/api/v1/*` endpoints
   provide memory, session and queue statistics.

## Install

**Option 1: plugin market (recommended)**

Search for “OpenViking Status” in DSH【插件 → 发现】and install it. If you run a custom
market index, add this repository's index URL there (see [PACKAGING.md](./PACKAGING.md)).

**Option 2: install straight from the repository**

```sh
dsh plugin --profile desktop add "git+https://github.com/TerebiSAMA/dsh-openviking-settings.git"
```

**Option 3: clone first**

```sh
git clone https://github.com/TerebiSAMA/dsh-openviking-settings.git
dsh plugin --profile desktop add "<clone path>"
```

After installing, **refresh the DSH window** (or restart the app); an “OpenViking” entry
appears in the Settings sidebar.

## Where the data comes from

| Panel item | Source | Notes |
| --- | --- | --- |
| Connected / version | `GET /health` | No auth required |
| Service readiness | `GET /ready` | agfs / vectordb / api_key_manager / embedding / ollama |
| Memory items | `GET /api/v1/stats/memories` | Memory-store count, not the vector count |
| Sessions | `GET /api/v1/sessions` | Total, changed within the last hour, last modification time |
| Queue | `GET /api/v1/observer/queue` | Pending / In Progress / Processed |
| Local write-back backlog | `~/.openviking/pending/*.json` | Entries left over from failed writes |
| Auto-capture switch | `OPENVIKING_AUTO_CAPTURE` → `plugin` section of `ovcli.conf` → default on | Same keys as the memory plugin |

Server memory usage has no public endpoint, so the page does not show it.

## Privacy

- The OpenViking API key is used **only inside the host process**; the page receives a
  masked string (first and last four characters).
- The page never reads session contents and never forwards memory content to the renderer;
  it only reads aggregate counters and health state.
- Every request is made by the host process; the browser side only talks to a local DSH route.

## Layout

```
index.js            Host half: config resolution, probing, POST /api/openviking/status route
client.js           Browser half (built artifact of src/client.tsx)
src/                Browser half sources
locale/             Localized display metadata
cordis.patch.yml    Bundle patch: inserts the host row
icon.svg            Icon
tools/              Build and self-check scripts (not installed)
```

## Development

```sh
cd tools && npm install
node build-client.mjs      # rebuild the browser half → client.js
node render-check.mjs      # offline jsdom self-check: slot registration + page render
```

## License

MIT
