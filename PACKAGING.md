# 打包与发布

## 目录里有什么

| 路径 | 说明 |
| --- | --- |
| `index.js` | 宿主半（Host half）：解析连接配置、探测服务端、注册 `POST /api/openviking/status` |
| `client.js` | 浏览器半（Browser half）：由 `src/client.tsx` 打包而来，**不要手改** |
| `src/client.tsx` | 浏览器半源码 |
| `src/locales.ts`、`src/styles.ts` | 文案与样式 |
| `cordis.patch.yml` | 组合包补丁：插入宿主行 |
| `locale/en.json`、`locale/zh.json` | 市场/插件面板的展示元数据（`meta.title`、`meta.description`） |
| `icon.svg` | 图标 |
| `tools/` | 构建与自检脚本（不打进发布包） |

DSH 的插件加载有两条独立的链路，**两条都要声明**：

- 宿主半靠 `package.json` 的 `dsh.bundle.patch` → 插入一行 Loader 条目；
- 浏览器半靠 `package.json` 的 `dsh.client`（`platform: "web"`）＋ `exports["./client"]`，
  补丁里那一行的 `name` 必须与**安装后的包名**一致，浏览器半才会跟着这一行走。

## 构建

```sh
cd tools && npm install
node build-client.mjs      # src/client.tsx → ../client.js
node render-check.mjs      # jsdom 离线自检：插槽注册 + 页面渲染
```

`client.js` 是生成物，提交进仓库，方便别人直接 `dsh plugin add` 安装。

## 打 npm 包

```sh
npm pack
```

`package.json` 的 `files` 白名单只放运行时需要的文件：构建产物、宿主半、补丁、语言文件、
图标与两份 README。`src/`、`tools/`、`docs/` 不入包。

## 发布到 GitHub

```sh
git tag v0.1.0 && git push --tags
```

仓库需要打上 **`dsh-plugin`** 主题标签，才会出现在 <https://github.com/topics/dsh-plugin>
的插件列表里（仓库设置 → 右侧栏 Manage topics，或 `PATCH /repos/<owner>/<repo>` 传
`topics`）。同时建议在仓库描述里写清「需要先部署 OpenViking」。

## 进 DSH 插件市场索引

DSH 的插件市场读取一份 **格式 1** 的索引 JSON，由
`@deepseek-ai/dsh-plugin-market-index` 的 `parseMarketIndex` 校验。Git 源的条目形如：

```json
{
  "name": "@openviking/dsh-openviking-settings",
  "title": { "en": "OpenViking Status", "zh": "OpenViking 状态" },
  "description": { "en": "…requires a deployed OpenViking service…", "zh": "…需要先部署 OpenViking 服务…" },
  "metadata": { "category": "memory", "keywords": ["dsh", "dsh-plugin"], "labels": ["requires-openviking"], "sortKeys": {} },
  "versions": [
    {
      "version": "0.1.0",
      "publishTimestamp": 1760000000,
      "source": { "type": "git", "url": "https://github.com/TerebiSAMA/dsh-openviking-settings.git", "commit": "<40 位 commit SHA>" },
      "engines": {}
    }
  ]
}
```

索引里声明的分类与标签要在同一份索引的 `metadata.categories` / `metadata.labels` 里声明，
否则校验不通过。

官方生成器（`apps/plugin-market-generator`）可以从 npm 包名或 Git 仓库列表生成索引：

```sh
pnpm --filter @deepseek-ai/dsh-plugin-market-generator start \
  --input plugins.txt --output site/index.json --title "Example Market"
```

生成的 `index.json` 放到 HTTPS 可访问的位置，再在 DSH【插件 → 发现】里添加该 URL。
自定义索引也可以写进 profile：`~/.dsh/profiles/<profile>/cordis.patch.yml`

```yaml
- id: plugin-market
  name: '@deepseek-ai/dsh-plugin-market'
  config:
    indexes:
      - https://<your-host>/index.json
```

## 脱敏

发布前确认仓库里没有：

- 内网/本机地址（本仓库的截图用的是本地假 OpenViking 服务，只有 `127.0.0.1`）；
- API Key、Bearer Token、Cookie；
- 本机绝对路径与用户名。

`tools/scan-tarball.js` 会对打好的 `.tgz` 做一次关键词扫描。
