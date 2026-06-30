import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:4000";
const emptyProject = {
  icon: "spark",
  name: "",
  description: "",
  videoUrl: "",
  projectUrl: "",
  githubUrl: "",
  sortOrder: 0,
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

  if (loading) return <PageState label="Se incarca portofoliul..." />;
  if (error) return <PageState label="Nu am putut incarca datele." />;

  const { profile, projects } = data;

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
        <p className="eyebrow">Selected work</p>
        <h2>Proiecte</h2>
      </section>

      <section className="project-grid">
        {projects.map((project) => (
          <article className="project-card" key={project.id}>
            <div className="project-media">
              {project.images[0]?.imageUrl ? (
                <img src={project.images[0].imageUrl} alt={project.images[0].alt || project.name} />
              ) : (
                <div className="media-placeholder">{iconLabel(project.icon)}</div>
              )}
            </div>
            <div className="project-body">
              <div className="project-title-row">
                <span className="project-icon">{iconLabel(project.icon)}</span>
                <h3>{project.name}</h3>
              </div>
              <p>{project.description}</p>
              {project.images.length > 1 && (
                <div className="thumb-row">
                  {project.images.slice(1).map((image) => (
                    <img key={image.id || image.imageUrl} src={image.imageUrl} alt={image.alt || project.name} />
                  ))}
                </div>
              )}
              <div className="project-links">
                {project.projectUrl && <a href={project.projectUrl} target="_blank" rel="noreferrer">Live</a>}
                {project.githubUrl && <a href={project.githubUrl} target="_blank" rel="noreferrer">GitHub</a>}
                {project.videoUrl && <a href={project.videoUrl} target="_blank" rel="noreferrer">Video</a>}
              </div>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}

function ResumePage() {
  const { data, loading } = usePortfolioData();
  const profile = data?.profile;

  return (
    <main className="site-shell resume-page">
      <a className="back-link" href="/">Inapoi la portofoliu</a>
      <section className="resume-panel">
        <img src={profile?.avatar || ""} alt="" className="avatar" />
        <p className="eyebrow">{loading ? "Resume" : profile?.title}</p>
        <h1>{loading ? "CV" : profile?.name}</h1>
        <p className="summary">
          Adauga aici link-ul catre CV-ul tau in admin. Pagina aceasta ramane ca fallback local pentru butonul Resume.
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
      setError("Token invalid sau API indisponibil.");
      sessionStorage.removeItem("adminToken");
      setToken("");
    });
  }, [token]);

  function login(event) {
    event.preventDefault();
    sessionStorage.setItem("adminToken", draftToken);
    setToken(draftToken);
    setError("");
  }

  async function saveProfile(profile) {
    const result = await adminFetch(token, "/api/admin/profile", { method: "PUT", body: profile });
    setContent((current) => ({ ...current, profile: result.profile }));
    flash(setStatus, "Profil salvat.");
  }

  async function saveProject(project) {
    const isNew = !project.id;
    const result = await adminFetch(token, isNew ? "/api/admin/projects" : `/api/admin/projects/${project.id}`, {
      method: isNew ? "POST" : "PUT",
      body: project
    });

    setContent((current) => ({
      ...current,
      projects: isNew
        ? [...current.projects, result.project]
        : current.projects.map((item) => (item.id === result.project.id ? result.project : item))
    }));
    flash(setStatus, "Proiect salvat.");
  }

  async function removeProject(id) {
    await adminFetch(token, `/api/admin/projects/${id}`, { method: "DELETE" });
    setContent((current) => ({ ...current, projects: current.projects.filter((project) => project.id !== id) }));
    flash(setStatus, "Proiect sters.");
  }

  async function moveProject(id, direction) {
    const projects = [...content.projects];
    const index = projects.findIndex((project) => project.id === id);
    const target = index + direction;
    if (target < 0 || target >= projects.length) return;
    [projects[index], projects[target]] = [projects[target], projects[index]];
    const result = await adminFetch(token, "/api/admin/projects/reorder", {
      method: "PUT",
      body: { projectIds: projects.map((project) => project.id) }
    });
    setContent((current) => ({ ...current, projects: result.projects }));
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
          <button className="button primary" type="submit">Intra in admin</button>
        </form>
      </main>
    );
  }

  if (!content) return <PageState label="Se incarca adminul..." />;

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div>
          <p className="eyebrow">Admin</p>
          <h1>Continut portofoliu</h1>
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
            <p className="eyebrow">Projects</p>
            <h2>Proiecte</h2>
          </div>
          <button className="button primary" onClick={() => saveProject({ ...emptyProject, name: "Proiect nou", sortOrder: content.projects.length + 1 })}>
            Adauga proiect
          </button>
        </div>
        <div className="editor-list">
          {content.projects.map((project, index) => (
            <ProjectEditor
              key={project.id}
              project={project}
              isFirst={index === 0}
              isLast={index === content.projects.length - 1}
              onSave={saveProject}
              onDelete={removeProject}
              onMove={moveProject}
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
          <h2>Top pagina</h2>
        </div>
        <button className="button primary" onClick={() => onSave(draft)}>Salveaza profil</button>
      </div>
      <div className="form-grid">
        <Field label="Avatar URL" value={draft.avatar} onChange={(avatar) => setDraft({ ...draft, avatar })} />
        <Field label="Nume" value={draft.name} onChange={(name) => setDraft({ ...draft, name })} />
        <Field label="Pozitie" value={draft.title} onChange={(title) => setDraft({ ...draft, title })} />
        <Field label="Resume URL" value={draft.resumeUrl} onChange={(resumeUrl) => setDraft({ ...draft, resumeUrl })} />
        <Field label="Git URL" value={draft.gitUrl} onChange={(gitUrl) => setDraft({ ...draft, gitUrl })} />
        <Field label="Descriere top" textarea value={draft.summary} onChange={(summary) => setDraft({ ...draft, summary })} />
      </div>
    </section>
  );
}

function ProjectEditor({ project, isFirst, isLast, onSave, onDelete, onMove }) {
  const [draft, setDraft] = useState(project);
  const imageLines = useMemo(() => draft.images.map((image) => image.imageUrl).join("\n"), [draft.images]);

  function setImageLines(value) {
    setDraft({
      ...draft,
      images: value.split("\n").map((line) => ({ imageUrl: line.trim(), alt: draft.name })).filter((image) => image.imageUrl)
    });
  }

  return (
    <article className="editor-card">
      <div className="editor-card-head">
        <strong>{draft.name || "Proiect fara nume"}</strong>
        <div className="small-actions">
          <button onClick={() => onMove(project.id, -1)} disabled={isFirst}>Sus</button>
          <button onClick={() => onMove(project.id, 1)} disabled={isLast}>Jos</button>
          <button className="danger" onClick={() => onDelete(project.id)}>Sterge</button>
        </div>
      </div>
      <div className="form-grid">
        <Field label="Icon" value={draft.icon} onChange={(icon) => setDraft({ ...draft, icon })} />
        <Field label="Nume proiect" value={draft.name} onChange={(name) => setDraft({ ...draft, name })} />
        <Field label="Video URL" value={draft.videoUrl} onChange={(videoUrl) => setDraft({ ...draft, videoUrl })} />
        <Field label="Link proiect" value={draft.projectUrl} onChange={(projectUrl) => setDraft({ ...draft, projectUrl })} />
        <Field label="GitHub URL" value={draft.githubUrl} onChange={(githubUrl) => setDraft({ ...draft, githubUrl })} />
        <Field label="Ordine" type="number" value={draft.sortOrder} onChange={(sortOrder) => setDraft({ ...draft, sortOrder: Number(sortOrder) })} />
        <Field label="Descriere" textarea value={draft.description} onChange={(description) => setDraft({ ...draft, description })} />
        <Field label="Imagini, cate un URL pe linie" textarea value={imageLines} onChange={setImageLines} />
      </div>
      <div className="editor-footer">
        <button className="button primary" onClick={() => onSave(draft)}>Salveaza proiect</button>
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

function flash(setter, message) {
  setter(message);
  window.setTimeout(() => setter(""), 1800);
}

createRoot(document.getElementById("root")).render(<App />);
