import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:4000";
const emptyCompany = { icon: "", name: "New company", description: "", sortOrder: 0 };
const emptyPosition = { title: "New role", period: "", description: "", sortOrder: 0 };
const emptyProject = {
  icon: "",
  name: "New project",
  description: "",
  videoUrl: "",
  projectUrl: "",
  githubUrl: "",
  sortOrder: 0,
  descriptionPlacement: "after",
  videos: [],
  images: []
};

function App() {
  const path = window.location.pathname;
  if (path === "/admin") return <AdminPage />;
  if (path === "/resume") return <ResumePage />;
  return <PublicPage />;
}

function PublicPage() {
  const { data, loading, error } = usePortfolioData();

  if (loading) return <PageState label="Loading portfolio..." />;
  if (error) return <PageState label="Unable to load portfolio data." />;

  const { profile, companies } = data;

  return (
    <main className="site-shell">
      <section className="hero">
        <div className="avatar-wrap">
          <img src={profile.avatar} alt="" className="avatar" />
        </div>
        <div className="hero-copy">
          <div className="role-badge">
            <img src="/assets/unity.png" alt="" className="role-icon" />
            <span>{profile.title}</span>
          </div>
          <h1>{profile.name}</h1>
          <p className="summary">{profile.summary}</p>
          <div className="hero-actions">
            <a className="button primary" href={profile.resumeUrl || "/resume"} target="_blank" rel="noreferrer">
              Resume
            </a>
            <a className="button ghost" href={profile.gitUrl || "https://github.com/"} target="_blank" rel="noreferrer">
              Git
            </a>
          </div>
        </div>
      </section>

      <section className="section-head">
        <h2>Experience</h2>
      </section>

      <section className="experience-list">
        {companies.map((company) => (
          <article className="company-card" key={company.id}>
            <header className="company-head">
              <IconImage value={company.icon} fallback={company.name.slice(0, 1)} className="company-icon" />
              <div>
                <h3>{company.name}</h3>
                {company.description && <p>{company.description}</p>}
              </div>
            </header>

            <div className="position-list">
              {company.positions.map((position) => (
                <section className="position-block" key={position.id}>
                  <div className="position-projects">
                    {position.projects.length > 0 && (
                      <div className="project-grid compact">
                        {position.projects.map((project) => (
                          <ProjectCard key={project.id} project={project} />
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="position-head">
                    <div>
                      <h4>{position.title}</h4>
                      {position.period && <span>{position.period}</span>}
                    </div>
                  </div>

                  <div className="position-content">
                    <div className="position-description">
                      {position.description && <RichText value={position.description} />}
                    </div>
                  </div>
                </section>
              ))}
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}

function ProjectCard({ project }) {
  const videos = getProjectVideos(project);
  const description = project.description ? <RichText value={project.description} /> : null;
  const title = project.projectUrl ? (
    <a href={project.projectUrl} target="_blank" rel="noreferrer">{project.name}</a>
  ) : project.name;

  return (
    <article className="project-card">
      {project.images[0]?.imageUrl && (
        <div className="project-media">
          <img src={project.images[0].imageUrl} alt={project.images[0].alt || project.name} />
        </div>
      )}
      <div className="project-body">
        <div className="project-main">
          <div className="project-title-row">
            <IconImage value={project.icon} fallback={iconLabel(project.icon)} className="project-icon" />
            <h3>{title}</h3>
          </div>
          {project.images.length > 1 && (
            <div className="thumb-row">
              {project.images.slice(1).map((image) => (
                <img key={image.id || image.imageUrl} src={image.imageUrl} alt={image.alt || project.name} />
              ))}
            </div>
          )}
          {project.descriptionPlacement === "before" && description}
          <div className="project-links">
            {project.githubUrl && <a href={project.githubUrl} target="_blank" rel="noreferrer">GitHub</a>}
            {videos.filter((video) => !video.embedUrl).map((video, index) => (
              <a key={`${video.videoUrl}-${index}`} href={video.videoUrl} target="_blank" rel="noreferrer">
                Video {videos.length > 1 ? index + 1 : ""}
              </a>
            ))}
          </div>
          {videos.some((video) => video.embedUrl) && (
            <div className="video-list">
              {videos.filter((video) => video.embedUrl).map((video, index) => (
                <div className="video-embed" style={{ aspectRatio: video.aspectRatio }} key={`${video.embedUrl}-${index}`}>
                  <iframe
                    src={video.embedUrl}
                    title={`${project.name} video ${index + 1}`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                </div>
              ))}
            </div>
          )}
          {project.descriptionPlacement !== "before" && description}
        </div>
      </div>
    </article>
  );
}

function ResumePage() {
  const { data, loading } = usePortfolioData();
  const profile = data?.profile;

  return (
    <main className="site-shell resume-page">
      <a className="back-link" href="/">Back to portfolio</a>
      <section className="resume-panel">
        <img src={profile?.avatar || ""} alt="" className="avatar" />
        <p className="eyebrow">{loading ? "Resume" : profile?.title}</p>
        <h1>{loading ? "CV" : profile?.name}</h1>
        <p className="summary">
          Add a resume file or external resume link from the admin panel.
        </p>
      </section>
    </main>
  );
}

function AdminPage() {
  const [token, setToken] = useState(() => sessionStorage.getItem("adminToken") || "");
  const [draftToken, setDraftToken] = useState(token);
  const [content, setContent] = useState(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    loadAdminContent(token).then(setContent).catch(() => {
      setError("Invalid token or unavailable API.");
      sessionStorage.removeItem("adminToken");
      setToken("");
    });
  }, [token]);

  function applyContent(result, message) {
    if (result.content) setContent(result.content);
    flash(setStatus, message);
  }

  async function login(event) {
    event.preventDefault();
    sessionStorage.setItem("adminToken", draftToken);
    setToken(draftToken);
    setError("");
  }

  async function saveProfile(profile) {
    const result = await adminFetch(token, "/api/admin/profile", { method: "PUT", body: profile });
    setContent((current) => ({ ...current, profile: result.profile }));
    flash(setStatus, "Profile saved.");
  }

  async function saveCompany(company) {
    const isNew = !company.id;
    const result = await adminFetch(token, isNew ? "/api/admin/companies" : `/api/admin/companies/${company.id}`, {
      method: isNew ? "POST" : "PUT",
      body: company
    });
    applyContent(result, "Company saved.");
  }

  async function deleteCompany(id) {
    await adminFetch(token, `/api/admin/companies/${id}`, { method: "DELETE" });
    setContent(await loadAdminContent(token));
    flash(setStatus, "Company deleted.");
  }

  async function savePosition(companyId, position) {
    const isNew = !position.id;
    const result = await adminFetch(token, isNew ? `/api/admin/companies/${companyId}/positions` : `/api/admin/positions/${position.id}`, {
      method: isNew ? "POST" : "PUT",
      body: position
    });
    applyContent(result, "Role saved.");
  }

  async function deletePosition(id) {
    await adminFetch(token, `/api/admin/positions/${id}`, { method: "DELETE" });
    setContent(await loadAdminContent(token));
    flash(setStatus, "Role deleted.");
  }

  async function saveProject(positionId, project) {
    const isNew = !project.id;
    const result = await adminFetch(token, isNew ? `/api/admin/positions/${positionId}/projects` : `/api/admin/projects/${project.id}`, {
      method: isNew ? "POST" : "PUT",
      body: project
    });
    applyContent(result, "Project saved.");
  }

  async function deleteProject(id) {
    await adminFetch(token, `/api/admin/projects/${id}`, { method: "DELETE" });
    setContent(await loadAdminContent(token));
    flash(setStatus, "Project deleted.");
  }

  if (!token) {
    return (
      <main className="admin-shell login-shell">
        <form className="login-card" onSubmit={login}>
          <h1>Admin</h1>
          <label>
            Token
            <input value={draftToken} onChange={(event) => setDraftToken(event.target.value)} type="password" autoFocus />
          </label>
          {error && <p className="form-error">{error}</p>}
          <button className="button primary" type="submit">Enter admin</button>
        </form>
      </main>
    );
  }

  if (!content) return <PageState label="Loading admin..." />;

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div>
          <p className="eyebrow">Admin</p>
          <h1>Portfolio content</h1>
        </div>
        <div className="admin-actions">
          {status && <span className="status-pill">{status}</span>}
          <button className="button ghost" onClick={() => {
            sessionStorage.removeItem("adminToken");
            setToken("");
          }}>Logout</button>
        </div>
      </header>

      <ProfileForm profile={content.profile} onSave={saveProfile} />

      <section className="admin-section">
        <div className="admin-section-head">
          <div>
            <p className="eyebrow">Experience</p>
            <h2>Companies and roles</h2>
          </div>
          <button className="button primary" onClick={() => saveCompany({ ...emptyCompany, sortOrder: content.companies.length + 1 })}>
            Add company
          </button>
        </div>

        <div className="editor-list">
          {content.companies.map((company) => (
            <CompanyEditor
              key={company.id}
              company={company}
              onSaveCompany={saveCompany}
              onDeleteCompany={deleteCompany}
              onSavePosition={savePosition}
              onDeletePosition={deletePosition}
              onSaveProject={saveProject}
              onDeleteProject={deleteProject}
            />
          ))}
        </div>
      </section>
    </main>
  );
}

function ProfileForm({ profile, onSave }) {
  const [draft, setDraft] = useState(profile);

  return (
    <section className="admin-section">
      <div className="admin-section-head">
        <div>
          <p className="eyebrow">Profile</p>
          <h2>Hero content</h2>
        </div>
        <button className="button primary" onClick={() => onSave(draft)}>Save profile</button>
      </div>
      <div className="form-grid">
        <Field label="Avatar URL" value={draft.avatar} onChange={(avatar) => setDraft({ ...draft, avatar })} />
        <Field label="Name" value={draft.name} onChange={(name) => setDraft({ ...draft, name })} />
        <Field label="Headline" value={draft.title} onChange={(title) => setDraft({ ...draft, title })} />
        <Field label="Resume URL" value={draft.resumeUrl} onChange={(resumeUrl) => setDraft({ ...draft, resumeUrl })} />
        <Field label="Git URL" value={draft.gitUrl} onChange={(gitUrl) => setDraft({ ...draft, gitUrl })} />
        <Field label="Summary" textarea value={draft.summary} onChange={(summary) => setDraft({ ...draft, summary })} />
      </div>
    </section>
  );
}

function CompanyEditor({ company, onSaveCompany, onDeleteCompany, onSavePosition, onDeletePosition, onSaveProject, onDeleteProject }) {
  const [draft, setDraft] = useState(company);

  return (
    <article className="editor-card company-editor">
      <div className="editor-card-head">
        <strong>{draft.name || "Untitled company"}</strong>
        <div className="small-actions">
          <button onClick={() => onSavePosition(company.id, { ...emptyPosition, sortOrder: company.positions.length + 1 })}>Add role</button>
          <button className="danger" onClick={() => onDeleteCompany(company.id)}>Delete</button>
        </div>
      </div>
      <div className="form-grid">
        <Field label="Company icon URL" value={draft.icon} onChange={(icon) => setDraft({ ...draft, icon })} />
        <Field label="Company name" value={draft.name} onChange={(name) => setDraft({ ...draft, name })} />
        <Field label="Order" type="number" value={draft.sortOrder} onChange={(sortOrder) => setDraft({ ...draft, sortOrder: Number(sortOrder) })} />
        <Field label="Company description" textarea value={draft.description} onChange={(description) => setDraft({ ...draft, description })} />
      </div>
      <div className="editor-footer">
        <button className="button primary" onClick={() => onSaveCompany(draft)}>Save company</button>
      </div>

      <div className="nested-editor-list">
        {company.positions.map((position) => (
          <PositionEditor
            key={position.id}
            companyId={company.id}
            position={position}
            onSavePosition={onSavePosition}
            onDeletePosition={onDeletePosition}
            onSaveProject={onSaveProject}
            onDeleteProject={onDeleteProject}
          />
        ))}
      </div>
    </article>
  );
}

function PositionEditor({ companyId, position, onSavePosition, onDeletePosition, onSaveProject, onDeleteProject }) {
  const [draft, setDraft] = useState(position);

  return (
    <article className="editor-card nested-editor">
      <div className="editor-card-head">
        <strong>{draft.title || "Untitled role"}</strong>
        <div className="small-actions">
          <button onClick={() => onSaveProject(position.id, { ...emptyProject, sortOrder: position.projects.length + 1 })}>Add project</button>
          <button className="danger" onClick={() => onDeletePosition(position.id)}>Delete</button>
        </div>
      </div>
      <div className="form-grid">
        <Field label="Role title" value={draft.title} onChange={(title) => setDraft({ ...draft, title })} />
        <Field label="Period" value={draft.period} onChange={(period) => setDraft({ ...draft, period })} />
        <Field label="Order" type="number" value={draft.sortOrder} onChange={(sortOrder) => setDraft({ ...draft, sortOrder: Number(sortOrder) })} />
        <Field label="Role description (HTML supported)" textarea value={draft.description} onChange={(description) => setDraft({ ...draft, description })} />
      </div>
      <div className="editor-footer">
        <button className="button primary" onClick={() => onSavePosition(companyId, draft)}>Save role</button>
      </div>

      <div className="nested-editor-list">
        {position.projects.map((project) => (
          <ProjectEditor key={project.id} positionId={position.id} project={project} onSave={onSaveProject} onDelete={onDeleteProject} />
        ))}
      </div>
    </article>
  );
}

function ProjectEditor({ positionId, project, onSave, onDelete }) {
  const [draft, setDraft] = useState(project);
  const imageLines = useMemo(() => draft.images.map((image) => image.imageUrl).join("\n"), [draft.images]);
  const videoLines = useMemo(() => getProjectVideos(draft).map((video) => `${video.videoUrl} | ${video.aspectRatio}`).join("\n"), [draft]);

  function setImageLines(value) {
    setDraft({
      ...draft,
      images: value.split("\n").map((line) => ({ imageUrl: line.trim(), alt: draft.name })).filter((image) => image.imageUrl)
    });
  }

  function setVideoLines(value) {
    setDraft({
      ...draft,
      videos: value
        .split("\n")
        .map((line) => {
          const [videoUrl, aspectRatio] = line.split("|").map((part) => part.trim());
          return { videoUrl, aspectRatio: aspectRatio || "16 / 9" };
        })
        .filter((video) => video.videoUrl),
      videoUrl: ""
    });
  }

  return (
    <article className="editor-card nested-editor project-editor">
      <div className="editor-card-head">
        <strong>{draft.name || "Untitled project"}</strong>
        <div className="small-actions">
          <button className="danger" onClick={() => onDelete(project.id)}>Delete</button>
        </div>
      </div>
      <div className="form-grid">
        <Field label="Project icon URL" value={draft.icon} onChange={(icon) => setDraft({ ...draft, icon })} />
        <Field label="Project title" value={draft.name} onChange={(name) => setDraft({ ...draft, name })} />
        <label>
          Description placement
          <select value={draft.descriptionPlacement || "after"} onChange={(event) => setDraft({ ...draft, descriptionPlacement: event.target.value })}>
            <option value="after">After videos</option>
            <option value="before">Before videos</option>
          </select>
        </label>
        <Field label="Project link" value={draft.projectUrl} onChange={(projectUrl) => setDraft({ ...draft, projectUrl })} />
        <Field label="GitHub URL" value={draft.githubUrl} onChange={(githubUrl) => setDraft({ ...draft, githubUrl })} />
        <Field label="Order" type="number" value={draft.sortOrder} onChange={(sortOrder) => setDraft({ ...draft, sortOrder: Number(sortOrder) })} />
        <Field label="Description (HTML supported)" textarea value={draft.description} onChange={(description) => setDraft({ ...draft, description })} />
        <Field label="Videos, one per line: YouTube URL | aspect ratio" textarea value={videoLines} onChange={setVideoLines} />
        <Field label="Images, one URL per line" textarea value={imageLines} onChange={setImageLines} />
      </div>
      <div className="editor-footer">
        <button className="button primary" onClick={() => onSave(positionId, draft)}>Save project</button>
      </div>
    </article>
  );
}

function Field({ label, value, onChange, textarea = false, type = "text" }) {
  return (
    <label className={textarea ? "wide" : ""}>
      {label}
      {textarea ? (
        <textarea value={value || ""} onChange={(event) => onChange(event.target.value)} rows={4} />
      ) : (
        <input type={type} value={value || ""} onChange={(event) => onChange(event.target.value)} />
      )}
    </label>
  );
}

function IconImage({ value, fallback, className }) {
  if (value?.startsWith("/") || value?.startsWith("http")) {
    return <img src={value} alt="" className={className} />;
  }

  return <span className={className}>{fallback || iconLabel(value)}</span>;
}

function RichText({ value }) {
  return <div className="rich-text" dangerouslySetInnerHTML={{ __html: toRichHtml(value) }} />;
}

function usePortfolioData() {
  const [state, setState] = useState({ data: null, loading: true, error: null });

  useEffect(() => {
    fetch(`${API_BASE}/api/public/profile`)
      .then((response) => {
        if (!response.ok) throw new Error("Request failed");
        return response.json();
      })
      .then((data) => setState({ data, loading: false, error: null }))
      .catch((error) => setState({ data: null, loading: false, error }));
  }, []);

  return state;
}

async function loadAdminContent(token) {
  return adminFetch(token, "/api/admin/content");
}

async function adminFetch(token, path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      "x-admin-token": token
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  if (!response.ok) throw new Error("Admin request failed");
  if (response.status === 204) return {};
  return response.json();
}

function PageState({ label }) {
  return <main className="site-shell"><div className="page-state">{label}</div></main>;
}

function iconLabel(icon) {
  const map = {
    spark: "*",
    code: "</>",
    app: "[]",
    web: "{}",
    data: "#"
  };
  return map[icon] || icon || "*";
}

function getYouTubeEmbedUrl(url) {
  if (!url) return "";

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    let id = "";

    if (host === "youtu.be") {
      id = parsed.pathname.split("/").filter(Boolean)[0] || "";
    }

    if (host === "youtube.com" || host === "m.youtube.com") {
      if (parsed.pathname === "/watch") id = parsed.searchParams.get("v") || "";
      if (parsed.pathname.startsWith("/shorts/")) id = parsed.pathname.split("/")[2] || "";
      if (parsed.pathname.startsWith("/embed/")) id = parsed.pathname.split("/")[2] || "";
    }

    return id ? `https://www.youtube.com/embed/${id}` : "";
  } catch {
    return "";
  }
}

function getProjectVideos(project) {
  const list = Array.isArray(project.videos) && project.videos.length > 0
    ? project.videos
    : project.videoUrl
      ? [{ videoUrl: project.videoUrl, aspectRatio: "16 / 9" }]
      : [];

  return list.map((video) => ({
    videoUrl: video.videoUrl,
    aspectRatio: normalizeAspectRatio(video.aspectRatio),
    embedUrl: getYouTubeEmbedUrl(video.videoUrl)
  }));
}

function normalizeAspectRatio(value) {
  const ratio = String(value || "16 / 9").trim().replace(":", " / ");
  return /^\d+(\.\d+)?\s*\/\s*\d+(\.\d+)?$/.test(ratio) ? ratio : "16 / 9";
}

function toRichHtml(value) {
  const source = String(value || "").trim();
  if (!source) return "";

  const escaped = escapeHtml(source);
  const withInlineFormatting = escaped
    .replace(/&amp;apos;/g, "&#039;")
    .replace(/&amp;nbsp;/g, "&nbsp;")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/__(.*?)__/g, "<strong>$1</strong>");

  const blocks = withInlineFormatting.split(/\n{2,}/).map((block) => {
    const trimmed = block.trim();
    if (!trimmed) return "";
    if (/^&lt;\/?[a-z][\s\S]*&gt;$/i.test(trimmed)) {
      return unescapeAllowedHtml(trimmed);
    }
    return `<p>${trimmed.replace(/\n/g, "<br>")}</p>`;
  });

  return blocks.join("");
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function unescapeAllowedHtml(value) {
  return value
    .replace(/&lt;br\s*\/?&gt;/gi, "<br>")
    .replace(/&lt;(\/?)(p|strong|b|em|i|u|small|big|h3|h4|h5|ul|ol|li)\s*\/?&gt;/gi, "<$1$2>")
    .replace(/&lt;a(?:.*?)href=&quot;(https?:\/\/[^&]+)&quot;(?:.*?)&gt;/gi, '<a href="$1" target="_blank" rel="noreferrer">')
    .replace(/&lt;\/a&gt;/gi, "</a>");
}

function flash(setter, message) {
  setter(message);
  window.setTimeout(() => setter(""), 1800);
}

createRoot(document.getElementById("root")).render(<App />);
