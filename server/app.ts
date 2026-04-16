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
import { getSharedGlobalLoadController } from "./services/global-load-controller";
import { getRuntimeHealthSampler } from "./services/runtime-health-sampler";
import { streamReviewTaskEvents } from "./services/review-task-stream-service";
import {
  adminCreateUserSchema,
  adminResetPasswordSchema,
  adminUpdateUserSchema,
  changePasswordSchema,
  createBidReviewSchema,
  createFindingReviewLogSchema,
  createProjectSchema,
  createRegulationSchema,
  createTenderReviewSchema,
  loginSchema,
  updateFindingStatusSchema,
  uploadDocumentSchema,
} from "./validators";
import {
  createUploadMiddleware,
  UploadValidationError,
  uploadMaxFileSizeBytes,
} from "./services/upload-policy-service";
import { assertTaskAccess } from "./services/access-control-service";
import {
  changePassword,
  createManagedUser,
  getMe,
  initializeAuth,
  listManagedUsers,
  login,
  logout,
  resetManagedUserPassword,
  updateManagedUser,
} from "./services/auth-service";
import { requireAdmin, requireAuth } from "./services/auth-middleware";
import { HttpError, unauthorized } from "./services/http-error";

const upload = createUploadMiddleware();
const runtimeHealthSampler = getRuntimeHealthSampler();
const globalLoadController = getSharedGlobalLoadController();

export const createApp = () => {
  initializeAuth();

  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    const startedAt = Date.now();
    const payload = { ok: true, service: "deep-read-pro-api" };
    runtimeHealthSampler.recordHealthCheck({
      latencyMs: Date.now() - startedAt,
      timedOut: false,
      ok: true,
    });
    res.json(payload);
  });

  app.get("/api/health/runtime", (_req, res) => {
    const stats = runtimeHealthSampler.getWindowStats();
    const loadState = globalLoadController.getState();

    res.json({
      status: loadState.status === "healthy" ? "healthy" : "degraded",
      eventLoopLagP95Ms: stats.eventLoopLagP95Ms,
      rssBytes: stats.latestRssBytes,
      privateBytes: stats.latestPrivateBytes,
      activeTasks: stats.activeTasks,
      queuedTasks: stats.queuedTasks,
      globalAiInFlight: stats.aiInFlight,
      errorRateWindow: {
        aiErrorRate: stats.aiErrorRate,
        aiTimeoutRate: stats.aiTimeoutRate,
        aiRateLimitRate: stats.aiRateLimitRate,
        healthTimeoutRate: stats.healthTimeoutRate,
      },
      sampledAt: stats.sampledAt,
      windowMs: stats.windowMs,
      reason: loadState.reason,
    });
  });

  app.post("/api/auth/login", (req, res) => {
    const input = loginSchema.parse(req.body);
    res.status(200).json(login(input));
  });

  app.use("/api", requireAuth);

  app.get("/api/auth/me", (req, res) => {
    res.json(getMe(req.user!));
  });

  app.post("/api/auth/logout", (req, res) => {
    if (!req.authSessionToken) {
      throw unauthorized("Unauthorized.");
    }

    logout(req.authSessionToken);
    res.status(204).send();
  });

  app.post("/api/auth/change-password", (req, res) => {
    if (!req.authSessionToken) {
      throw unauthorized("Unauthorized.");
    }

    const input = changePasswordSchema.parse(req.body);
    changePassword({
      actor: req.user!,
      currentSessionToken: req.authSessionToken,
      oldPassword: input.oldPassword,
      newPassword: input.newPassword,
    });
    res.status(204).send();
  });

  app.get("/api/admin/users", requireAdmin, (_req, res) => {
    res.json({ users: listManagedUsers() });
  });

  app.post("/api/admin/users", requireAdmin, (req, res) => {
    const input = adminCreateUserSchema.parse(req.body);
    res.status(201).json({
      user: createManagedUser({
        username: input.username,
        password: input.password,
        role: input.role,
      }),
    });
  });

  app.patch("/api/admin/users/:userId", requireAdmin, (req, res) => {
    const input = adminUpdateUserSchema.parse(req.body);
    res.status(200).json({
      user: updateManagedUser({
        userId: String(req.params.userId),
        role: input.role,
        isActive: input.isActive,
      }),
    });
  });

  app.post("/api/admin/users/:userId/reset-password", requireAdmin, (req, res) => {
    const input = adminResetPasswordSchema.parse(req.body);
    resetManagedUserPassword({
      userId: String(req.params.userId),
      password: input.password,
    });
    res.status(204).send();
  });

  app.get("/api/dashboard", (req, res) => {
    res.json(getDashboardSummary(req.user));
  });

  app.get("/api/projects", (req, res) => {
    res.json(listProjects(String(req.query.search ?? ""), req.user));
  });

  app.post("/api/projects", (req, res) => {
    const input = createProjectSchema.parse(req.body);
    res.status(201).json(createProject(input, req.user));
  });

  app.delete("/api/projects/:projectId", (req, res) => {
    res.json(deleteProject(req.params.projectId, req.user));
  });

  app.get("/api/documents", (req, res) => {
    const projectId = req.query.projectId ? String(req.query.projectId) : undefined;
    res.json(listDocuments(projectId, req.user));
  });

  app.delete("/api/documents/:documentId", (req, res) => {
    res.json(deleteDocument(req.params.documentId, req.user));
  });

  app.post("/api/documents/upload", upload.single("file"), async (req, res) => {
    const input = uploadDocumentSchema.parse(req.body);

    if (!req.file) {
      return res.status(400).json({ message: "Missing upload file." });
    }

    res.status(201).json(
      await saveUploadedDocument({
        projectId: input.projectId,
        role: input.role,
        file: req.file,
        actor: req.user,
      }),
    );
  });

  app.get("/api/review-tasks", (req, res) => {
    const projectId = req.query.projectId ? String(req.query.projectId) : undefined;
    res.json(listTasks(projectId, req.user));
  });

  app.get("/api/review-tasks/:taskId", (req, res) => {
    res.json(getTask(req.params.taskId, req.user));
  });

  app.get("/api/review-tasks/:taskId/events", (req, res) => {
    assertTaskAccess(req.user!, req.params.taskId);

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
    res.json(deleteReviewTask(req.params.taskId, req.user));
  });

  app.post("/api/review-tasks/:taskId/retry", (req, res) => {
    res.status(200).json(retryReviewTask(req.params.taskId, req.user));
  });

  app.post("/api/review-tasks/:taskId/abort", (req, res) => {
    res.status(200).json(abortReviewTask(req.params.taskId, req.user));
  });

  app.post("/api/reviews/tender-compliance", async (req, res) => {
    const input = createTenderReviewSchema.parse(req.body);
    res.status(201).json(
      await createReviewTask({
        projectId: input.projectId,
        scenario: "tender_compliance",
        documentIds: [input.tenderDocumentId],
        regulationIds: input.regulationIds,
        consistencyMode: input.consistencyMode,
        actor: req.user,
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
        consistencyMode: input.consistencyMode,
        actor: req.user,
      }),
    );
  });

  app.get("/api/findings", (req, res) => {
    res.json(
      listFindings(
        {
          search: req.query.search ? String(req.query.search) : undefined,
          status: req.query.status ? (String(req.query.status) as never) : undefined,
          projectId: req.query.projectId ? String(req.query.projectId) : undefined,
          scenario: req.query.scenario ? (String(req.query.scenario) as never) : undefined,
          taskId: req.query.taskId ? String(req.query.taskId) : undefined,
        },
        req.user,
      ),
    );
  });

  app.patch("/api/findings/:findingId/status", (req, res) => {
    const input = updateFindingStatusSchema.parse(req.body);
    res.json(updateFindingStatus(req.params.findingId, input.status, input.note, input.reviewer, req.user));
  });

  app.post("/api/findings/:findingId/review-log", (req, res) => {
    const input = createFindingReviewLogSchema.parse(req.body);
    res.json(addFindingReviewLog(req.params.findingId, input.note, input.reviewer, req.user));
  });

  app.get("/api/regulations", (req, res) => {
    res.json(listRegulations(String(req.query.search ?? "")));
  });

  app.post("/api/regulations", requireAdmin, (req, res) => {
    const input = createRegulationSchema.parse(req.body);
    res.status(201).json(createRegulation(input));
  });

  app.put("/api/regulations/:regulationId", requireAdmin, (req, res) => {
    const input = createRegulationSchema.parse(req.body);
    res.json(updateRegulation(String(req.params.regulationId), input));
  });

  app.post("/api/regulations/upload", requireAdmin, upload.single("file"), async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: "Missing regulation file." });
    }

    res.status(201).json(await importRegulationFromFile(req.file));
  });

  app.post("/api/regulations/upload/preview", requireAdmin, upload.single("file"), async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: "Missing regulation file." });
    }

    res.status(200).json(await previewRegulationFromFile(req.file));
  });

  app.delete("/api/regulations/:regulationId", requireAdmin, (req, res) => {
    res.json(deleteRegulation(String(req.params.regulationId)));
  });

  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ message: error.message });
    }

    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          message: `File too large, limit ${(uploadMaxFileSizeBytes / 1024 / 1024).toFixed(0)}MB`,
        });
      }

      return res.status(400).json({ message: error.message || "File upload failed." });
    }

    if (error instanceof UploadValidationError) {
      return res.status(400).json({ message: error.message });
    }

    if (error instanceof ZodError) {
      return res.status(400).json({
        message: "Request validation failed.",
        issues: error.issues,
      });
    }

    const message = error instanceof Error ? error.message : "Internal server error.";
    return res.status(500).json({ message });
  });

  return app;
};
