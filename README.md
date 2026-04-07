# Review Platform

招投标文件智能审查平台原型，当前形态为：

- `Vite + React + TypeScript` 前端
- `Express + TypeScript` 本地后端
- 本地文件存储（JSON 数据 + 上传文件目录）
- AI 必选审查链路，不再提供本地规则回退

## 当前产品形态

当前主流程已经收敛为：

1. 在“项目管理”中创建或查看项目
2. 在“文件审查”中上传招标/投标文件并发起任务
3. 在“任务详情”中直接查看问题清单、筛选、复核和状态更新

当前版本已经移除：

- 独立“审查结果”页面
- 第三轮 AI 正式报告生成
- 结果页相关的独立报告接口

问题结果现在统一在任务详情页内处理。

## 运行

```bash
npm install
npm run server:dev
npm run dev
```

前端默认地址：`http://localhost:8080`  
后端默认地址：`http://localhost:8787`

## AI 配置

服务端通过 OpenAI 兼容接口执行审查。必须配置以下环境变量后，才能创建审查任务：

- `OPENAI_API_KEY`
- `OPENAI_BASE_URL` 可选，默认 `https://api.openai.com/v1`
- `OPENAI_MODEL` 可选，默认 `gpt-4o-mini`

示例（DeepSeek）：

```env
OPENAI_API_KEY=your-key
OPENAI_BASE_URL=https://api.deepseek.com
OPENAI_MODEL=deepseek-chat
```

如果未配置 `OPENAI_API_KEY`，创建审查任务会直接失败，不会再回退到本地规则模式。

## 目录说明

- `src/`：前端页面、组件、API 类型
- `server/`：后端接口、审查服务、存储读写
- `server-data/app-data.json`：本地 JSON 数据
- `storage/uploads/`：上传后的原始文件

## 当前页面

- `/`：首页 / 仪表盘
- `/projects`：项目管理
- `/projects/:projectId`：项目详情
- `/upload`：文件上传与任务发起
- `/tasks/:taskId`：任务详情与问题清单
- `/regulations`：法规管理

## 常用脚本

- `npm run dev`：启动前端开发服务器
- `npm run server:dev`：启动后端开发服务器
- `npm run build`：构建前端
- `npm run server:build`：编译后端 TypeScript
- `npm run lint`：运行 ESLint
- `npm test`：运行 Vitest
