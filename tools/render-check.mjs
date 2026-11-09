/**
 * 离线校验客户端 bundle：在 jsdom 里执行 `lib/client.js`，检查它是否按契约
 * 注册了 `settings.section`，并把页面渲染成 HTML 看看结构。
 *
 * 用法：node tools/render-check.mjs
 */

import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import { JSDOM } from 'jsdom'
import * as React from 'react'
import * as ReactDOMClient from 'react-dom/client'
import { act } from 'react-dom/test-utils'

const here = dirname(fileURLToPath(import.meta.url))
const bundlePath = join(here, '..', 'client.js')

const dom = new JSDOM('<!doctype html><html><head></head><body><div id="root"></div></body></html>', {
  pretendToBeVisual: true,
  url: 'http://127.0.0.1:54890/',
})

const { window } = dom
globalThis.window = window
globalThis.document = window.document
globalThis.HTMLElement = window.HTMLElement
globalThis.Node = window.Node
globalThis.IS_REACT_ACT_ENVIRONMENT = true

const jsxRuntime = await import('react/jsx-runtime')

/** 运行时基线模块的替身：真实组件由 DSH 外壳提供，这里只保留结构。 */
const primitives = {
  Button: (props) => React.createElement('button', { type: 'button', onClick: props.onClick, disabled: props.disabled }, props.children),
  Pill: (props) => React.createElement('span', { className: props.active ? 'pill active' : 'pill' }, props.children),
  SegmentedTabs: (props) =>
    React.createElement(
      'div',
      { role: 'tablist' },
      props.items.map((item) =>
        React.createElement('button', { key: item.value, type: 'button', onClick: () => props.onChange(item.value) }, item.label),
      ),
    ),
  StateDot: (props) => React.createElement('i', { 'data-state': props.state }),
  DisclosureRow: (props) =>
    React.createElement('details', { open: props.open === true }, React.createElement('summary', null, props.title), props.children),
  IconChevronDownOutlineRegular: () => React.createElement('svg', { 'data-icon': 'chevron' }),
}

const bundleRequire = (specifier) => {
  if (specifier === 'react') return React
  if (specifier === 'react/jsx-runtime') return jsxRuntime
  if (specifier === '@deepseek-ai/dsh-client-ui-primitives') return primitives
  throw new Error(`unexpected require: ${specifier}`)
}

let loaded = null
const loader = {
  load(entry) {
    loaded = { id: entry.id, exports: entry.factory(bundleRequire) }
  },
}
window.__ModuleLoader__ = loader

const code = await readFile(bundlePath, 'utf8')
vm.runInThisContext(code, { filename: bundlePath })

if (!loaded) throw new Error('bundle did not call window.__ModuleLoader__.load')
console.log('bundle id:', loaded.id)
console.log('exports:', Object.keys(loaded.exports).sort().join(', '))

/**
 * 一份**演示用**的状态快照（形状与宿主路由的真实返回一致）。
 * 这里刻意使用假地址、假会话与假密钥片段——自检脚本会进公开仓库，
 * 不能带上任何真实环境的信息。
 */
const sample = {
  url: 'http://127.0.0.1:1933',
  apiKeyMasked: 'demo…cret',
  apiKeyPresent: true,
  authMode: 'api_key',
  connected: true,
  version: 'v0.0.0-demo',
  healthStatus: 'ok',
  healthError: '',
  ready: { status: 'ready', checks: { agfs: { status: 'ok' }, vectordb: 'ok', embedding: 'ok', ollama: 'ok' } },
  readyError: '',
  memories: { total: 128, byCategory: { entities: 52, events: 61, preferences: 15 }, hotness: { warm: 128 }, staleness: {} },
  memoriesError: '',
  sessions: {
    total: 4,
    recentCount: 2,
    lastModified: '2026-01-01T00:00:00Z',
    recent: [{ sessionId: 'demo-session-0000', uri: 'viking://user/demo/sessions/0000', modified: '2026-01-01T00:00:00Z' }],
  },
  sessionsError: '',
  queue: { healthy: true, hasErrors: false, pending: 0, inProgress: 1, processed: 214, total: 215 },
  queueError: '',
  pendingLocal: 0,
  autoCapture: { enabled: true, source: 'default' },
  captureConfig: { commitTokenThreshold: 20000, captureMode: 'semantic' },
  checkedAt: '2026-01-01T00:00:00.000Z',
}

const dictionaries = new Map()
const registered = []
const ctx = {
  locale: {
    bind: (ns) => (key) => dictionaries.get(ns)?.zh?.[key] ?? key,
    register: (ns, dicts) => {
      dictionaries.set(ns, dicts)
      return () => {}
    },
    subscribe: () => () => {},
  },
  slots: {
    inject: (_name, register) => register(),
    register: (options, component) => {
      registered.push({ options, component })
      return () => {}
    },
  },
  connection: {
    rpc: {
      call: async () => ({ ok: true, value: sample }),
    },
  },
  effect: (fn) => fn(),
}

loaded.exports.apply(ctx)

const section = registered.find((entry) => entry.options.name === 'settings.section')
const icon = registered.find((entry) => entry.options.name === 'settings.section.icon')
console.log('registered slots:', registered.map((entry) => `${entry.options.name}#${entry.options.id ?? ''}`).join(', '))
if (!section) throw new Error('settings.section was not registered')
console.log('section options:', JSON.stringify({ id: section.options.id, order: section.options.order, locale: section.options.locale }))
console.log('section label:', section.options.label())
console.log('icon registered:', Boolean(icon), icon?.options?.id)

// 挂载页面，等一次异步取数后打印 HTML。
const container = window.document.getElementById('root')
const root = ReactDOMClient.createRoot(container)
await act(async () => {
  root.render(React.createElement(section.component, {}))
  await new Promise((resolve) => setTimeout(resolve, 300))
})
const html = container.innerHTML
console.log('--- rendered html (first 1200 chars) ---')
console.log(html.slice(0, 1200))
console.log('--- checks ---')
console.log('contains title:', html.includes('OpenViking'))
console.log('contains demo version:', html.includes('v0.0.0-demo'))
console.log('contains demo memory total 128:', html.includes('128'))
console.log('contains queue pending 0:', html.includes('Pending') || html.includes('待处理'))
console.log('style injected:', window.document.getElementById('openviking-settings-style') !== null)
