/**
 * OpenViking 状态页，浏览器半。
 *
 * 本包在 DSH 的【设置】里注册一个导航项「OpenViking 状态」，页面内容全部来自
 * 宿主半的 `/api/openviking/status` 路由（OpenViking 的 API Key 不下发到渲染
 * 进程）。浏览器半只做三件事：注册 `settings.section`、拉数据、渲染。
 */

import * as React from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Button,
  DisclosureRow,
  IconChevronDownOutlineRegular,
  Pill,
  SegmentedTabs,
  StateDot,
} from '@deepseek-ai/dsh-client-ui-primitives'
import { de, en, es, fr, ja, pt, ru, zh } from './locales.ts'
import { PAGE_CSS } from './styles.ts'

/** 字典命名空间。 */
const NS = 'settings.openviking'

/** 需要的浏览器服务。 */
export const inject = ['slots', 'locale', 'connection']

/** 宿主状态路由（Connection 的 endpoint 不带前导斜杠）。 */
const STATUS_ENDPOINT = 'openviking/status'

type TabKey = 'overview' | 'capture' | 'memory' | 'components' | 'config'

type OvStatus = {
  url: string
  apiKeyMasked: string
  apiKeyPresent: boolean
  authMode: string
  connected: boolean
  version: string
  healthStatus: string
  healthError: string
  ready: null | { status?: string; checks?: Record<string, { status?: string; checks?: Record<string, string> } | string> }
  readyError: string
  memories: null | {
    total: number
    byCategory: Record<string, number>
    hotness: Record<string, number>
    staleness: Record<string, number>
  }
  memoriesError: string
  sessions: { total: number; recentCount: number; lastModified: string; recent: { sessionId: string; uri: string; modified: string }[] }
  sessionsError: string
  queue: { healthy: boolean; hasErrors: boolean; pending: number | null; inProgress: number | null; processed: number | null; total: number | null }
  queueError: string
  pendingLocal: number
  autoCapture: { enabled: boolean; source: string }
  captureConfig: { commitTokenThreshold: number; captureMode: string }
  checkedAt: string
}

/**
 * 挂载 OpenViking 状态页。
 * @param ctx - 浏览器插件上下文。
 */
export function apply(ctx: any): void {
  const t = ctx.locale.bind(NS)
  ctx.effect(
    () => ctx.locale.register(NS, { zh, en, ja, es, fr, de, ru, pt }),
    'openviking-settings: dictionaries',
  )

  ctx.effect(
    () =>
      ctx.slots.inject('settings.section', () =>
        ctx.slots.register(
          {
            name: 'settings.section',
            id: 'openviking',
            order: 60,
            label: () => t('nav'),
            locale: NS,
          },
          createSection(ctx, t),
        ),
      ),
    'openviking-settings: section',
  )

  ctx.effect(
    () =>
      ctx.slots.inject('settings.section.icon', () =>
        ctx.slots.register(
          {
            name: 'settings.section.icon',
            id: 'openviking',
            locale: NS,
          },
          OpenVikingIcon,
        ),
      ),
    'openviking-settings: section icon',
  )
}

/**
 * 设置面板里的 OpenViking 导航图标。
 * @param props - 图标尺寸与选中态。
 * @returns 图标元素。
 */
function OpenVikingIcon({ size = 16, active = false }: { size?: number; active?: boolean }): React.ReactNode {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3c3.6 0 6.5 2.5 6.5 5.6 0 1.7-.8 3.2-2 4.3v4.3a2 2 0 0 1-2 2h-5a2 2 0 0 1-2-2v-4.3a5.4 5.4 0 0 1-2-4.3C5.5 5.5 8.4 3 12 3Z"
        stroke={active ? 'currentColor' : 'var(--dsw-alias-label-secondary)'}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M12 8.2v6.4M9.6 10.4h4.8M9.6 13.2h4.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

/**
 * 构造页面组件（闭包持有宿主上下文与翻译函数）。
 * @param ctx - 浏览器插件上下文。
 * @param t - 字典翻译函数。
 * @returns 页面组件。
 */
function createSection(ctx: any, t: (key: string) => string) {
  return function OpenVikingSection(): React.ReactNode {
    const [status, setStatus] = useState<OvStatus | null>(null)
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const [tab, setTab] = useState<TabKey>('overview')
    const [localeRevision, setLocaleRevision] = useState(0)

    useEffect(() => {
      return ctx.locale.subscribe(() => setLocaleRevision((value) => value + 1))
    }, [ctx.locale])

    const refresh = useCallback(async () => {
      setLoading(true)
      try {
        const result = await ctx.connection.rpc.call('/api', STATUS_ENDPOINT, {})
        if (!result?.ok) {
          setError(String(result?.error?.message ?? 'unknown error'))
          setStatus(null)
        } else {
          setStatus(result.value as OvStatus)
          setError('')
        }
      } catch (cause: any) {
        setError(String(cause?.message ?? cause))
        setStatus(null)
      } finally {
        setLoading(false)
      }
    }, [ctx.connection])

    useEffect(() => {
      void refresh()
    }, [refresh])

    useStyle()

    const tabs = useMemo(
      () => [
        { value: 'overview' as const, label: t('overview'), id: 'ov-tab-overview', panelId: 'ov-panel-overview' },
        { value: 'capture' as const, label: t('autoCapture'), id: 'ov-tab-capture', panelId: 'ov-panel-capture' },
        { value: 'memory' as const, label: t('memoryTitle'), id: 'ov-tab-memory', panelId: 'ov-panel-memory' },
        { value: 'components' as const, label: t('componentsTitle'), id: 'ov-tab-components', panelId: 'ov-panel-components' },
        { value: 'config' as const, label: t('serverTab'), id: 'ov-tab-config', panelId: 'ov-panel-config' },
      ],
      [localeRevision, t],
    )

    return (
      <div className="ov-page" data-locale-revision={localeRevision}>
        <header className="ov-header">
          <div className="ov-headerText">
            <h2 className="ov-title">{t('title')}</h2>
            <p className="ov-subtitle">{t('subtitle')}</p>
          </div>
          <Button size="sm" onClick={() => void refresh()} disabled={loading}>
            {loading ? t('refreshing') : t('refresh')}
          </Button>
        </header>

        <SegmentedTabs items={tabs as any} value={tab} onChange={(value: TabKey) => setTab(value)} label={t('title')} />

        {error !== '' ? (
          <div className="ov-error" role="alert">
            <StateDot state="error" />
            <span>
              {t('failed')}: {error}
            </span>
            <Button size="sm" onClick={() => void refresh()}>
              {t('reload')}
            </Button>
          </div>
        ) : null}

        {status === null && error === '' ? <div className="ov-loading">{t('refreshing')}</div> : null}

        {status !== null ? (
          <>
            {tab === 'overview' ? <Overview status={status} t={t} /> : null}
            {tab === 'capture' ? <Capture status={status} t={t} /> : null}
            {tab === 'memory' ? <Memory status={status} t={t} /> : null}
            {tab === 'components' ? <Components status={status} t={t} /> : null}
            {tab === 'config' ? <ServerConfig status={status} t={t} /> : null}
          </>
        ) : null}
      </div>
    )
  }
}

/**
 * 读一个就绪检查的状态。`/ready` 里既有字符串，也有带子检查的对象。
 * @param check - 检查项。
 * @returns 状态字符串。
 */
function checkStatus(check: unknown): string {
  if (typeof check === 'string') return check
  const status = (check as { status?: string } | null)?.status
  return typeof status === 'string' ? status : ''
}

/**
 * 总览页。
 */
function Overview({ status, t }: { status: OvStatus; t: (key: string) => string }): React.ReactNode {
  const checks = status.ready?.checks ?? {}
  const readyCount = Object.values(checks).filter((check) => checkStatus(check) === 'ok').length
  return (
    <div className="ov-stack">
      <section className="ov-hero">
        <div className="ov-heroTop">
          <div className="ov-logo" aria-hidden="true">
            Ov
          </div>
          <div className="ov-heroText">
            <div className="ov-eyebrow">{t('eyebrow')}</div>
            <div className="ov-workspace">{t('workspace')}</div>
            <div className="ov-url">{status.url || t('empty')}</div>
          </div>
        </div>
        <div className="ov-badges">
          <Pill active={status.connected}>
            <StateDot state={status.connected ? 'done' : 'error'} size={8} />
            <span className="ov-badgeText">{status.connected ? t('connected') : t('disconnected')}</span>
          </Pill>
          <Pill>
            <span className="ov-badgeText">
              {t('version')} {status.version || t('empty')}
            </span>
          </Pill>
          <Pill>
            <span className="ov-badgeText">
              {t('lastRefresh')} {formatTime(status.checkedAt)}
            </span>
          </Pill>
        </div>
        <div className="ov-actions">
          {status.url !== '' ? (
            <a className="ov-linkButton" href={status.url} target="_blank" rel="noreferrer">
              {t('open')}
            </a>
          ) : null}
          <a className="ov-linkButton ov-linkButtonGhost" href="https://github.com/volcengine/OpenViking" target="_blank" rel="noreferrer">
            {t('official')}
          </a>
        </div>
      </section>

      <div className="ov-cards">
        <article className="ov-card">
          <div className="ov-cardTitle">{t('autoCapture')}</div>
          <div className="ov-cardValue">{status.autoCapture.enabled ? t('autoCaptureOn') : t('autoCaptureOff')}</div>
          <div className="ov-cardHint">{t('autoCaptureHint')}</div>
        </article>
        <article className="ov-card">
          <div className="ov-cardTitle">{t('componentsTitle')}</div>
          <div className="ov-cardValue">
            {readyCount}/{Object.keys(checks).length || 0} {t('componentReady')}
          </div>
          <div className="ov-cardHint">{status.connected ? t('queueHealthy') : (status.healthError || t('disconnected'))}</div>
        </article>
      </div>

      <div className="ov-stats">
        <Stat label={t('memoryTotal')} value={status.memories?.total ?? null} />
        <Stat label={t('sessionTotal')} value={status.sessions.total} />
        <Stat label={t('queuePending')} value={status.queue.pending} />
        <Stat label={t('queueInProgress')} value={status.queue.inProgress} />
      </div>
    </div>
  )
}

/**
 * 自动记忆页。
 */
function Capture({ status, t }: { status: OvStatus; t: (key: string) => string }): React.ReactNode {
  const sourceLabel =
    status.autoCapture.source === 'env'
      ? t('captureSourceEnv')
      : status.autoCapture.source === 'ovcli.conf'
        ? t('captureSourceFile')
        : t('captureSourceDefault')
  return (
    <div className="ov-stack">
      <div className="ov-cards">
        <article className="ov-card">
          <div className="ov-cardTitle">{t('autoCapture')}</div>
          <div className="ov-cardValue">
            <StateDot state={status.autoCapture.enabled ? 'done' : 'idle'} size={10} />
            <span>{status.autoCapture.enabled ? t('autoCaptureOn') : t('autoCaptureOff')}</span>
          </div>
          <div className="ov-cardHint">
            {t('captureSource')}: {sourceLabel}
          </div>
        </article>
        <article className="ov-card">
          <div className="ov-cardTitle">{t('commitThreshold')}</div>
          <div className="ov-cardValue">{status.captureConfig.commitTokenThreshold} tokens</div>
          <div className="ov-cardHint">{t('commitThresholdHint')}</div>
        </article>
      </div>
      <div className="ov-cards">
        <article className="ov-card">
          <div className="ov-cardTitle">{t('localPending')}</div>
          <div className="ov-cardValue">{status.pendingLocal}</div>
          <div className="ov-cardHint">{t('localPendingHint')}</div>
        </article>
        <article className="ov-card">
          <div className="ov-cardTitle">{t('captureMode')}</div>
          <div className="ov-cardValue">{status.captureConfig.captureMode}</div>
          <div className="ov-cardHint">
            {t('queuePending')}: {status.queue.pending ?? t('empty')} · {t('queueInProgress')}: {status.queue.inProgress ?? t('empty')}
          </div>
        </article>
      </div>
    </div>
  )
}

/**
 * 记忆与会话页。
 */
function Memory({ status, t }: { status: OvStatus; t: (key: string) => string }): React.ReactNode {
  const categories = Object.entries(status.memories?.byCategory ?? {}).filter(([, count]) => count > 0)
  return (
    <div className="ov-stack">
      <div className="ov-cards">
        <article className="ov-card">
          <div className="ov-cardTitle">{t('memoryTotal')}</div>
          <div className="ov-cardValue">{status.memories?.total ?? t('empty')}</div>
          <div className="ov-cardHint">{t('memoryVectorNote')}</div>
        </article>
        <article className="ov-card">
          <div className="ov-cardTitle">{t('sessionsTitle')}</div>
          <div className="ov-cardValue">{status.sessions.total}</div>
          <div className="ov-cardHint">
            {t('sessionRecent')}: {status.sessions.recentCount} · {t('sessionLast')}: {formatTime(status.sessions.lastModified)}
          </div>
        </article>
      </div>

      <section className="ov-panel">
        <h3 className="ov-panelTitle">{t('memoryByCategory')}</h3>
        {categories.length === 0 ? (
          <div className="ov-empty">{t('empty')}</div>
        ) : (
          <ul className="ov-list">
            {categories.map(([name, count]) => (
              <li key={name} className="ov-listItem">
                <span className="ov-listLabel">{name}</span>
                <span className="ov-listValue">{count}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="ov-panel">
        <h3 className="ov-panelTitle">{t('sessionsTitle')}</h3>
        {status.sessions.recent.length === 0 ? (
          <div className="ov-empty">{t('empty')}</div>
        ) : (
          <ul className="ov-list">
            {status.sessions.recent.map((session) => (
              <li key={session.sessionId} className="ov-listItem">
                <span className="ov-listLabel ov-ellipsis">{session.sessionId}</span>
                <span className="ov-listValue">{formatTime(session.modified)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

/**
 * 组件健康页。
 */
function Components({ status, t }: { status: OvStatus; t: (key: string) => string }): React.ReactNode {
  const checks = status.ready?.checks ?? {}
  const entries = Object.entries(checks)
  return (
    <div className="ov-stack">
      <section className="ov-panel">
        <h3 className="ov-panelTitle">{t('componentsTitle')}</h3>
        {entries.length === 0 ? (
          <div className="ov-empty">{status.readyError || t('empty')}</div>
        ) : (
          <ul className="ov-list">
            {entries.map(([name, check]) => (
              <li key={name} className="ov-listItem">
                <span className="ov-listLabel">
                  <StateDot state={checkStatus(check) === 'ok' ? 'done' : 'warning'} size={10} />
                  <span className="ov-listLabelText">{name}</span>
                </span>
                <span className="ov-listValue">
                  {checkStatus(check) === 'ok' ? t('componentReady') : t('componentNotReady')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="ov-panel">
        <h3 className="ov-panelTitle">{t('queueTitle')}</h3>
        <ul className="ov-list">
          <QueueRow label={t('queuePending')} value={status.queue.pending} />
          <QueueRow label={t('queueInProgress')} value={status.queue.inProgress} />
          <QueueRow label={t('queueProcessed')} value={status.queue.processed} />
          <QueueRow label={t('queueErrors')} value={status.queue.hasErrors ? 1 : 0} />
        </ul>
      </section>
    </div>
  )
}

/**
 * 服务端配置页。
 */
function ServerConfig({ status, t }: { status: OvStatus; t: (key: string) => string }): React.ReactNode {
  const [open, setOpen] = useState(false)
  return (
    <div className="ov-stack">
      <DisclosureRow
        icon={<IconChevronDownOutlineRegular />}
        title={t('serverConfig')}
        open={open}
        expandable
        onToggle={() => setOpen((value) => !value)}
      >
        <ul className="ov-list ov-listSpaced">
          <ConfigRow label={t('serverUrl')} value={status.url || t('empty')} />
          <ConfigRow label={t('serverApiKey')} value={status.apiKeyPresent ? status.apiKeyMasked : t('serverApiKeyMissing')} />
          <ConfigRow label={t('serverAuthMode')} value={status.authMode || t('empty')} />
          <ConfigRow label={t('serverVersion')} value={status.version || t('empty')} />
          <ConfigRow label={t('serverCheckedAt')} value={formatTime(status.checkedAt)} />
        </ul>
        <p className="ov-hint">{t('serverConfigHint')}</p>
      </DisclosureRow>
    </div>
  )
}

/**
 * 一个统计块。
 */
function Stat({ label, value }: { label: string; value: number | null }): React.ReactNode {
  return (
    <div className="ov-stat">
      <div className="ov-statValue">{value === null ? '—' : value}</div>
      <div className="ov-statLabel">{label}</div>
    </div>
  )
}

/**
 * 队列里的一行。
 */
function QueueRow({ label, value }: { label: string; value: number | null }): React.ReactNode {
  return (
    <li className="ov-listItem">
      <span className="ov-listLabel">{label}</span>
      <span className="ov-listValue">{value === null ? '—' : value}</span>
    </li>
  )
}

/**
 * 配置里的一行。
 */
function ConfigRow({ label, value }: { label: string; value: string }): React.ReactNode {
  return (
    <li className="ov-listItem">
      <span className="ov-listLabel">{label}</span>
      <span className="ov-listValue ov-ellipsis">{value}</span>
    </li>
  )
}

/**
 * 格式化时间戳。
 * @param value - ISO 时间串。
 * @returns 本地化时间；无法解析时返回空串占位。
 */
function formatTime(value: string): string {
  if (!value) return '—'
  const stamp = Date.parse(value)
  if (!Number.isFinite(stamp)) return value
  return new Date(stamp).toLocaleString()
}

/**
 * 注入页面样式（幂等）。
 */
function useStyle(): void {
  useEffect(() => {
    const id = 'openviking-settings-style'
    if (document.getElementById(id) !== null) return
    const style = document.createElement('style')
    style.id = id
    style.textContent = PAGE_CSS
    document.head.appendChild(style)
  }, [])
}
