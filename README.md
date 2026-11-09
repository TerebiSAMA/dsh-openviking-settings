# OpenViking Status for DSH

在 DeepSeek Harness（DSH）的【设置】里增加一个 **OpenViking 状态** 页面：连接状态、服务健康、记忆与会话计数、自动记忆开关，以及脱敏后的服务端配置。

English: [README_EN.md](./README_EN.md)

> ## ⚠️ 前置条件：必须先部署 OpenViking 服务
>
> **本插件不包含 OpenViking 服务本身**，它只负责把一个**已经运行并配置好**的 OpenViking
> 实例的状态呈现在 DSH 设置界面里。
>
> - 没有可访问的 OpenViking 实例 → 页面显示「未连接」，其余指标为空；
> - OpenViking 已运行但没配连接信息 → 同样显示「未连接」；
> - OpenViking 已运行且连接信息正确 → 页面显示实时数据（版本、记忆条数、会话数、队列、组件就绪情况）。
>
> 也就是说：**先部署好 OpenViking，再安装本插件**，才看得到有意义的内容。

## 部署 OpenViking（前置条件）

1. 部署 OpenViking 服务，确保当前机能访问它（例如 `http://<host>:<port>`）。
2. 配置连接信息（与 OpenViking 记忆插件 `@openviking/dsh-memory-plugin` 共用同一份配置）：

   | 优先级 | 来源 | 字段 |
   | --- | --- | --- |
   | 1 | 环境变量 | `OPENVIKING_URL`（或 `OPENVIKING_BASE_URL`）、`OPENVIKING_API_KEY`（或 `OPENVIKING_BEARER_TOKEN`） |
   | 2 | `~/.openviking/ovcli.conf` | `url`、`api_key` |
   | 3 | `~/.openviking/ov.conf` | `server.url`、`server.root_api_key` |

3. 服务端需要可访问 `/health` 与 `/ready`；带鉴权的 `/api/v1/*` 用于记忆、会话与队列统计。

## 安装

**方式一：插件市场（推荐）**

在 DSH 的【插件 → 发现】里搜索「OpenViking 状态」并安装；若用的是自定义市场索引，
把本仓库的索引地址加进【发现】即可（见 [PACKAGING.md](./PACKAGING.md)）。

**方式二：直接从仓库安装**

```sh
dsh plugin --profile desktop add "git+https://github.com/TerebiSAMA/dsh-openviking-settings.git"
```

**方式三：先 clone 再装**

```sh
git clone https://github.com/TerebiSAMA/dsh-openviking-settings.git
dsh plugin --profile desktop add "<clone 路径>"
```

装好后 **刷新一下 DSH 窗口**（或重启应用），【设置】侧栏会多出「OpenViking」入口。

## 页面上的数据来自哪里

| 面板项 | 来源 | 备注 |
| --- | --- | --- |
| 已连接 / 版本 | `GET /health` | 免鉴权；返回 `healthy` 与 `version` |
| 服务就绪 | `GET /ready` | agfs / vectordb / api_key_manager / embedding / ollama |
| 记忆条目 | `GET /api/v1/stats/memories` | 记忆库口径，与向量条数不同 |
| 会话 | `GET /api/v1/sessions` | 总数、近一小时有变更的数量、最近修改时间 |
| 队列 | `GET /api/v1/observer/queue` | Pending / In Progress / Processed |
| 本机待写回 | `~/.openviking/pending/*.json` | 写入失败时的补偿队列条数 |
| 自动记忆开关 | `OPENVIKING_AUTO_CAPTURE` → `ovcli.conf` 的 `plugin` 段 → 默认开 | 与记忆插件同一套配置键 |

服务端内存占用没有可用的公开端点，因此页面不展示该项。

## 隐私

- OpenViking 的 API Key 只在 **宿主进程** 内使用，页面拿到的是脱敏后的字符串（首尾各 4 位）。
- 页面不读取会话正文，也不把任何记忆内容回传到渲染进程；只读取聚合计数与健康状态。
- 所有请求都由宿主进程发起，浏览器侧只访问本机的 DSH 路由。

## 目录结构

```
index.js            宿主半：连接配置解析、端点探测、POST /api/openviking/status 路由
client.js           浏览器半（构建产物，由 src/client.tsx 生成）
src/                浏览器半源码
locale/             中英文展示元数据
cordis.patch.yml    组合包补丁：插入宿主行
icon.svg            图标
tools/              构建与自检脚本（不参与安装）
```

## 开发

```sh
cd tools && npm install
node build-client.mjs      # 重新打包浏览器半 → client.js
node render-check.mjs      # jsdom 离线自检：插槽注册 + 页面渲染
```

## License

MIT
