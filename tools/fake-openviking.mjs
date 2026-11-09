/**
 * 假的 OpenViking 服务：只为生成**脱敏**的界面截图（不连真实实例、不含真实数据）。
 *
 * 用法：node tools/fake-openviking.mjs --port 19330
 * 然后让 DSH 用环境变量指过来：
 *   OPENVIKING_URL=http://127.0.0.1:19330  OPENVIKING_API_KEY=demo  dsh --profile web
 */

import { createServer } from 'node:http'

const port = Number(process.argv.includes('--port') ? process.argv[process.argv.indexOf('--port') + 1] : '19330')

const now = Date.now()
const iso = (offsetMinutes) => new Date(now - offsetMinutes * 60_000).toISOString()

const sessions = [
  { session_id: 'demo-session-a1b2c3', uri: 'viking://user/demo/sessions/a1b2c3', mod_time: iso(2) },
  { session_id: 'demo-session-d4e5f6', uri: 'viking://user/demo/sessions/d4e5f6', mod_time: iso(19) },
  { session_id: 'demo-session-g7h8i9', uri: 'viking://user/demo/sessions/g7h8i9', mod_time: iso(47) },
  { session_id: 'demo-session-j1k2l3', uri: 'viking://user/demo/sessions/j1k2l3', mod_time: iso(160) },
]

const queueTable = [
  '|   Queue   | Pending | In Progress | Processed | Requeued | Errors | Total |',
  '| --------- | ------- | ----------- | --------- | -------- | ------ | ----- |',
  '| TOTAL     | 0       | 1           | 214       | 0        | 0      | 215   |',
].join('\n')

const routes = {
  '/health': {
    healthy: true,
    status: 'healthy',
    version: 'v0.5.3',
    auth_mode: 'api_key',
  },
  '/ready': {
    status: 'ready',
    checks: {
      agfs: { status: 'ok', checks: {} },
      vectordb: 'ok',
      api_key_manager: 'ok',
      embedding: 'ok',
      ollama: 'ok',
    },
  },
  '/api/v1/stats/memories': {
    total_memories: 128,
    by_category: { entities: 52, events: 61, preferences: 15 },
    hotness_distribution: { hot: 8, warm: 96, cold: 24 },
    staleness: { fresh: 100, aging: 21, stale: 7 },
  },
  '/api/v1/sessions': sessions,
  '/api/v1/observer/queue': {
    is_healthy: true,
    has_errors: false,
    status: queueTable,
  },
}

const server = createServer((req, res) => {
  const path = (req.url ?? '/').split('?')[0]
  const body = routes[path]
  if (!body) {
    res.writeHead(404, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ error: 'not found' }))
    return
  }
  res.writeHead(200, { 'content-type': 'application/json', 'access-control-allow-origin': '*' })
  res.end(JSON.stringify(body))
})

server.listen(port, '127.0.0.1', () => {
  console.log(`假的 OpenViking 已启动：http://127.0.0.1:${port}（演示数据，无真实内容）`)
})
