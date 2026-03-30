"use client";

import { useState, use, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/toast";

interface ProjectSettings {
  title: string;
  productionCompany: string;
  currency: string;
  timezone: string;
  budgetCap: number;
  genre: string;
  format: string;
  defaultCallTime: string;
  defaultWrapTime: string;
  overtimeThreshold: number;
  turnaroundHours: number;
  defaultEncoding: string;
  parserPreference: string;
  defaultExportFormat: string;
  defaultPaperSize: string;
}

const INITIAL_SETTINGS: ProjectSettings = {
  title: "",
  productionCompany: "",
  currency: "USD",
  timezone: "America/Los_Angeles",
  budgetCap: 0,
  genre: "",
  format: "film",
  defaultCallTime: "07:00",
  defaultWrapTime: "19:00",
  overtimeThreshold: 12,
  turnaroundHours: 10,
  defaultEncoding: "utf-8",
  parserPreference: "auto",
  defaultExportFormat: "one-liner",
  defaultPaperSize: "A4",
};

const CURRENCIES = [
  { value: "USD", label: "USD ($)" },
  { value: "EUR", label: "EUR (\u20AC)" },
  { value: "GBP", label: "GBP (\u00A3)" },
  { value: "CAD", label: "CAD (C$)" },
  { value: "AUD", label: "AUD (A$)" },
  { value: "INR", label: "INR (\u20B9)" },
];

const TIMEZONES = [
  { value: "America/Los_Angeles", label: "Pacific (PT)" },
  { value: "America/Denver", label: "Mountain (MT)" },
  { value: "America/Chicago", label: "Central (CT)" },
  { value: "America/New_York", label: "Eastern (ET)" },
  { value: "Europe/London", label: "London (GMT)" },
  { value: "Europe/Berlin", label: "Berlin (CET)" },
  { value: "Asia/Kolkata", label: "India (IST)" },
  { value: "Asia/Tokyo", label: "Tokyo (JST)" },
  { value: "Australia/Sydney", label: "Sydney (AEST)" },
];

export default function SettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const qc = useQueryClient();
  const { toast } = useToast();

  const [settings, setSettings] = useState<ProjectSettings>(INITIAL_SETTINGS);
  const [dirty, setDirty] = useState(false);

  const { data: project, isLoading } = useQuery({
    queryKey: ["project", id],
    queryFn: () => fetch(`/api/projects/${id}`).then((r) => r.json()),
  });

  useEffect(() => {
    if (project) {
      setSettings({
        title: project.title || "",
        productionCompany: project.productionCompany || "",
        currency: project.currency || "USD",
        timezone: project.timezone || "America/Los_Angeles",
        budgetCap: project.budgetCap || 0,
        genre: project.genre || "",
        format: project.format || "film",
        defaultCallTime: project.defaultCallTime || "07:00",
        defaultWrapTime: project.defaultWrapTime || "19:00",
        overtimeThreshold: project.overtimeThreshold ?? 12,
        turnaroundHours: project.turnaroundHours ?? 10,
        defaultEncoding: project.defaultEncoding || "utf-8",
        parserPreference: project.parserPreference || "auto",
        defaultExportFormat: project.defaultExportFormat || "one-liner",
        defaultPaperSize: project.defaultPaperSize || "A4",
      });
      setDirty(false);
    }
  }, [project]);

  const update = (patch: Partial<ProjectSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
    setDirty(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/projects/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error("Failed to save settings");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", id] });
      qc.invalidateQueries({ queryKey: ["project-meta", id] });
      setDirty(false);
      toast("Settings saved", "success");
    },
    onError: () => toast("Failed to save settings", "error"),
  });

  if (isLoading) {
    return (
      <div
        className="flex items-center justify-center h-full"
        style={{ color: "var(--text-secondary)" }}
      >
        Loading settings...
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-[640px] mx-auto py-8 px-6">
        <div className="flex items-center justify-between mb-8">
          <h1
            style={{
              fontSize: "var(--text-xl)",
              fontWeight: "var(--weight-semibold)",
              color: "var(--text-primary)",
              margin: 0,
            }}
          >
            Project Settings
          </h1>
          <button
            className="sf-btn sf-btn--primary"
            onClick={() => saveMutation.mutate()}
            disabled={!dirty || saveMutation.isPending}
          >
            {saveMutation.isPending ? "Saving..." : "Save Changes"}
          </button>
        </div>

        {/* ── Project Settings ── */}
        <section className="mb-8">
          <h2
            style={{
              fontSize: "var(--text-base)",
              fontWeight: "var(--weight-semibold)",
              color: "var(--text-primary)",
              marginBottom: 12,
            }}
          >
            Project
          </h2>
          <div
            className="sf-card"
            style={{
              padding: 20,
              borderRadius: "var(--radius-lg)",
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            <div>
              <label className="sf-label">Project Name</label>
              <input
                className="sf-input"
                value={settings.title}
                onChange={(e) => update({ title: e.target.value })}
                placeholder="My Feature Film"
              />
            </div>
            <div>
              <label className="sf-label">Production Company</label>
              <input
                className="sf-input"
                value={settings.productionCompany}
                onChange={(e) => update({ productionCompany: e.target.value })}
                placeholder="Studio Name"
              />
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 16,
              }}
            >
              <div>
                <label className="sf-label">Genre</label>
                <input
                  className="sf-input"
                  value={settings.genre}
                  onChange={(e) => update({ genre: e.target.value })}
                  placeholder="e.g. Thriller, Drama, Comedy"
                />
              </div>
              <div>
                <label className="sf-label">Format</label>
                <select
                  className="sf-select"
                  value={settings.format}
                  onChange={(e) => update({ format: e.target.value })}
                >
                  <option value="film">Feature Film</option>
                  <option value="series">Series</option>
                  <option value="short">Short Film</option>
                </select>
              </div>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 16,
              }}
            >
              <div>
                <label className="sf-label">Currency</label>
                <select
                  className="sf-select"
                  value={settings.currency}
                  onChange={(e) => update({ currency: e.target.value })}
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="sf-label">Timezone</label>
                <select
                  className="sf-select"
                  value={settings.timezone}
                  onChange={(e) => update({ timezone: e.target.value })}
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="sf-label">Budget Cap</label>
              <input
                className="sf-input"
                type="number"
                min={0}
                value={settings.budgetCap}
                onChange={(e) => update({ budgetCap: Number(e.target.value) })}
                placeholder="e.g. 10000000"
              />
              <p style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>
                Set to 0 for no cap. This controls the budget health bar and comparison alerts.
              </p>
            </div>
          </div>
        </section>

        {/* ── Schedule Settings ── */}
        <section className="mb-8">
          <h2
            style={{
              fontSize: "var(--text-base)",
              fontWeight: "var(--weight-semibold)",
              color: "var(--text-primary)",
              marginBottom: 12,
            }}
          >
            Schedule
          </h2>
          <div
            className="sf-card"
            style={{
              padding: 20,
              borderRadius: "var(--radius-lg)",
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 16,
              }}
            >
              <div>
                <label className="sf-label">Default Call Time</label>
                <input
                  className="sf-input"
                  type="time"
                  value={settings.defaultCallTime}
                  onChange={(e) => update({ defaultCallTime: e.target.value })}
                />
              </div>
              <div>
                <label className="sf-label">Default Wrap Time</label>
                <input
                  className="sf-input"
                  type="time"
                  value={settings.defaultWrapTime}
                  onChange={(e) => update({ defaultWrapTime: e.target.value })}
                />
              </div>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 16,
              }}
            >
              <div>
                <label className="sf-label">Overtime Threshold (hours)</label>
                <input
                  className="sf-input"
                  type="number"
                  min={1}
                  max={24}
                  value={settings.overtimeThreshold}
                  onChange={(e) =>
                    update({ overtimeThreshold: Number(e.target.value) })
                  }
                />
              </div>
              <div>
                <label className="sf-label">Turnaround (hours)</label>
                <input
                  className="sf-input"
                  type="number"
                  min={1}
                  max={24}
                  value={settings.turnaroundHours}
                  onChange={(e) =>
                    update({ turnaroundHours: Number(e.target.value) })
                  }
                />
              </div>
            </div>
          </div>
        </section>

        {/* ── Import Settings ── */}
        <section className="mb-8">
          <h2
            style={{
              fontSize: "var(--text-base)",
              fontWeight: "var(--weight-semibold)",
              color: "var(--text-primary)",
              marginBottom: 12,
            }}
          >
            Import
          </h2>
          <div
            className="sf-card"
            style={{
              padding: 20,
              borderRadius: "var(--radius-lg)",
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 16,
              }}
            >
              <div>
                <label className="sf-label">Default Encoding</label>
                <select
                  className="sf-select"
                  value={settings.defaultEncoding}
                  onChange={(e) => update({ defaultEncoding: e.target.value })}
                >
                  <option value="utf-8">UTF-8</option>
                  <option value="iso-8859-1">ISO-8859-1</option>
                  <option value="windows-1252">Windows-1252</option>
                  <option value="ascii">ASCII</option>
                </select>
              </div>
              <div>
                <label className="sf-label">Parser Preference</label>
                <select
                  className="sf-select"
                  value={settings.parserPreference}
                  onChange={(e) =>
                    update({ parserPreference: e.target.value })
                  }
                >
                  <option value="auto">Auto-detect</option>
                  <option value="fdx">Final Draft (.fdx)</option>
                  <option value="fountain">Fountain (.fountain)</option>
                  <option value="pdf">PDF</option>
                </select>
              </div>
            </div>
          </div>
        </section>

        {/* ── Export Settings ── */}
        <section className="mb-8">
          <h2
            style={{
              fontSize: "var(--text-base)",
              fontWeight: "var(--weight-semibold)",
              color: "var(--text-primary)",
              marginBottom: 12,
            }}
          >
            Export
          </h2>
          <div
            className="sf-card"
            style={{
              padding: 20,
              borderRadius: "var(--radius-lg)",
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 16,
              }}
            >
              <div>
                <label className="sf-label">Default Format</label>
                <select
                  className="sf-select"
                  value={settings.defaultExportFormat}
                  onChange={(e) =>
                    update({ defaultExportFormat: e.target.value })
                  }
                >
                  <option value="one-liner">One-Liner</option>
                  <option value="stripboard">Stripboard</option>
                  <option value="day-by-day">Day-by-Day</option>
                  <option value="call-sheet">Call Sheet</option>
                </select>
              </div>
              <div>
                <label className="sf-label">Paper Size</label>
                <select
                  className="sf-select"
                  value={settings.defaultPaperSize}
                  onChange={(e) =>
                    update({ defaultPaperSize: e.target.value })
                  }
                >
                  <option value="A4">A4</option>
                  <option value="Letter">Letter</option>
                </select>
              </div>
            </div>
          </div>
        </section>

        {/* ── AI Integration ── */}
        <AiStatusSection />

        {/* Bottom Save */}
        <div
          style={{
            borderTop: "1px solid var(--border-subtle)",
            paddingTop: 20,
            display: "flex",
            justifyContent: "flex-end",
            gap: 12,
          }}
        >
          <button
            className="sf-btn sf-btn--secondary"
            onClick={() => {
              if (project) {
                setSettings({
                  title: project.title || "",
                  productionCompany: project.productionCompany || "",
                  currency: project.currency || "USD",
                  timezone: project.timezone || "America/Los_Angeles",
                  budgetCap: project.budgetCap || 0,
                  genre: project.genre || "",
                  format: project.format || "film",
                  defaultCallTime: project.defaultCallTime || "07:00",
                  defaultWrapTime: project.defaultWrapTime || "19:00",
                  overtimeThreshold: project.overtimeThreshold ?? 12,
                  turnaroundHours: project.turnaroundHours ?? 10,
                  defaultEncoding: project.defaultEncoding || "utf-8",
                  parserPreference: project.parserPreference || "auto",
                  defaultExportFormat: project.defaultExportFormat || "one-liner",
                  defaultPaperSize: project.defaultPaperSize || "A4",
                });
                setDirty(false);
              }
            }}
            disabled={!dirty}
          >
            Reset
          </button>
          <button
            className="sf-btn sf-btn--primary"
            onClick={() => saveMutation.mutate()}
            disabled={!dirty || saveMutation.isPending}
          >
            {saveMutation.isPending ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── AI Status Section ─────────────────────────── */

function AiStatusSection() {
  const { data: health, isLoading } = useQuery({
    queryKey: ["ai-health"],
    queryFn: () => fetch("/api/ai/health").then((r) => r.json()),
    refetchInterval: 30000,
  });

  return (
    <section className="mb-8">
      <h2
        style={{
          fontSize: "var(--text-base)",
          fontWeight: "var(--weight-semibold)",
          color: "var(--text-primary)",
          marginBottom: 12,
        }}
      >
        AI Integration
      </h2>
      <div
        className="sf-card"
        style={{
          padding: 20,
          borderRadius: "var(--radius-lg)",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: isLoading
                ? "#6b7280"
                : health?.ok
                ? "#10b981"
                : "#ef4444",
              boxShadow: health?.ok
                ? "0 0 6px rgba(16, 185, 129, 0.4)"
                : "none",
              flexShrink: 0,
            }}
          />
          <div>
            <div
              style={{
                fontSize: "var(--text-sm)",
                fontWeight: "var(--weight-medium)",
                color: "var(--text-primary)",
              }}
            >
              {isLoading
                ? "Checking AI connection..."
                : health?.ok
                ? `Connected — ${health.model}`
                : "AI Disconnected"}
            </div>
            {!isLoading && !health?.ok && health?.error && (
              <div
                style={{
                  fontSize: 11,
                  color: "var(--text-tertiary)",
                  marginTop: 2,
                }}
              >
                {health.error}
              </div>
            )}
          </div>
        </div>

        <div
          style={{
            fontSize: 11,
            color: "var(--text-tertiary)",
            padding: "10px 12px",
            background: "var(--bg-surface-2)",
            borderRadius: 6,
            lineHeight: 1.6,
          }}
        >
          AI is powered by Ollama. Set <code>OLLAMA_URL</code> and{" "}
          <code>OLLAMA_MODEL</code> in your <code>.env</code> file to configure.
          <br />
          Features: Auto scene breakdown, synopsis generation, smart element tagging.
        </div>
      </div>
    </section>
  );
}
