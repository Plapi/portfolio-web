import "dotenv/config";
import express from "express";
import {
  createProject,
  deleteProject,
  getProfile,
  getProjects,
  initDb,
  reorderProjects,
  updateProfile,
  updateProject
} from "./db.js";

const app = express();
const port = Number(process.env.PORT || 4000);
const adminToken = process.env.ADMIN_TOKEN;

if (!adminToken) {
  throw new Error("ADMIN_TOKEN must be set in .env");
}

initDb();

app.use(express.json({ limit: "1mb" }));
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "http://127.0.0.1:5173");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-admin-token");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.get("/api/public/profile", (req, res) => {
  res.json({
    profile: getProfile(),
    projects: getProjects()
  });
});

app.use("/api/admin", (req, res, next) => {
  if (req.header("x-admin-token") !== adminToken) {
    return res.status(401).json({ error: "Invalid admin token" });
  }
  next();
});

app.get("/api/admin/content", (req, res) => {
  res.json({
    profile: getProfile(),
    projects: getProjects()
  });
});

app.put("/api/admin/profile", (req, res) => {
  res.json({ profile: updateProfile(req.body) });
});

app.post("/api/admin/projects", (req, res) => {
  res.status(201).json({ project: createProject(req.body) });
});

app.put("/api/admin/projects/reorder", (req, res) => {
  const projectIds = Array.isArray(req.body.projectIds) ? req.body.projectIds.map(Number) : [];
  res.json({ projects: reorderProjects(projectIds) });
});

app.put("/api/admin/projects/:id", (req, res) => {
  const project = updateProject(Number(req.params.id), req.body);
  if (!project) return res.status(404).json({ error: "Project not found" });
  res.json({ project });
});

app.delete("/api/admin/projects/:id", (req, res) => {
  const deleted = deleteProject(Number(req.params.id));
  if (!deleted) return res.status(404).json({ error: "Project not found" });
  res.status(204).send();
});

app.listen(port, "127.0.0.1", () => {
  console.log(`API running at http://127.0.0.1:${port}`);
});
