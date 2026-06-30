import "dotenv/config";
import express from "express";
import {
  createCompany,
  createPosition,
  createProject,
  deleteCompany,
  deletePosition,
  deleteProject,
  getContent,
  initDb,
  updateCompany,
  updatePosition,
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
  res.json(getContent());
});

app.use("/api/admin", (req, res, next) => {
  if (req.header("x-admin-token") !== adminToken) {
    return res.status(401).json({ error: "Invalid admin token" });
  }
  next();
});

app.get("/api/admin/content", (req, res) => {
  res.json(getContent());
});

app.put("/api/admin/profile", (req, res) => {
  res.json({ profile: updateProfile(req.body) });
});

app.post("/api/admin/companies", (req, res) => {
  res.status(201).json({ company: createCompany(req.body), content: getContent() });
});

app.put("/api/admin/companies/:id", (req, res) => {
  const company = updateCompany(Number(req.params.id), req.body);
  if (!company) return res.status(404).json({ error: "Company not found" });
  res.json({ company, content: getContent() });
});

app.delete("/api/admin/companies/:id", (req, res) => {
  const deleted = deleteCompany(Number(req.params.id));
  if (!deleted) return res.status(404).json({ error: "Company not found" });
  res.status(204).send();
});

app.post("/api/admin/companies/:companyId/positions", (req, res) => {
  const position = createPosition(Number(req.params.companyId), req.body);
  if (!position) return res.status(404).json({ error: "Company not found" });
  res.status(201).json({ position, content: getContent() });
});

app.put("/api/admin/positions/:id", (req, res) => {
  const position = updatePosition(Number(req.params.id), req.body);
  if (!position) return res.status(404).json({ error: "Position not found" });
  res.json({ position, content: getContent() });
});

app.delete("/api/admin/positions/:id", (req, res) => {
  const deleted = deletePosition(Number(req.params.id));
  if (!deleted) return res.status(404).json({ error: "Position not found" });
  res.status(204).send();
});

app.post("/api/admin/positions/:positionId/projects", (req, res) => {
  const project = createProject(Number(req.params.positionId), req.body);
  if (!project) return res.status(404).json({ error: "Position not found" });
  res.status(201).json({ project, content: getContent() });
});

app.put("/api/admin/projects/:id", (req, res) => {
  const project = updateProject(Number(req.params.id), req.body);
  if (!project) return res.status(404).json({ error: "Project not found" });
  res.json({ project, content: getContent() });
});

app.delete("/api/admin/projects/:id", (req, res) => {
  const deleted = deleteProject(Number(req.params.id));
  if (!deleted) return res.status(404).json({ error: "Project not found" });
  res.status(204).send();
});

app.listen(port, "127.0.0.1", () => {
  console.log(`API running at http://127.0.0.1:${port}`);
});
