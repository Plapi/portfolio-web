import Database from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, "..", "portfolio.db");

export const db = new Database(dbPath);
db.pragma("foreign_keys = ON");

export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS profile (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      avatar TEXT NOT NULL DEFAULT '',
      name TEXT NOT NULL DEFAULT '',
      title TEXT NOT NULL DEFAULT '',
      summary TEXT NOT NULL DEFAULT '',
      resume_url TEXT NOT NULL DEFAULT '',
      git_url TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      icon TEXT NOT NULL DEFAULT '',
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      video_url TEXT NOT NULL DEFAULT '',
      project_url TEXT NOT NULL DEFAULT '',
      github_url TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS project_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      image_url TEXT NOT NULL,
      alt TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
  `);

  const profile = db.prepare("SELECT id FROM profile WHERE id = 1").get();
  if (!profile) {
    db.prepare(`
      INSERT INTO profile (id, avatar, name, title, summary, resume_url, git_url)
      VALUES (1, @avatar, @name, @title, @summary, @resumeUrl, @gitUrl)
    `).run({
      avatar: "https://api.dicebear.com/9.x/shapes/svg?seed=Portfolio",
      name: "Numele tau",
      title: "Developer",
      summary: "Un portofoliu personal editabil din admin.",
      resumeUrl: "/resume",
      gitUrl: "https://github.com/"
    });
  }

  const projectCount = db.prepare("SELECT COUNT(*) AS count FROM projects").get().count;
  if (projectCount === 0) {
    const insertProject = db.prepare(`
      INSERT INTO projects (icon, name, description, project_url, github_url, sort_order)
      VALUES (@icon, @name, @description, @projectUrl, @githubUrl, @sortOrder)
    `);
    const insertImage = db.prepare(`
      INSERT INTO project_images (project_id, image_url, alt, sort_order)
      VALUES (@projectId, @imageUrl, @alt, @sortOrder)
    `);

    const seed = db.transaction(() => {
      const first = insertProject.run({
        icon: "spark",
        name: "Primul proiect",
        description: "Descriere scurta pentru un proiect important din portofoliu.",
        projectUrl: "",
        githubUrl: "",
        sortOrder: 1
      });
      insertImage.run({
        projectId: first.lastInsertRowid,
        imageUrl: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1200&q=80",
        alt: "Laptop cu cod",
        sortOrder: 1
      });
    });

    seed();
  }
}

export function getProfile() {
  return mapProfile(db.prepare("SELECT * FROM profile WHERE id = 1").get());
}

export function updateProfile(input) {
  db.prepare(`
    UPDATE profile
    SET avatar = @avatar,
        name = @name,
        title = @title,
        summary = @summary,
        resume_url = @resumeUrl,
        git_url = @gitUrl,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = 1
  `).run(cleanProfile(input));

  return getProfile();
}

export function getProjects() {
  const rows = db.prepare(`
    SELECT * FROM projects
    ORDER BY sort_order ASC, id ASC
  `).all();

  const images = db.prepare(`
    SELECT * FROM project_images
    WHERE project_id = ?
    ORDER BY sort_order ASC, id ASC
  `);

  return rows.map((project) => ({
    ...mapProject(project),
    images: images.all(project.id).map(mapImage)
  }));
}

export function createProject(input) {
  const nextOrder = db.prepare("SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM projects").get().next;
  const data = cleanProject({ ...input, sortOrder: input.sortOrder ?? nextOrder });

  const write = db.transaction(() => {
    const result = db.prepare(`
      INSERT INTO projects (icon, name, description, video_url, project_url, github_url, sort_order)
      VALUES (@icon, @name, @description, @videoUrl, @projectUrl, @githubUrl, @sortOrder)
    `).run(data);

    replaceImages(result.lastInsertRowid, data.images);
    return getProjectById(result.lastInsertRowid);
  });

  return write();
}

export function updateProject(id, input) {
  const existing = db.prepare("SELECT id FROM projects WHERE id = ?").get(id);
  if (!existing) return null;

  const data = cleanProject(input);
  const write = db.transaction(() => {
    db.prepare(`
      UPDATE projects
      SET icon = @icon,
          name = @name,
          description = @description,
          video_url = @videoUrl,
          project_url = @projectUrl,
          github_url = @githubUrl,
          sort_order = @sortOrder,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = @id
    `).run({ ...data, id });

    replaceImages(id, data.images);
    return getProjectById(id);
  });

  return write();
}

export function deleteProject(id) {
  const result = db.prepare("DELETE FROM projects WHERE id = ?").run(id);
  return result.changes > 0;
}

export function reorderProjects(projectIds) {
  const update = db.prepare("UPDATE projects SET sort_order = ? WHERE id = ?");
  const write = db.transaction(() => {
    projectIds.forEach((id, index) => update.run(index + 1, id));
  });
  write();
  return getProjects();
}

function getProjectById(id) {
  return getProjects().find((project) => project.id === Number(id)) ?? null;
}

function replaceImages(projectId, images) {
  db.prepare("DELETE FROM project_images WHERE project_id = ?").run(projectId);
  const insert = db.prepare(`
    INSERT INTO project_images (project_id, image_url, alt, sort_order)
    VALUES (@projectId, @imageUrl, @alt, @sortOrder)
  `);

  images
    .filter((image) => image.imageUrl)
    .forEach((image, index) => insert.run({
      projectId,
      imageUrl: image.imageUrl,
      alt: image.alt || "",
      sortOrder: index + 1
    }));
}

function cleanProfile(input) {
  return {
    avatar: text(input.avatar),
    name: text(input.name),
    title: text(input.title),
    summary: text(input.summary),
    resumeUrl: text(input.resumeUrl),
    gitUrl: text(input.gitUrl)
  };
}

function cleanProject(input) {
  return {
    icon: text(input.icon),
    name: text(input.name) || "Proiect fara nume",
    description: text(input.description),
    videoUrl: text(input.videoUrl),
    projectUrl: text(input.projectUrl),
    githubUrl: text(input.githubUrl),
    sortOrder: Number.isFinite(Number(input.sortOrder)) ? Number(input.sortOrder) : 0,
    images: Array.isArray(input.images) ? input.images.map(cleanImage) : []
  };
}

function cleanImage(input) {
  if (typeof input === "string") {
    return { imageUrl: text(input), alt: "" };
  }

  return {
    imageUrl: text(input?.imageUrl),
    alt: text(input?.alt)
  };
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function mapProfile(row) {
  return {
    avatar: row.avatar,
    name: row.name,
    title: row.title,
    summary: row.summary,
    resumeUrl: row.resume_url,
    gitUrl: row.git_url
  };
}

function mapProject(row) {
  return {
    id: row.id,
    icon: row.icon,
    name: row.name,
    description: row.description,
    videoUrl: row.video_url,
    projectUrl: row.project_url,
    githubUrl: row.github_url,
    sortOrder: row.sort_order
  };
}

function mapImage(row) {
  return {
    id: row.id,
    imageUrl: row.image_url,
    alt: row.alt,
    sortOrder: row.sort_order
  };
}
