# Welcome to your Lovable project

这是一个招投标文件智能审查平台原型，当前已补齐前端和一个可运行的本地后端。

## 运行

```bash
npm install
npm run server:dev
npm run dev
```

## 可选 AI 审查

服务端支持 OpenAI 兼容接口。配置以下环境变量即可启用：

- `OPENAI_API_KEY`
- `OPENAI_BASE_URL` 可选
- `OPENAI_MODEL` 可选

未配置时，系统会回退到当前本地规则引擎，方便继续开发基础能力。
