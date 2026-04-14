# Backend API

当前后端是本地可运行的 Express + TypeScript 服务，负责：

- 项目管理
- 文档上传与解析
- 审查任务创建与执行
- 问题结果查询与复核
- 法规管理
- 仪表盘统计
- 运行时健康与负载状态输出

## 运行

```bash
npm install
npm run server:dev
```

默认端口：`8787`

可选上传限制配置：

- `UPLOAD_MAX_FILE_SIZE_MB`：单文件上传大小上限，默认 `50`

## AI 约束

当前审查流程强依赖 AI。

需要配置：

- `OPENAI_API_KEY`
- `OPENAI_BASE_URL`，默认 `https://api.openai.com/v1`
- `OPENAI_MODEL`，默认 `gpt-4o-mini`

如果缺少 `OPENAI_API_KEY`，创建审查任务会直接报错，不会回退到本地规则或候选匹配逻辑。

OpenAI 兼容接口示例（如 DeepSeek）：

```env
OPENAI_BASE_URL=https://api.deepseek.com
OPENAI_MODEL=deepseek-chat
```

## 数据存储

- `server-data/app-data.sqlite`：项目、文档、任务、问题、法规等业务数据
- `server-data/app-relational.sqlite`：Drizzle relational mirror
- `storage/uploads/`：上传后的原始文件

`server/store.ts` 使用 SQLite + WAL 持久化，并维护进程内快照缓存供高频读取使用。

## 当前接口

- `GET /api/health`
- `GET /api/health/runtime`
- `GET /api/dashboard`
- `GET /api/projects`
- `POST /api/projects`
- `DELETE /api/projects/:projectId`
- `GET /api/documents`
- `POST /api/documents/upload`
- `DELETE /api/documents/:documentId`
- `GET /api/review-tasks`
- `GET /api/review-tasks/:taskId`
- `GET /api/review-tasks/:taskId/events`
- `DELETE /api/review-tasks/:taskId`
- `POST /api/review-tasks/:taskId/retry`
- `POST /api/review-tasks/:taskId/abort`
- `POST /api/reviews/tender-compliance`
- `POST /api/reviews/bid-consistency`
- `GET /api/findings`
- `PATCH /api/findings/:findingId/status`
- `POST /api/findings/:findingId/review-log`
- `GET /api/regulations`
- `POST /api/regulations`
- `PUT /api/regulations/:regulationId`
- `POST /api/regulations/upload`
- `POST /api/regulations/upload/preview`
- `DELETE /api/regulations/:regulationId`

## 结果查看方式

“审查结果”不是独立页面，问题结果统一通过任务详情页消费。前端主要依赖：

- `GET /api/review-tasks`
- `GET /api/review-tasks/:taskId`
- `GET /api/review-tasks/:taskId/events`
- `GET /api/findings?projectId=...&scenario=...`
- `PATCH /api/findings/:findingId/status`

## Drizzle Relational Mirror

后端会把主数据异步镜像到 relational mirror，用于逐步迁移：

- 主数据源：`server-data/app-data.sqlite`
- 镜像目标：`server-data/app-relational.sqlite`
- 镜像模式：异步非阻塞；镜像失败不会中断主写入

常用命令：

- `npm run db:generate`
- `npm run db:push`
- `npm run db:studio`

非交互环境可直接运行：

```bash
npx drizzle-kit push --config=drizzle.config.ts --force
```

## Review Throughput Tuning

多任务多章节并发能力由以下配置共同控制：

- `OPENAI_API_KEYS`：逗号分隔的多 key 池，缺省回退到 `OPENAI_API_KEY`
- `AI_RETRY_MAX_ATTEMPTS`：可重试 AI 错误最大重试次数，默认 `4`
- `AI_RETRY_BASE_DELAY_MS`：指数退避基准延迟，默认 `800`
- `AI_KEY_COOLDOWN_MS`：单 key 遇到 429 后的冷却时间，默认 `45000`
- `AI_REQUEST_TIMEOUT_MS`：单次 AI 请求超时，默认 `90000`
- `REVIEW_WORKER_CONCURRENCY`：任务级 worker 并发
- `TENDER_CHAPTER_REVIEW_CONCURRENCY`：章节级初始并发
- `TENDER_CHAPTER_REVIEW_MIN_CONCURRENCY`：章节级最低并发
- `REVIEW_MIN_VISIBLE_DURATION_MS`：任务最短可见时间，默认 `500`
- `REVIEW_GLOBAL_MAX_ACTIVE_TASKS`：健康状态下的最大活跃任务数，默认 `4`
- `REVIEW_GLOBAL_DEGRADED_MAX_ACTIVE_TASKS`：退化状态下的最大活跃任务数，默认 `3`
- `REVIEW_GLOBAL_SEVERE_MAX_ACTIVE_TASKS`：严重退化状态下的最大活跃任务数，默认 `1`
- `REVIEW_GLOBAL_MAX_AI_INFLIGHT`：健康状态下的全局 AI in-flight 上限，默认 `24`
- `REVIEW_GLOBAL_DEGRADED_AI_INFLIGHT`：退化状态下的全局 AI in-flight 上限，默认 `12`
- `REVIEW_GLOBAL_MIN_AI_INFLIGHT`：严重退化状态下的全局 AI in-flight 下限，默认 `8`
- `REVIEW_PER_TASK_MAX_AI_INFLIGHT`：单任务 AI in-flight 上限，默认 `8`
- `RUNTIME_HEALTH_SAMPLE_INTERVAL_MS`：运行时健康采样周期，默认 `1000`
- `RUNTIME_HEALTH_WINDOW_MS`：运行时健康滚动窗口，默认 `600000`
- `RUNTIME_DEGRADED_EVENT_LOOP_P95_MS`：进入 degraded 的事件循环延迟阈值
- `RUNTIME_SEVERE_EVENT_LOOP_P95_MS`：进入 severe 的事件循环延迟阈值
- `RUNTIME_DEGRADED_TIMEOUT_RATE`：进入 degraded 的 AI 超时率阈值
- `RUNTIME_SEVERE_TIMEOUT_RATE`：进入 severe 的 AI 超时率阈值
- `RUNTIME_DEGRADED_HEALTH_TIMEOUT_RATE`：进入 degraded 的健康超时率阈值
- `RUNTIME_SEVERE_HEALTH_TIMEOUT_RATE`：进入 severe 的健康超时率阈值

运行时行为：

- 任务级调度由 `review-task-dispatcher` 管理，支持公平出队与降载暂停。
- 单任务执行由 `review-task-runner` 管理，负责阶段推进与结果收口。
- 章节级并发仍由 `review-chapter-concurrency-service` 控制，并结合运行时指标降档。
- 全局 AI 并发由 `ai-inflight-limiter` 控制，避免单任务独占全部请求预算。
- `/api/health/runtime` 用于输出运行态健康与负载信息；`/api/health` 保持兼容。
