/**
 * 页面样式。手写 bundle 不经过 CSS Modules 构建，因此这里是一段普通 CSS 文本，
 * 由页面组件在挂载时注入一次（幂等）。
 *
 * 取色沿用 DSH 的设计令牌（`--dsw-alias-*`），跟随应用主题自动切换。
 */

/** 页面样式表。 */
export const PAGE_CSS = `
.ov-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  padding: 4px 2px 24px;
  color: var(--dsw-alias-label-primary);
  font-size: 13px;
  line-height: 1.5;
}

.ov-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.ov-headerText {
  min-width: 0;
}

.ov-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  line-height: 28px;
  color: var(--dsw-alias-label-primary);
}

.ov-subtitle {
  margin: 4px 0 0;
  font-size: 13px;
  line-height: 20px;
  color: var(--dsw-alias-label-secondary);
}

.ov-stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ov-hero {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px;
  border: 0.5px solid var(--dsw-alias-border-l4);
  border-radius: var(--dsw-radius-md, 12px);
  background:
    radial-gradient(120% 140% at 100% 0%, rgba(80, 200, 120, 0.12), transparent 60%),
    var(--dsw-alias-bg-layer-2);
}

.ov-heroTop {
  display: flex;
  align-items: center;
  gap: 14px;
}

.ov-logo {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  flex: none;
  border-radius: 12px;
  background: var(--dsw-alias-fill-l1);
  color: var(--dsw-alias-label-primary);
  font-size: 18px;
  font-weight: 600;
  letter-spacing: 0.5px;
}

.ov-heroText {
  min-width: 0;
}

.ov-eyebrow {
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.08em;
  color: var(--dsw-alias-label-tertiary);
}

.ov-workspace {
  margin-top: 2px;
  font-size: 16px;
  font-weight: 600;
  line-height: 22px;
  color: var(--dsw-alias-label-primary);
}

.ov-url {
  margin-top: 2px;
  font-size: 12px;
  color: var(--dsw-alias-label-secondary);
  word-break: break-all;
}

.ov-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.ov-badgeText {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-left: 4px;
}

.ov-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.ov-linkButton {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 32px;
  padding: 0 16px;
  border-radius: var(--dsw-radius-sm, 8px);
  background: var(--dsw-alias-button-primary-fill);
  color: var(--dsw-alias-label-primary-foreground);
  font-size: 13px;
  text-decoration: none;
}

.ov-linkButtonGhost {
  background: transparent;
  border: 0.5px solid var(--dsw-alias-border-l4);
  color: var(--dsw-alias-label-primary);
}

.ov-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
}

.ov-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 14px;
  border: 0.5px solid var(--dsw-alias-border-l4);
  border-radius: var(--dsw-radius-md, 12px);
  background: var(--dsw-alias-bg-layer-2);
}

.ov-cardTitle {
  font-size: 12px;
  color: var(--dsw-alias-label-tertiary);
}

.ov-cardValue {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 18px;
  font-weight: 600;
  line-height: 26px;
  color: var(--dsw-alias-label-primary);
}

.ov-cardHint {
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-secondary);
}

.ov-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 12px;
}

.ov-stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 12px;
  border: 0.5px solid var(--dsw-alias-border-l4);
  border-radius: var(--dsw-radius-md, 12px);
  background: var(--dsw-alias-bg-layer-2);
}

.ov-statValue {
  font-size: 20px;
  font-weight: 600;
  line-height: 28px;
  color: var(--dsw-alias-label-primary);
}

.ov-statLabel {
  font-size: 12px;
  color: var(--dsw-alias-label-tertiary);
}

.ov-panel {
  padding: 14px;
  border: 0.5px solid var(--dsw-alias-border-l4);
  border-radius: var(--dsw-radius-md, 12px);
  background: var(--dsw-alias-bg-layer-2);
}

.ov-panelTitle {
  margin: 0 0 8px;
  font-size: 13px;
  font-weight: 500;
  color: var(--dsw-alias-label-primary);
}

.ov-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.ov-listSpaced {
  gap: 8px;
  margin-top: 8px;
}

.ov-listItem {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
  padding: 6px 0;
  border-bottom: 0.5px solid var(--dsw-alias-border-l2);
  font-size: 13px;
}

.ov-listItem:last-child {
  border-bottom: none;
}

.ov-listLabel {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  color: var(--dsw-alias-label-primary);
}

.ov-listLabelText {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ov-listValue {
  flex: none;
  color: var(--dsw-alias-label-secondary);
  font-variant-numeric: tabular-nums;
}

.ov-ellipsis {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ov-empty,
.ov-loading {
  padding: 8px 0;
  font-size: 13px;
  color: var(--dsw-alias-label-tertiary);
}

.ov-error {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border: 0.5px solid var(--dsw-alias-state-error-primary);
  border-radius: var(--dsw-radius-md, 12px);
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-primary);
}

.ov-hint {
  margin: 8px 0 0;
  font-size: 12px;
  color: var(--dsw-alias-label-tertiary);
}
`
