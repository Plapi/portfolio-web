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

    CREATE TABLE IF NOT EXISTS companies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      icon TEXT NOT NULL DEFAULT '',
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS positions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      period TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
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

    CREATE TABLE IF NOT EXISTS project_videos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      video_url TEXT NOT NULL,
      aspect_ratio TEXT NOT NULL DEFAULT '16 / 9',
      placement TEXT NOT NULL DEFAULT 'project',
      sort_order INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
  `);

  ensureColumn("projects", "position_id", "INTEGER REFERENCES positions(id) ON DELETE SET NULL");
  ensureColumn("projects", "description_placement", "TEXT NOT NULL DEFAULT 'after'");
  ensureColumn("project_videos", "placement", "TEXT NOT NULL DEFAULT 'project'");
  seedProfile();
  migrateExistingProjects();
  migrateExistingVideos();
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

export function getCompanies() {
  const companies = db.prepare(`
    SELECT * FROM companies
    ORDER BY sort_order ASC, id ASC
  `).all().map(mapCompany);

  const positionRows = db.prepare(`
    SELECT * FROM positions
    WHERE company_id = ?
    ORDER BY sort_order ASC, id ASC
  `);

  const projectRows = db.prepare(`
    SELECT * FROM projects
    WHERE position_id = ?
    ORDER BY sort_order ASC, id ASC
  `);

  const imageRows = db.prepare(`
    SELECT * FROM project_images
    WHERE project_id = ?
    ORDER BY sort_order ASC, id ASC
  `);

  const videoRows = db.prepare(`
    SELECT * FROM project_videos
    WHERE project_id = ?
    ORDER BY sort_order ASC, id ASC
  `);

  return companies.map((company) => ({
    ...company,
    positions: positionRows.all(company.id).map((position) => ({
      ...mapPosition(position),
      projects: projectRows.all(position.id).map((project) => ({
        ...mapProject(project),
        images: imageRows.all(project.id).map(mapImage),
        videos: videoRows.all(project.id).map(mapVideo)
      }))
    }))
  }));
}

export function createCompany(input) {
  const nextOrder = nextSortOrder("companies");
  const data = cleanCompany({ ...input, sortOrder: input.sortOrder ?? nextOrder });
  const result = db.prepare(`
    INSERT INTO companies (icon, name, description, sort_order)
    VALUES (@icon, @name, @description, @sortOrder)
  `).run(data);

  return getCompanyById(result.lastInsertRowid);
}

export function updateCompany(id, input) {
  const existing = db.prepare("SELECT id FROM companies WHERE id = ?").get(id);
  if (!existing) return null;

  const data = cleanCompany(input);
  db.prepare(`
    UPDATE companies
    SET icon = @icon,
        name = @name,
        description = @description,
        sort_order = @sortOrder,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = @id
  `).run({ ...data, id });

  return getCompanyById(id);
}

export function deleteCompany(id) {
  return db.prepare("DELETE FROM companies WHERE id = ?").run(id).changes > 0;
}

export function createPosition(companyId, input) {
  const company = db.prepare("SELECT id FROM companies WHERE id = ?").get(companyId);
  if (!company) return null;

  const nextOrder = nextSortOrder("positions", "company_id", companyId);
  const data = cleanPosition({ ...input, companyId, sortOrder: input.sortOrder ?? nextOrder });
  const result = db.prepare(`
    INSERT INTO positions (company_id, title, period, description, sort_order)
    VALUES (@companyId, @title, @period, @description, @sortOrder)
  `).run(data);

  return getPositionById(result.lastInsertRowid);
}

export function updatePosition(id, input) {
  const existing = db.prepare("SELECT id FROM positions WHERE id = ?").get(id);
  if (!existing) return null;

  const data = cleanPosition(input);
  db.prepare(`
    UPDATE positions
    SET title = @title,
        period = @period,
        description = @description,
        sort_order = @sortOrder,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = @id
  `).run({ ...data, id });

  return getPositionById(id);
}

export function deletePosition(id) {
  return db.prepare("DELETE FROM positions WHERE id = ?").run(id).changes > 0;
}

export function createProject(positionId, input) {
  const position = db.prepare("SELECT id FROM positions WHERE id = ?").get(positionId);
  if (!position) return null;

  const nextOrder = nextSortOrder("projects", "position_id", positionId);
  const data = cleanProject({ ...input, positionId, sortOrder: input.sortOrder ?? nextOrder });

  const write = db.transaction(() => {
    const result = db.prepare(`
      INSERT INTO projects (position_id, icon, name, description, description_placement, video_url, project_url, github_url, sort_order)
      VALUES (@positionId, @icon, @name, @description, @descriptionPlacement, @videoUrl, @projectUrl, @githubUrl, @sortOrder)
    `).run(data);

    replaceImages(result.lastInsertRowid, data.images);
    replaceVideos(result.lastInsertRowid, data.videos);
    return getProjectById(result.lastInsertRowid);
  });

  return write();
}

export function updateProject(id, input) {
  const existing = db.prepare("SELECT id, position_id AS positionId FROM projects WHERE id = ?").get(id);
  if (!existing) return null;

  const data = cleanProject({ ...input, positionId: input.positionId ?? existing.positionId });
  const write = db.transaction(() => {
    db.prepare(`
      UPDATE projects
      SET position_id = @positionId,
          icon = @icon,
          name = @name,
          description = @description,
          description_placement = @descriptionPlacement,
          video_url = @videoUrl,
          project_url = @projectUrl,
          github_url = @githubUrl,
          sort_order = @sortOrder,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = @id
    `).run({ ...data, id });

    replaceImages(id, data.images);
    replaceVideos(id, data.videos);
    return getProjectById(id);
  });

  return write();
}

export function deleteProject(id) {
  return db.prepare("DELETE FROM projects WHERE id = ?").run(id).changes > 0;
}

export function getContent() {
  return {
    profile: getProfile(),
    companies: getCompanies()
  };
}

function seedProfile() {
  const profile = db.prepare("SELECT id FROM profile WHERE id = 1").get();
  if (profile) return;

  db.prepare(`
    INSERT INTO profile (id, avatar, name, title, summary, resume_url, git_url)
    VALUES (1, @avatar, @name, @title, @summary, @resumeUrl, @gitUrl)
  `).run({
    avatar: "/assets/profile.jpg",
    name: "Adrian Plapamaru",
    title: "Unity Developer",
    summary: "Unity developer focused on polished mobile games, team leadership, and production-ready gameplay systems.",
    resumeUrl: "/assets/resume.pdf",
    gitUrl: "https://github.com/Plapi"
  });
}

function migrateExistingProjects() {
  const companyCount = db.prepare("SELECT COUNT(*) AS count FROM companies").get().count;
  if (companyCount > 0) return;

  const oldProjects = db.prepare("SELECT COUNT(*) AS count FROM projects").get().count;
  const seed = db.transaction(() => {
    const companyId = db.prepare(`
      INSERT INTO companies (icon, name, description, sort_order)
      VALUES (@icon, @name, @description, 1)
    `).run({
      icon: "/assets/unity.png",
      name: "SuperPlay",
      description: "Current role, focused on Unity game development and team leadership."
    }).lastInsertRowid;

    const seniorId = db.prepare(`
      INSERT INTO positions (company_id, title, period, description, sort_order)
      VALUES (?, ?, ?, ?, 1)
    `).run(
      companyId,
      "Senior Unity Developer",
      "First 6 months",
      "Contributed as a senior IC across Unity gameplay and production systems."
    ).lastInsertRowid;

    db.prepare(`
      INSERT INTO positions (company_id, title, period, description, sort_order)
      VALUES (?, ?, ?, ?, 2)
    `).run(
      companyId,
      "Team Lead Unity Developer",
      "After promotion",
      "Led Unity development work, coordination, and delivery across the team."
    );

    if (oldProjects === 0) {
      db.prepare(`
        INSERT INTO projects (position_id, icon, name, description, sort_order)
        VALUES (?, ?, ?, ?, 1)
      `).run(
        seniorId,
        "/assets/unity.png",
        "Production gameplay work",
        "Add concrete SuperPlay project details here from the admin panel."
      );
    } else {
      db.prepare("UPDATE projects SET position_id = ? WHERE position_id IS NULL").run(seniorId);
    }
  });

  seed();
}

function migrateExistingVideos() {
  const rows = db.prepare(`
    SELECT id, video_url AS videoUrl
    FROM projects
    WHERE video_url != ''
      AND NOT EXISTS (
        SELECT 1 FROM project_videos WHERE project_videos.project_id = projects.id
      )
  `).all();

  const insert = db.prepare(`
    INSERT INTO project_videos (project_id, video_url, aspect_ratio, sort_order)
    VALUES (?, ?, '16 / 9', 1)
  `);

  const write = db.transaction(() => {
    rows.forEach((row) => insert.run(row.id, row.videoUrl));
  });

  write();
}

function ensureColumn(table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some((item) => item.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
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

function replaceVideos(projectId, videos) {
  db.prepare("DELETE FROM project_videos WHERE project_id = ?").run(projectId);
  const insert = db.prepare(`
    INSERT INTO project_videos (project_id, video_url, aspect_ratio, placement, sort_order)
    VALUES (@projectId, @videoUrl, @aspectRatio, @placement, @sortOrder)
  `);

  videos
    .filter((video) => video.videoUrl)
    .forEach((video, index) => insert.run({
      projectId,
      videoUrl: video.videoUrl,
      aspectRatio: video.aspectRatio || "16 / 9",
      placement: video.placement || "project",
      sortOrder: index + 1
    }));
}

function getCompanyById(id) {
  return getCompanies().find((company) => company.id === Number(id)) ?? null;
}

function getPositionById(id) {
  for (const company of getCompanies()) {
    const position = company.positions.find((item) => item.id === Number(id));
    if (position) return position;
  }
  return null;
}

function getProjectById(id) {
  for (const company of getCompanies()) {
    for (const position of company.positions) {
      const project = position.projects.find((item) => item.id === Number(id));
      if (project) return project;
    }
  }
  return null;
}

function nextSortOrder(table, filterColumn, filterValue) {
  if (!filterColumn) {
    return db.prepare(`SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM ${table}`).get().next;
  }

  return db.prepare(`
    SELECT COALESCE(MAX(sort_order), 0) + 1 AS next
    FROM ${table}
    WHERE ${filterColumn} = ?
  `).get(filterValue).next;
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

function cleanCompany(input) {
  return {
    icon: text(input.icon),
    name: text(input.name) || "Untitled company",
    description: text(input.description),
    sortOrder: number(input.sortOrder)
  };
}

function cleanPosition(input) {
  return {
    companyId: number(input.companyId),
    title: text(input.title) || "Untitled role",
    period: text(input.period),
    description: text(input.description),
    sortOrder: number(input.sortOrder)
  };
}

function cleanProject(input) {
  const videos = Array.isArray(input.videos) ? input.videos.map(cleanVideo) : [];
  const legacyVideoUrl = text(input.videoUrl);
  const normalizedVideos = videos.length > 0
    ? videos
    : legacyVideoUrl
      ? [{ videoUrl: legacyVideoUrl, aspectRatio: "16 / 9" }]
      : [];

  return {
    positionId: number(input.positionId),
    icon: text(input.icon),
    name: text(input.name) || "Untitled project",
    description: text(input.description),
    descriptionPlacement: ["before", "after"].includes(text(input.descriptionPlacement)) ? text(input.descriptionPlacement) : "after",
    videoUrl: normalizedVideos[0]?.videoUrl || legacyVideoUrl,
    projectUrl: text(input.projectUrl),
    githubUrl: text(input.githubUrl),
    sortOrder: number(input.sortOrder),
    images: Array.isArray(input.images) ? input.images.map(cleanImage) : [],
    videos: normalizedVideos
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

function cleanVideo(input) {
  if (typeof input === "string") {
    const [url, aspectRatio, placement] = input.split("|").map((part) => text(part));
    return { videoUrl: url, aspectRatio: cleanAspectRatio(aspectRatio), placement: cleanVideoPlacement(placement) };
  }

  return {
    videoUrl: text(input?.videoUrl),
    aspectRatio: cleanAspectRatio(input?.aspectRatio),
    placement: cleanVideoPlacement(input?.placement)
  };
}

function cleanAspectRatio(value) {
  const ratio = text(value) || "16 / 9";
  return /^\d+(\.\d+)?\s*(\/|:)\s*\d+(\.\d+)?$/.test(ratio) ? ratio.replace(":", " / ") : "16 / 9";
}

function cleanVideoPlacement(value) {
  const placement = text(value).toLowerCase();
  return ["left", "details", "position"].includes(placement) ? "left" : "project";
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function number(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
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

function mapCompany(row) {
  return {
    id: row.id,
    icon: row.icon,
    name: row.name,
    description: row.description,
    sortOrder: row.sort_order
  };
}

function mapPosition(row) {
  return {
    id: row.id,
    companyId: row.company_id,
    title: row.title,
    period: row.period,
    description: row.description,
    sortOrder: row.sort_order
  };
}

function mapProject(row) {
  return {
    id: row.id,
    positionId: row.position_id,
    icon: row.icon,
    name: row.name,
    description: row.description,
    descriptionPlacement: row.description_placement || "after",
    videoUrl: row.video_url,
    projectUrl: row.project_url,
    githubUrl: row.github_url,
    sortOrder: row.sort_order
  };
}

function mapVideo(row) {
  return {
    id: row.id,
    videoUrl: row.video_url,
    aspectRatio: row.aspect_ratio,
    placement: row.placement || "project",
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
