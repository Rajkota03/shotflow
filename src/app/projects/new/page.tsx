"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Film, Plus, Loader2 } from "lucide-react";

export default function NewProjectPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    title: "", genre: "", format: "film", budgetCap: "", currency: "INR",
  });
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title) return;
    setLoading(true);

    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, budgetCap: Number(form.budgetCap) || 0 }),
    });

    if (res.ok) {
      const project = await res.json();
      router.push(`/projects/${project.id}/script`);
    } else {
      setLoading(false);
    }
  }

  return (
    <div className="new-project-page">
      <div className="new-project-card">
        <div className="new-project-icon">
          <Film size={24} />
        </div>
        <h1 className="new-project-title">Create Your First Project</h1>
        <p className="new-project-sub">
          Set up the basics — you can change everything later.
        </p>

        <form onSubmit={handleSubmit} className="new-project-form">
          <div className="new-project-field">
            <label className="new-project-label">Project Title *</label>
            <input
              className="new-project-input"
              placeholder="e.g. The Last Frame"
              autoFocus
              value={form.title}
              onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
            />
          </div>

          <div className="new-project-row">
            <div className="new-project-field">
              <label className="new-project-label">Format</label>
              <select
                className="new-project-input"
                value={form.format}
                onChange={(e) => setForm(f => ({ ...f, format: e.target.value }))}
              >
                <option value="film">Feature Film</option>
                <option value="series">Series</option>
                <option value="short">Short Film</option>
              </select>
            </div>
            <div className="new-project-field">
              <label className="new-project-label">Genre</label>
              <input
                className="new-project-input"
                placeholder="Drama, Thriller..."
                value={form.genre}
                onChange={(e) => setForm(f => ({ ...f, genre: e.target.value }))}
              />
            </div>
          </div>

          <div className="new-project-row">
            <div className="new-project-field">
              <label className="new-project-label">Budget Cap</label>
              <input
                type="number"
                className="new-project-input"
                placeholder="e.g. 25000000"
                value={form.budgetCap}
                onChange={(e) => setForm(f => ({ ...f, budgetCap: e.target.value }))}
              />
            </div>
            <div className="new-project-field">
              <label className="new-project-label">Currency</label>
              <select
                className="new-project-input"
                value={form.currency}
                onChange={(e) => setForm(f => ({ ...f, currency: e.target.value }))}
              >
                <option value="INR">INR</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
              </select>
            </div>
          </div>

          <button type="submit" className="new-project-submit" disabled={!form.title || loading}>
            {loading ? (
              <Loader2 size={16} className="new-project-spinner" />
            ) : (
              <><Plus size={16} /> Create Project</>
            )}
          </button>
        </form>
      </div>

      <style>{`
        .new-project-page {
          min-height: 100vh; background: var(--bg-void);
          display: flex; align-items: center; justify-content: center;
          padding: 24px; font-family: var(--font-ui);
        }
        .new-project-card {
          width: 100%; max-width: 480px;
          background: var(--bg-surface-1); border: 1px solid var(--border-subtle);
          border-radius: 16px; padding: 40px 36px; text-align: center;
        }
        .new-project-icon {
          width: 52px; height: 52px; border-radius: 14px;
          background: var(--blue-subtle); color: var(--blue);
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 20px;
        }
        .new-project-title {
          font-size: 22px; font-weight: 700; color: var(--text-primary);
          margin: 0 0 6px; letter-spacing: -0.02em;
        }
        .new-project-sub {
          font-size: 13px; color: var(--text-tertiary); margin: 0 0 28px;
        }
        .new-project-form {
          display: flex; flex-direction: column; gap: 16px; text-align: left;
        }
        .new-project-field { display: flex; flex-direction: column; gap: 6px; }
        .new-project-label {
          font-size: 11px; font-weight: 600; color: var(--text-tertiary);
          text-transform: uppercase; letter-spacing: 0.06em;
        }
        .new-project-input {
          width: 100%; padding: 10px 14px;
          background: var(--bg-void); border: 1px solid var(--border-subtle);
          border-radius: 8px; color: var(--text-primary);
          font-size: 14px; outline: none; transition: border-color 150ms;
          font-family: var(--font-ui);
        }
        .new-project-input:focus { border-color: var(--blue); }
        .new-project-input::placeholder { color: var(--text-tertiary); }
        .new-project-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .new-project-submit {
          display: flex; align-items: center; justify-content: center; gap: 8px;
          padding: 12px 20px; margin-top: 8px;
          background: var(--blue); color: var(--text-on-accent);
          font-size: 14px; font-weight: 600;
          border: none; border-radius: 10px; cursor: pointer;
          transition: all 150ms; font-family: var(--font-ui);
        }
        .new-project-submit:hover:not(:disabled) { background: var(--blue-hover); }
        .new-project-submit:disabled { opacity: 0.4; cursor: not-allowed; }
        .new-project-spinner { animation: nps 1s linear infinite; }
        @keyframes nps { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
