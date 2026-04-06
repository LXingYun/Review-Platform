# Backend API

这个目录补上了当前前端原型缺失的 MVP 后端能力，目标是先让项目具备真实接口，而不是继续完全依赖 mock 数据。

当前实现包含：

- 项目管理接口
- 文档上传接口
- 两类审查任务接口
- 审查结果查询与复核接口
- 法规管理接口
- 仪表盘统计接口
- 可选的 AI 审查执行层（未配置时自动回退到本地规则）

## 运行

```bash
npm install
npm run server:dev
```

默认端口：`8787`

## AI 配置

如果你要启用 AI 审查，需要配置这些环境变量：

- `OPENAI_API_KEY`
- `OPENAI_BASE_URL` 可选，默认 `https://api.openai.com/v1`
- `OPENAI_MODEL` 可选，默认 `gpt-4o-mini`

未配置 `OPENAI_API_KEY` 时，系统会继续使用当前本地规则和候选匹配逻辑，不会阻塞开发。

项目当前已支持 OpenAI 兼容接口，例如 DeepSeek：

- `OPENAI_BASE_URL=https://api.deepseek.com`
- `OPENAI_MODEL=deepseek-chat`

## 数据存储

- JSON 数据：`server-data/app-data.json`
- 上传文件：`storage/uploads/`

这是一个刻意保持简单的本地文件实现，方便你先把前端接起来。
后面如果要上生产，可以把 `server/store.ts` 和各个 `services` 平滑替换为 PostgreSQL / ORM 实现。

## 主要接口

- `GET /api/health`
- `GET /api/dashboard`
- `GET /api/projects`
- `POST /api/projects`
- `GET /api/documents`
- `POST /api/documents/upload`
- `GET /api/review-tasks`
- `POST /api/reviews/tender-compliance`
- `POST /api/reviews/bid-consistency`
- `GET /api/findings`
- `PATCH /api/findings/:findingId/status`
- `GET /api/regulations`
- `POST /api/regulations`
