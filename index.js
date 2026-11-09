/**
 * OpenViking 状态设置页，宿主半（Host half）。
 *
 * 浏览器半（`exports["./client"]`）在 DSH 的【设置】里注册一个 `settings.section`
 * 页面；它需要的运行数据全部由本半在宿主进程里采集后经一条本地 HTTP 路由交给
 * 页面——OpenViking 的 API Key 只留在宿主侧，不下发到渲染进程。
 *
 * 路由：`POST /api/openviking/status`，请求体是 Connection 的 client-request
 * 信封（`{type:"client-request", rpcId, method, payload}`），应答是 server-response
 * 信封（`{type:"server-response", rpcId, result:{ok, value}}`）。页面通过
 * `ctx.connection.rpc.call("/api", "openviking/status", {})` 调用它（Connection 的
 * endpoint 不带前导斜杠）。
 */

import { readFileSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

/** 宿主插件名（cordis entry name）。 */
export const name = 'openviking-settings'

/** 需要的宿主服务。 */
export const inject = ['webServer']

/** 页面数据路由。 */
const ROUTE_PATH = '/api/openviking/status'

/** 单个 OpenViking 端点的超时。 */
const REQUEST_TIMEOUT_MS = 5000

/**
 * 挂载状态路由。
 * @param ctx - 宿主 cordis 上下文。
 */
export function apply(ctx) {
  const dispose = ctx.webServer.register({
    kind: 'exact',
    path: ROUTE_PATH,
    handler: (req, res) => {
      void answer(req, res)
    },
  })
  ctx.effect(() => () => dispose(), 'openviking-settings: status route')
  ctx.logger?.info?.(`openviking-settings: ${ROUTE_PATH} registered`)
}

/**
 * 回答一次状态请求。
 * @param req - Node HTTP 请求。
 * @param res - Node HTTP 响应。
 */
async function answer(req, res) {
  const raw = await readBody(req)
  let rpcId = ''
  try {
    rpcId = String(JSON.parse(raw || '{}').rpcId ?? '')
  } catch {
    rpcId = ''
  }
  try {
    const value = await collectStatus()
    sendJson(res, 200, { type: 'server-response', rpcId, result: { ok: true, value } })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    sendJson(res, 200, {
      type: 'server-response',
      rpcId,
      result: { ok: false, error: { code: 'openviking-status-failed', message, details: {} } },
    })
  }
}

/**
 * 读取请求体。
 * @param req - Node HTTP 请求。
 * @returns 请求体文本。
 */
async function readBody(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  return Buffer.concat(chunks).toString('utf8')
}

/**
 * 写出一个 JSON 响应。
 * @param res - Node HTTP 响应。
 * @param status - HTTP 状态码。
 * @param payload - JSON 负载。
 */
function sendJson(res, status, payload) {
  const body = JSON.stringify(payload)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  res.end(body)
}

/**
 * 采集一次 OpenViking 状态。所有子项互相独立：任何一项失败只影响它自己。
 * @returns 状态快照。
 */
async function collectStatus() {
  const connection = await resolveConnection()
  const url = connection.url
  const [health, ready, memories, sessions, queue] = await Promise.all([
    probe(url, '/health', connection.apiKey),
    probe(url, '/ready', connection.apiKey),
    probe(url, '/api/v1/stats/memories', connection.apiKey),
    probe(url, '/api/v1/sessions', connection.apiKey),
    probe(url, '/api/v1/observer/queue', connection.apiKey),
  ])
  const pendingLocal = await countLocalPending()
  const memoryResult = memories.result ?? {}
  const sessionList = Array.isArray(sessions.result) ? sessions.result : []
  const now = Date.now()
  const recent = sessionList.filter((item) => {
    const stamp = Date.parse(String(item?.mod_time ?? ''))
    return Number.isFinite(stamp) && now - stamp < 60 * 60 * 1000
  })
  const lastModified = sessionList
    .map((item) => String(item?.mod_time ?? ''))
    .filter((value) => value !== '')
    .sort()
    .at(-1) ?? ''

  return {
    url,
    apiKeyMasked: maskKey(connection.apiKey),
    apiKeyPresent: Boolean(connection.apiKey),
    authMode: health.result?.auth_mode ?? '',
    connected: health.ok && health.result?.healthy === true,
    version: String(health.result?.version ?? ''),
    healthStatus: String(health.result?.status ?? ''),
    healthError: health.ok ? '' : health.message,
    ready: ready.result ?? null,
    readyError: ready.ok ? '' : ready.message,
    memories: memoryResult.total_memories === undefined ? null : {
      total: Number(memoryResult.total_memories ?? 0),
      byCategory: memoryResult.by_category ?? {},
      hotness: memoryResult.hotness_distribution ?? {},
      staleness: memoryResult.staleness ?? {},
    },
    memoriesError: memories.ok ? '' : memories.message,
    sessions: {
      total: sessionList.length,
      recentCount: recent.length,
      lastModified,
      recent: sessionList
        .slice()
        .sort((a, b) => String(b?.mod_time ?? '').localeCompare(String(a?.mod_time ?? '')))
        .slice(0, 6)
        .map((item) => ({
          sessionId: String(item?.session_id ?? ''),
          uri: String(item?.uri ?? ''),
          modified: String(item?.mod_time ?? ''),
        })),
    },
    sessionsError: sessions.ok ? '' : sessions.message,
    queue: parseQueue(queue.result),
    queueError: queue.ok ? '' : queue.message,
    pendingLocal,
    autoCapture: readAutoCapture(),
    captureConfig: readCaptureConfig(),
    checkedAt: new Date().toISOString(),
  }
}

/**
 * 探测一个 OpenViking 端点。
 * @param baseUrl - 服务地址。
 * @param path - 端点路径。
 * @param apiKey - API Key，可为空（/health 与 /ready 免鉴权）。
 * @returns `{ok, result, message}`。
 */
async function probe(baseUrl, path, apiKey) {
  if (!baseUrl) return { ok: false, result: null, message: 'OpenViking 地址未配置' }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const headers = { accept: 'application/json' }
    if (apiKey) headers.authorization = `Bearer ${apiKey}`
    const response = await fetch(`${baseUrl}${path}`, { headers, signal: controller.signal })
    const text = await response.text()
    let body = null
    try {
      body = text ? JSON.parse(text) : null
    } catch {
      body = null
    }
    if (!response.ok) {
      return { ok: false, result: null, message: `HTTP ${response.status}` }
    }
    return { ok: true, result: body?.result ?? body ?? null, message: '' }
  } catch (error) {
    const message = error?.name === 'AbortError' ? `请求超时（${REQUEST_TIMEOUT_MS}ms）` : String(error?.message ?? error)
    return { ok: false, result: null, message }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * 解析服务端队列状态表。
 * @param result - `/api/v1/observer/queue` 的 result。
 * @returns 队列摘要。
 */
function parseQueue(result) {
  const text = String(result?.status ?? '')
  const healthy = result?.is_healthy === true
  const hasErrors = result?.has_errors === true
  const empty = { healthy, hasErrors, pending: null, inProgress: null, processed: null, total: null }
  if (!text) return empty
  // 表格形如：`|   Queue   | Pending | In Progress | Processed | Requeued | Errors | Total |`
  // 表头给出列序，TOTAL 行给出合计；按表头取列，避免写死列号。
  const rows = text
    .split('\n')
    .map((line) => line.split('|').map((cell) => cell.trim()))
    .filter((cells) => cells.length > 2)
  const header = rows.find((cells) => cells.includes('Pending'))
  const total = rows.find((cells) => cells.includes('TOTAL'))
  if (!header || !total) return empty
  const column = (name) => {
    const index = header.indexOf(name)
    return index === -1 ? null : index
  }
  const number = (name) => {
    const index = column(name)
    if (index === null) return null
    const parsed = Number.parseInt(String(total[index] ?? ''), 10)
    return Number.isFinite(parsed) ? parsed : null
  }
  return {
    healthy,
    hasErrors,
    pending: number('Pending'),
    inProgress: number('In Progress'),
    processed: number('Processed'),
    total: number('Total'),
  }
}

/**
 * 统计本机待写回队列（写入失败时才会创建的目录）。
 * @returns 待处理文件数；目录不存在时为 0。
 */
async function countLocalPending() {
  try {
    const entries = await readdir(join(homedir(), '.openviking', 'pending'))
    return entries.filter((name) => name.endsWith('.json')).length
  } catch {
    return 0
  }
}

/**
 * 读取自动记忆开关的当前取值。
 * @returns `{enabled, source}`。
 */
function readAutoCapture() {
  const envValue = readBool(process.env.OPENVIKING_AUTO_CAPTURE)
  if (envValue !== undefined) return { enabled: envValue, source: 'env' }
  const file = readConfFile('ovcli.conf')
  const plugin = sectionOf(file, 'plugin')
  const dsh = sectionOf(plugin, 'dsh')
  for (const scope of [dsh, plugin]) {
    const value = readBool(scope?.autoCapture ?? scope?.syncTurns)
    if (value !== undefined) return { enabled: value, source: 'ovcli.conf' }
  }
  return { enabled: true, source: 'default' }
}

/**
 * 读取与捕获相关的阈值配置。
 * @returns 阈值摘要。
 */
function readCaptureConfig() {
  const file = readConfFile('ovcli.conf')
  const plugin = sectionOf(file, 'plugin')
  const dsh = sectionOf(plugin, 'dsh')
  const scope = { ...plugin, ...dsh }
  const number = (value) => {
    const parsed = Number.parseInt(String(value ?? ''), 10)
    return Number.isFinite(parsed) ? parsed : null
  }
  const envThreshold = number(process.env.OPENVIKING_COMMIT_TOKEN_THRESHOLD)
  return {
    commitTokenThreshold: envThreshold ?? number(scope.commitTokenThreshold) ?? 20000,
    captureMode: String(scope.captureMode ?? 'semantic'),
  }
}

/**
 * 读取 ~/.openviking 下的一个 JSON 配置文件。
 * @param name - 文件名。
 * @returns 解析后的对象；读不到时返回空对象。
 */
function readConfFile(name) {
  try {
    // 同步读取：宿主侧每几百毫秒才刷新一次面板，异步读取会让 collectStatus 变复杂。
    const text = readFileSync(join(homedir(), '.openviking', name), 'utf8')
    const parsed = JSON.parse(text)
    return typeof parsed === 'object' && parsed !== null ? parsed : {}
  } catch {
    return {}
  }
}

/**
 * 读取一个配置对象的子段。
 * @param value - 配置对象。
 * @param key - 段名。
 * @returns 子段对象；缺失时返回空对象。
 */
function sectionOf(value, key) {
  const section = value?.[key]
  return typeof section === 'object' && section !== null ? section : {}
}

/**
 * 解析布尔值。
 * @param value - 原始值。
 * @returns 布尔值；无法解析时返回 undefined。
 */
function readBool(value) {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value === 'boolean') return value
  const text = String(value).trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(text)) return true
  if (['0', 'false', 'no', 'off'].includes(text)) return false
  return undefined
}

/**
 * 解析 OpenViking 的连接配置：环境变量 → ovcli.conf → ov.conf。
 * @returns `{url, apiKey}`。
 */
async function resolveConnection() {
  const env = process.env
  const cliFile = readConfFile('ovcli.conf')
  const ovFile = readConfFile('ov.conf')
  const plugin = sectionOf(cliFile, 'plugin')
  const server = sectionOf(ovFile, 'server')
  const url = String(
    env.OPENVIKING_URL
    ?? env.OPENVIKING_BASE_URL
    ?? cliFile.url
    ?? plugin.url
    ?? server.url
    ?? '',
  ).replace(/\/+$/, '')
  const apiKey = String(
    env.OPENVIKING_API_KEY
    ?? env.OPENVIKING_BEARER_TOKEN
    ?? cliFile.api_key
    ?? plugin.apiKey
    ?? server.root_api_key
    ?? '',
  )
  return { url, apiKey }
}

/**
 * 掩码 API Key：只保留首尾少量字符。
 * @param key - 原始 Key。
 * @returns 掩码文本；空 Key 返回空串。
 */
function maskKey(key) {
  const text = String(key ?? '')
  if (!text) return ''
  if (text.length <= 8) return `${text.slice(0, 2)}****`
  return `${text.slice(0, 4)}…${text.slice(-4)}`
}
