import { store } from "../store";
import { FindingStatus, ReviewScenario } from "../types";
import { getAiConfig } from "./ai-config-service";
import { generateFinalReviewReport } from "./final-report-service";

const mapDocumentChunkById = () => {
  const data = store.get();
  const documentChunkMap = new Map(
    data.documents.flatMap((document) =>
      document.chunks.map((chunk) => [
        chunk.id,
        {
          documentId: document.id,
          documentName: document.originalName,
          chunkId: chunk.id,
          order: chunk.order,
          text: chunk.text,
        },
      ]),
    ),
  );

  const regulationChunkMap = new Map(
    data.regulations.flatMap((regulation) =>
      regulation.chunks.map((chunk) => [
        chunk.id,
        {
          regulationId: regulation.id,
          regulationName: regulation.name,
          regulationCategory: regulation.category,
          chunkId: chunk.id,
          order: chunk.order,
          text: chunk.text,
          sectionTitle: chunk.sectionTitle,
        },
      ]),
    ),
  );

  return { data, documentChunkMap, regulationChunkMap };
};

export const listFindings = (params?: {
  search?: string;
  status?: FindingStatus;
  projectId?: string;
  scenario?: ReviewScenario;
}) => {
  const { data, documentChunkMap, regulationChunkMap } = mapDocumentChunkById();
  const keyword = params?.search?.trim();

  return data.findings
    .filter((finding) => {
      if (params?.status && finding.status !== params.status) return false;
      if (params?.projectId && finding.projectId !== params.projectId) return false;
      if (params?.scenario && finding.scenario !== params.scenario) return false;
      if (!keyword) return true;

      const projectName = data.projects.find((project) => project.id === finding.projectId)?.name ?? "";
      return (
        finding.title.includes(keyword) ||
        finding.category.includes(keyword) ||
        projectName.includes(keyword)
      );
    })
    .map((finding) => ({
      ...finding,
      project: data.projects.find((project) => project.id === finding.projectId)?.name ?? "未知项目",
      sourceChunks: finding.sourceChunkIds
        .map((chunkId) => documentChunkMap.get(chunkId))
        .filter((chunk): chunk is NonNullable<typeof chunk> => Boolean(chunk)),
      candidateChunks: finding.candidateChunkIds
        .map((chunkId) => documentChunkMap.get(chunkId))
        .filter((chunk): chunk is NonNullable<typeof chunk> => Boolean(chunk)),
      regulationChunks: finding.regulationChunkIds
        .map((chunkId) => regulationChunkMap.get(chunkId))
        .filter((chunk): chunk is NonNullable<typeof chunk> => Boolean(chunk)),
    }));
};

export const exportFindingsReport = (params?: {
  search?: string;
  status?: FindingStatus;
  projectId?: string;
  scenario?: ReviewScenario;
}) => {
  const findings = listFindings(params);
  const generatedAt = new Date().toLocaleString("zh-CN");
  const projectLabel = params?.projectId ? findings[0]?.project ?? params.projectId : "全部项目";
  const scenarioLabel =
    params?.scenario === "tender_compliance"
      ? "招标审查"
      : params?.scenario === "bid_consistency"
        ? "投标审查"
        : "全部场景";

  const lines = [
    "# 审查报告",
    "",
    `- 生成时间：${generatedAt}`,
    `- 项目范围：${projectLabel}`,
    `- 审查场景：${scenarioLabel}`,
    `- 问题总数：${findings.length}`,
    "",
  ];

  findings.forEach((finding, index) => {
    lines.push(`## ${index + 1}. ${finding.title}`);
    lines.push("");
    lines.push(`- 项目：${finding.project}`);
    lines.push(`- 风险等级：${finding.risk}`);
    lines.push(`- 问题分类：${finding.category}`);
    lines.push(`- 当前状态：${finding.status}`);
    lines.push(`- 置信度：${Math.round(finding.confidence * 100)}%`);
    lines.push(`- 是否建议人工复核：${finding.needsHumanReview ? "是" : "否"}`);
    lines.push(`- 原文定位：${finding.location}`);
    lines.push("");
    lines.push("### 问题描述");
    lines.push(finding.description);
    lines.push("");
    lines.push("### 处理建议");
    lines.push(finding.recommendation);
    lines.push("");

    if (finding.sourceChunks.length > 0) {
      lines.push("### 招标原文片段");
      finding.sourceChunks.forEach((chunk) => {
        lines.push(`- ${chunk.documentName} · 片段 ${chunk.order}`);
        lines.push(`  ${chunk.text}`);
      });
      lines.push("");
    }

    if (finding.candidateChunks.length > 0) {
      lines.push("### 投标响应片段");
      finding.candidateChunks.forEach((chunk) => {
        lines.push(`- ${chunk.documentName} · 片段 ${chunk.order}`);
        lines.push(`  ${chunk.text}`);
      });
      lines.push("");
    }

    if (finding.regulationChunks.length > 0) {
      lines.push("### 法规依据片段");
      finding.regulationChunks.forEach((chunk) => {
        lines.push(`- ${chunk.regulationName} · 条款片段 ${chunk.order}`);
        lines.push(`  ${chunk.text}`);
      });
      lines.push("");
    }
  });

  return lines.join("\n");
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export const exportFindingsHtmlReport = (params?: {
  search?: string;
  status?: FindingStatus;
  projectId?: string;
  scenario?: ReviewScenario;
}) => {
  const findings = listFindings(params);
  const generatedAt = new Date().toLocaleString("zh-CN");
  const projectLabel = params?.projectId ? findings[0]?.project ?? params.projectId : "全部项目";
  const scenarioLabel =
    params?.scenario === "tender_compliance"
      ? "招标审查"
      : params?.scenario === "bid_consistency"
        ? "投标审查"
        : "全部场景";

  const renderChunkSection = (
    title: string,
    items: Array<{ label: string; text: string }>,
  ) => {
    if (items.length === 0) return "";

    return `
      <section class="chunk-group">
        <h4>${escapeHtml(title)}</h4>
        ${items
          .map(
            (item) => `
              <div class="chunk-card">
                <div class="chunk-label">${escapeHtml(item.label)}</div>
                <div class="chunk-text">${escapeHtml(item.text)}</div>
              </div>
            `,
          )
          .join("")}
      </section>
    `;
  };

  const findingsHtml = findings
    .map(
      (finding, index) => `
        <article class="finding-card">
          <h2>${index + 1}. ${escapeHtml(finding.title)}</h2>
          <div class="meta-grid">
            <div><strong>项目</strong><span>${escapeHtml(finding.project)}</span></div>
          <div><strong>风险等级</strong><span>${escapeHtml(finding.risk)}</span></div>
          <div><strong>问题分类</strong><span>${escapeHtml(finding.category)}</span></div>
          <div><strong>当前状态</strong><span>${escapeHtml(finding.status)}</span></div>
          <div><strong>置信度</strong><span>${Math.round(finding.confidence * 100)}%</span></div>
          <div><strong>建议人工复核</strong><span>${finding.needsHumanReview ? "是" : "否"}</span></div>
        </div>
          <section>
            <h3>原文定位</h3>
            <p>${escapeHtml(finding.location)}</p>
          </section>
          <section>
            <h3>问题描述</h3>
            <p>${escapeHtml(finding.description)}</p>
          </section>
          <section>
            <h3>处理建议</h3>
            <p>${escapeHtml(finding.recommendation)}</p>
          </section>
          <section>
            <h3>引用依据</h3>
            <ul>
              ${finding.references.map((reference) => `<li>${escapeHtml(reference)}</li>`).join("")}
            </ul>
          </section>
          ${renderChunkSection(
            "招标原文片段",
            finding.sourceChunks.map((chunk) => ({
              label: `${chunk.documentName} · 片段 ${chunk.order}`,
              text: chunk.text,
            })),
          )}
          ${renderChunkSection(
            "投标响应片段",
            finding.candidateChunks.map((chunk) => ({
              label: `${chunk.documentName} · 片段 ${chunk.order}`,
              text: chunk.text,
            })),
          )}
          ${renderChunkSection(
            "法规依据片段",
            finding.regulationChunks.map((chunk) => ({
              label: `${chunk.regulationName} · 条款片段 ${chunk.order}`,
              text: chunk.text,
            })),
          )}
        </article>
      `,
    )
    .join("");

  return `<!DOCTYPE html>
  <html lang="zh-CN">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>审查报告</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          margin: 0;
          padding: 32px;
          color: #111827;
          background: #f8fafc;
        }
        .report {
          max-width: 960px;
          margin: 0 auto;
        }
        .header,
        .finding-card {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 16px;
          padding: 24px;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
        }
        .finding-card {
          margin-top: 20px;
        }
        h1, h2, h3, h4 {
          margin: 0 0 12px;
        }
        .summary {
          margin-top: 12px;
          color: #4b5563;
          line-height: 1.8;
        }
        .meta-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
          margin: 16px 0;
        }
        .meta-grid div {
          background: #f9fafb;
          border-radius: 12px;
          padding: 12px;
        }
        .meta-grid strong,
        .chunk-label {
          display: block;
          color: #6b7280;
          font-size: 12px;
          margin-bottom: 6px;
        }
        section {
          margin-top: 16px;
        }
        p, li, .chunk-text, span {
          line-height: 1.7;
          white-space: pre-wrap;
        }
        ul {
          margin: 0;
          padding-left: 20px;
        }
        .chunk-group {
          margin-top: 18px;
        }
        .chunk-card {
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          padding: 12px;
          margin-top: 10px;
        }
        @media print {
          body {
            padding: 0;
            background: white;
          }
          .header,
          .finding-card {
            box-shadow: none;
            break-inside: avoid;
          }
        }
      </style>
    </head>
    <body>
      <main class="report">
        <section class="header">
          <h1>审查报告</h1>
          <div class="summary">
            <div>生成时间：${escapeHtml(generatedAt)}</div>
            <div>项目范围：${escapeHtml(projectLabel)}</div>
            <div>审查场景：${escapeHtml(scenarioLabel)}</div>
            <div>问题总数：${findings.length}</div>
          </div>
        </section>
        ${findingsHtml || '<section class="finding-card"><p>当前筛选条件下暂无问题数据。</p></section>'}
      </main>
    </body>
  </html>`;
};

export const exportFindingsFormalHtmlReport = async (params?: {
  search?: string;
  status?: FindingStatus;
  projectId?: string;
  scenario?: ReviewScenario;
}) => {
  const findings = listFindings(params);
  const generatedAt = new Date().toLocaleString("zh-CN");
  const projectLabel = params?.projectId ? findings[0]?.project ?? params.projectId : "全部项目";
  const scenarioLabel =
    params?.scenario === "tender_compliance"
      ? "招标审查"
      : params?.scenario === "bid_consistency"
        ? "投标审查"
        : "全部场景";

  const aiConfig = getAiConfig();
  const finalReport = aiConfig.enabled
    ? await generateFinalReviewReport({
        projectLabel,
        scenarioLabel,
        findings: findings.map((finding) => ({
          title: finding.title,
          category: finding.category,
          risk: finding.risk,
          description: finding.description,
          recommendation: finding.recommendation,
          location: finding.location,
          reviewStage: finding.reviewStage,
        })),
      }).catch(() => null)
    : null;

  const keyRisks = finalReport?.keyRisks ?? [];
  const recommendations = finalReport?.recommendations ?? [];
  const chapterFindings = findings.filter((finding) => finding.reviewStage === "chapter_review");
  const crossSectionFindings = findings.filter((finding) => finding.reviewStage === "cross_section_review");

  return `<!DOCTYPE html>
  <html lang="zh-CN">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>${finalReport?.title ?? "正式审查报告"}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; padding: 32px; color: #111827; background: #f8fafc; }
        .report { max-width: 960px; margin: 0 auto; }
        .card { background: white; border: 1px solid #e5e7eb; border-radius: 16px; padding: 24px; box-shadow: 0 1px 2px rgba(0,0,0,.04); margin-bottom: 20px; }
        h1,h2,h3 { margin: 0 0 12px; }
        p,li { line-height: 1.7; white-space: pre-wrap; }
        ul { margin: 0; padding-left: 20px; }
      </style>
    </head>
    <body>
      <main class="report">
        <section class="card">
          <h1>${escapeHtml(finalReport?.title ?? "正式审查报告")}</h1>
          <p>生成时间：${escapeHtml(generatedAt)}</p>
          <p>项目范围：${escapeHtml(projectLabel)}</p>
          <p>审查场景：${escapeHtml(scenarioLabel)}</p>
          <p>问题总数：${findings.length}</p>
        </section>
        <section class="card">
          <h2>执行摘要</h2>
          <p>${escapeHtml(finalReport?.executiveSummary ?? "当前报告基于结构化审查结果自动生成，请结合问题明细继续人工复核。")}</p>
        </section>
        ${keyRisks.length > 0 ? `<section class="card"><h2>关键风险</h2><ul>${keyRisks.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></section>` : ""}
        ${recommendations.length > 0 ? `<section class="card"><h2>总体建议</h2><ul>${recommendations.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></section>` : ""}
        <section class="card">
          <h2>结论</h2>
          <p>${escapeHtml(finalReport?.conclusion ?? "请根据问题明细逐项处理，并保留人工复核记录。")}</p>
        </section>
        <section class="card">
          <h2>章节审查问题</h2>
          ${chapterFindings.length === 0 ? "<p>未发现章节级问题。</p>" : `<ul>${chapterFindings
            .map(
              (finding) => `<li>${escapeHtml(`[${finding.risk}] ${finding.title} - ${finding.location}`)}</li>`,
            )
            .join("")}</ul>`}
        </section>
        <section class="card">
          <h2>跨章节冲突</h2>
          ${crossSectionFindings.length === 0 ? "<p>未发现跨章节冲突。</p>" : `<ul>${crossSectionFindings
            .map(
              (finding) => `<li>${escapeHtml(`[${finding.risk}] ${finding.title} - ${finding.location}`)}</li>`,
            )
            .join("")}</ul>`}
        </section>
      </main>
    </body>
  </html>`;
};

export const generateTaskFormalReport = async (taskId: string) => {
  const data = store.get();
  const task = data.reviewTasks.find((item) => item.id === taskId);

  if (!task) {
    throw new Error("审查任务不存在");
  }

  const html = await exportFindingsFormalHtmlReport({
    projectId: task.projectId,
    scenario: task.scenario,
  });

  store.update((current) => ({
    ...current,
    reviewTasks: current.reviewTasks.map((item) =>
      item.id === taskId ? { ...item, formalReportHtml: html } : item,
    ),
  }));

  return html;
};

export const getTaskFormalReport = (taskId: string) => {
  const data = store.get();
  const task = data.reviewTasks.find((item) => item.id === taskId);

  if (!task) {
    throw new Error("审查任务不存在");
  }

  if (!task.formalReportHtml) {
    throw new Error("该任务尚未生成正式报告");
  }

  return task.formalReportHtml;
};

export const updateFindingStatus = (findingId: string, status: FindingStatus) => {
  let updated = false;

  const next = store.update((current) => ({
    ...current,
    findings: current.findings.map((finding) => {
      if (finding.id !== findingId) return finding;
      updated = true;
      return { ...finding, status };
    }),
  }));

  if (!updated) {
    throw new Error("问题记录不存在");
  }

  const { data, documentChunkMap, regulationChunkMap } = mapDocumentChunkById();
  const finding = next.findings.find((item) => item.id === findingId)!;

  return {
    ...finding,
    project: data.projects.find((project) => project.id === finding.projectId)?.name ?? "未知项目",
    sourceChunks: finding.sourceChunkIds
      .map((chunkId) => documentChunkMap.get(chunkId))
      .filter((chunk): chunk is NonNullable<typeof chunk> => Boolean(chunk)),
    candidateChunks: finding.candidateChunkIds
      .map((chunkId) => documentChunkMap.get(chunkId))
      .filter((chunk): chunk is NonNullable<typeof chunk> => Boolean(chunk)),
    regulationChunks: finding.regulationChunkIds
      .map((chunkId) => regulationChunkMap.get(chunkId))
      .filter((chunk): chunk is NonNullable<typeof chunk> => Boolean(chunk)),
  };
};
