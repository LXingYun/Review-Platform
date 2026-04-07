# Backend API

当前后端为本地可运行的 MVP 服务，负责：

- 项目管理
- 文档上传与解析
- 审查任务创建与执行
- 问题结果查询与复核
- 法规管理
- 仪表盘统计

## 运行

```bash
npm install
npm run server:dev
```

默认端口：`8787`

## AI 约束

当前审查流程强依赖 AI。

需要配置：

- `OPENAI_API_KEY`
- `OPENAI_BASE_URL` 可选，默认 `https://api.openai.com/v1`
- `OPENAI_MODEL` 可选，默认 `gpt-4o-mini`

如果缺少 `OPENAI_API_KEY`，创建审查任务会直接报错，不会回退到本地规则或候选匹配逻辑。

OpenAI 兼容接口示例（DeepSeek）：

```env
OPENAI_BASE_URL=https://api.deepseek.com
OPENAI_MODEL=deepseek-chat
```

## 数据存储

- `server-data/app-data.json`：项目、文档、任务、问题、法规等业务数据
- `storage/uploads/`：上传后的原始文件

这是一个刻意保持简单的本地文件实现，方便前后端联调。  
如果后续上生产，可将 `server/store.ts` 和各 `services` 替换为数据库与 ORM 实现。

## 当前接口

- `GET /api/health`
- `GET /api/dashboard`
- `GET /api/projects`
- `POST /api/projects`
- `DELETE /api/projects/:projectId`
- `GET /api/documents`
- `POST /api/documents/upload`
- `DELETE /api/documents/:documentId`
- `GET /api/review-tasks`
- `DELETE /api/review-tasks/:taskId`
- `POST /api/reviews/tender-compliance`
- `POST /api/reviews/bid-consistency`
- `GET /api/findings`
- `PATCH /api/findings/:findingId/status`
- `GET /api/regulations`
- `POST /api/regulations`
- `PUT /api/regulations/:regulationId`
- `POST /api/regulations/upload`
- `POST /api/regulations/upload/preview`
- `DELETE /api/regulations/:regulationId`

## 当前结果查看方式

“审查结果”已经不再是独立页面。  
问题结果统一通过任务详情页消费，对应前端会使用：

- `GET /api/review-tasks`
- `GET /api/findings?projectId=...&scenario=...`
- `PATCH /api/findings/:findingId/status`
