import express from "express";
import cors from "cors";
import multer from "multer";
import { ZodError } from "zod";
import { getDashboardSummary } from "./services/dashboard-service";
import { saveUploadedDocument, listDocuments, deleteDocument } from "./services/document-service";
import { addFindingReviewLog, listFindings, updateFindingStatus } from "./services/finding-service";
import { createProject, deleteProject, listProjects } from "./services/project-service";
import {
  createRegulation,
  deleteRegulation,
  importRegulationFromFile,
  listRegulations,
  previewRegulationFromFile,
  updateRegulation,
} from "./services/regulation-service";
import {
  abortReviewTask,
  createReviewTask,
  deleteReviewTask,
  getTask,
  listTasks,
  retryReviewTask,
} from "./services/review-service";
import { streamReviewTaskEvents } from "./services/review-task-stream-service";
import {
  createBidReviewSchema,
  createFindingReviewLogSchema,
  createProjectSchema,
  createRegulationSchema,
  createTenderReviewSchema,
  updateFindingStatusSchema,
  uploadDocumentSchema,
} from "./validators";
import { createUploadMiddleware, UploadValidationError, uploadMaxFileSizeBytes } from "./services/upload-policy-service";

const upload = createUploadMiddleware();

export const createApp = () => {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, service: "deep-read-pro-api" });
  });

  app.get("/api/dashboard", (_req, res) => {
    res.json(getDashboardSummary());
  });

  app.get("/api/projects", (req, res) => {
    res.json(listProjects(String(req.query.search ?? "")));
  });

  app.post("/api/projects", (req, res) => {
    const input = createProjectSchema.parse(req.body);
    res.status(201).json(createProject(input));
  });

  app.delete("/api/projects/:projectId", (req, res) => {
    res.json(deleteProject(req.params.projectId));
  });

  app.get("/api/documents", (req, res) => {
    const projectId = req.query.projectId ? String(req.query.projectId) : undefined;
    res.json(listDocuments(projectId));
  });

  app.delete("/api/documents/:documentId", (req, res) => {
    res.json(deleteDocument(req.params.documentId));
  });

  app.post("/api/documents/upload", upload.single("file"), async (req, res) => {
    const input = uploadDocumentSchema.parse(req.body);

    if (!req.file) {
      return res.status(400).json({ message: "缺少上传文件" });
    }

    res.status(201).json(
      await saveUploadedDocument({
        projectId: input.projectId,
        role: input.role,
        file: req.file,
      }),
    );
  });

  app.get("/api/review-tasks", (req, res) => {
    const projectId = req.query.projectId ? String(req.query.projectId) : undefined;
    res.json(listTasks(projectId));
  });

  app.get("/api/review-tasks/:taskId", (req, res) => {
    res.json(getTask(req.params.taskId));
  });

  app.get("/api/review-tasks/:taskId/events", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();
    res.write("retry: 3000\n\n");

    streamReviewTaskEvents({
      req,
      res,
      taskId: req.params.taskId,
    });
  });

  app.delete("/api/review-tasks/:taskId", (req, res) => {
    res.json(deleteReviewTask(req.params.taskId));
  });

  app.post("/api/review-tasks/:taskId/retry", (req, res) => {
    res.status(200).json(retryReviewTask(req.params.taskId));
  });

  app.post("/api/review-tasks/:taskId/abort", (req, res) => {
    res.status(200).json(abortReviewTask(req.params.taskId));
  });

  app.post("/api/reviews/tender-compliance", async (req, res) => {
    const input = createTenderReviewSchema.parse(req.body);
    res.status(201).json(
      await createReviewTask({
        projectId: input.projectId,
        scenario: "tender_compliance",
        documentIds: [input.tenderDocumentId],
        regulationIds: input.regulationIds,
      }),
    );
  });

  app.post("/api/reviews/bid-consistency", async (req, res) => {
    const input = createBidReviewSchema.parse(req.body);
    res.status(201).json(
      await createReviewTask({
        projectId: input.projectId,
        scenario: "bid_consistency",
        documentIds: [input.tenderDocumentId, input.bidDocumentId],
      }),
    );
  });

  app.get("/api/findings", (req, res) => {
    res.json(
      listFindings({
        search: req.query.search ? String(req.query.search) : undefined,
        status: req.query.status ? (String(req.query.status) as never) : undefined,
        projectId: req.query.projectId ? String(req.query.projectId) : undefined,
        scenario: req.query.scenario ? (String(req.query.scenario) as never) : undefined,
        taskId: req.query.taskId ? String(req.query.taskId) : undefined,
      }),
    );
  });

  app.patch("/api/findings/:findingId/status", (req, res) => {
    const input = updateFindingStatusSchema.parse(req.body);
    res.json(updateFindingStatus(req.params.findingId, input.status, input.note, input.reviewer));
  });

  app.post("/api/findings/:findingId/review-log", (req, res) => {
    const input = createFindingReviewLogSchema.parse(req.body);
    res.json(addFindingReviewLog(req.params.findingId, input.note, input.reviewer));
  });

  app.get("/api/regulations", (req, res) => {
    res.json(listRegulations(String(req.query.search ?? "")));
  });

  app.post("/api/regulations", (req, res) => {
    const input = createRegulationSchema.parse(req.body);
    res.status(201).json(createRegulation(input));
  });

  app.put("/api/regulations/:regulationId", (req, res) => {
    const input = createRegulationSchema.parse(req.body);
    res.json(updateRegulation(req.params.regulationId, input));
  });

  app.post("/api/regulations/upload", upload.single("file"), async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: "缺少法规文件" });
    }

    res.status(201).json(await importRegulationFromFile(req.file));
  });

  app.post("/api/regulations/upload/preview", upload.single("file"), async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: "缺少法规文件" });
    }

    res.status(200).json(await previewRegulationFromFile(req.file));
  });

  app.delete("/api/regulations/:regulationId", (req, res) => {
    res.json(deleteRegulation(req.params.regulationId));
  });

  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          message: `上传文件过大，单文件限制 ${(uploadMaxFileSizeBytes / 1024 / 1024).toFixed(0)}MB`,
        });
      }

      return res.status(400).json({ message: error.message || "文件上传失败" });
    }

    if (error instanceof UploadValidationError) {
      return res.status(400).json({ message: error.message });
    }

    if (error instanceof ZodError) {
      return res.status(400).json({
        message: "请求参数校验失败",
        issues: error.issues,
      });
    }

    const message = error instanceof Error ? error.message : "服务器内部错误";
    return res.status(500).json({ message });
  });

  return app;
};
