"use client";

import Link from "next/link";
import {
  Film,
  Clapperboard,
  CalendarRange,
  Wallet,
  ArrowRight,
  BookOpenText,
  Sparkles,
} from "lucide-react";

const FEATURES = [
  {
    icon: BookOpenText,
    title: "Script Import",
    desc: "Upload your screenplay and auto-extract scenes, characters, and elements.",
  },
  {
    icon: Clapperboard,
    title: "Scene Breakdown",
    desc: "AI-powered breakdown identifies cast, props, wardrobe, vehicles, and VFX.",
  },
  {
    icon: CalendarRange,
    title: "Stripboard Scheduling",
    desc: "Drag-and-drop stripboard with conflict detection and day-out-of-days.",
  },
  {
    icon: Wallet,
    title: "Budget Tracking",
    desc: "Real-time budget projections by department with variance alerts.",
  },
];

export function Landing() {
  return (
    <div className="sf-landing">
      {/* Nav */}
      <nav className="sf-landing__nav">
        <div className="sf-landing__nav-inner">
          <div className="sf-landing__brand">
            <div className="sf-landing__logo">
              <Film size={18} />
            </div>
            <span className="sf-landing__wordmark">ShotFlow</span>
          </div>
          <div className="sf-landing__nav-actions">
            <Link href="/signin" className="sf-landing__link">
              Sign In
            </Link>
            <Link href="/signup" className="sf-landing__cta-sm">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="sf-landing__hero">
        <div className="sf-landing__hero-inner">
          <div className="sf-landing__badge">
            <Sparkles size={12} />
            <span>Production Planning, Simplified</span>
          </div>
          <h1 className="sf-landing__h1">
            From Script to<br />
            <span className="sf-landing__h1-accent">Shoot Day</span>
          </h1>
          <p className="sf-landing__sub">
            ShotFlow handles breakdowns, scheduling, budgets, and call sheets —
            so you can focus on making your film.
          </p>
          <div className="sf-landing__hero-actions">
            <Link href="/signup" className="sf-landing__cta">
              Start Free <ArrowRight size={16} />
            </Link>
            <Link href="/signin" className="sf-landing__cta-ghost">
              I have an account
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="sf-landing__features">
        <div className="sf-landing__features-grid">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="sf-landing__feature">
                <div className="sf-landing__feature-icon">
                  <Icon size={20} />
                </div>
                <h3 className="sf-landing__feature-title">{f.title}</h3>
                <p className="sf-landing__feature-desc">{f.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Footer */}
      <footer className="sf-landing__footer">
        <span>ShotFlow</span>
        <span className="sf-landing__footer-dot">·</span>
        <span>Production planning for independent filmmakers</span>
      </footer>

      <style>{`
        .sf-landing {
          min-height: 100vh;
          background: var(--bg-void);
          color: var(--text-primary);
          font-family: var(--font-ui);
        }

        /* ── Nav ── */
        .sf-landing__nav {
          position: fixed; top: 0; left: 0; right: 0; z-index: 50;
          background: rgba(5,7,10,0.8);
          backdrop-filter: blur(16px);
          border-bottom: 1px solid var(--border-subtle);
        }
        .sf-landing__nav-inner {
          max-width: 1100px; margin: 0 auto;
          display: flex; align-items: center; justify-content: space-between;
          padding: 14px 32px;
        }
        .sf-landing__brand { display: flex; align-items: center; gap: 10px; }
        .sf-landing__logo {
          width: 34px; height: 34px; border-radius: 10px;
          background: var(--blue);
          display: flex; align-items: center; justify-content: center;
          color: #fff;
        }
        .sf-landing__wordmark {
          font-size: 17px; font-weight: 700; letter-spacing: -0.02em;
          color: var(--text-primary);
        }
        .sf-landing__nav-actions { display: flex; align-items: center; gap: 12px; }
        .sf-landing__link {
          font-size: 13px; font-weight: 500; color: var(--text-secondary);
          text-decoration: none; padding: 6px 12px; border-radius: 6px;
          transition: color 150ms;
        }
        .sf-landing__link:hover { color: var(--text-primary); }
        .sf-landing__cta-sm {
          font-size: 13px; font-weight: 600; color: #fff;
          background: var(--blue); padding: 7px 18px; border-radius: 8px;
          text-decoration: none; transition: background 150ms;
        }
        .sf-landing__cta-sm:hover { background: var(--blue-hover); }

        /* ── Hero ── */
        .sf-landing__hero {
          padding: 160px 32px 80px;
          text-align: center;
        }
        .sf-landing__hero-inner { max-width: 680px; margin: 0 auto; }
        .sf-landing__badge {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 11px; font-weight: 600; text-transform: uppercase;
          letter-spacing: 0.08em; color: var(--blue);
          background: var(--blue-subtle); padding: 5px 14px; border-radius: 20px;
          border: 1px solid var(--blue-border);
          margin-bottom: 24px;
        }
        .sf-landing__h1 {
          font-size: 56px; font-weight: 800; line-height: 1.05;
          letter-spacing: -0.04em; color: var(--text-primary);
          margin: 0 0 20px;
        }
        .sf-landing__h1-accent {
          background: linear-gradient(135deg, var(--blue) 0%, #a78bfa 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .sf-landing__sub {
          font-size: 17px; line-height: 1.6; color: var(--text-secondary);
          max-width: 520px; margin: 0 auto 36px;
        }
        .sf-landing__hero-actions { display: flex; gap: 12px; justify-content: center; }
        .sf-landing__cta {
          display: inline-flex; align-items: center; gap: 8px;
          font-size: 15px; font-weight: 600; color: #fff;
          background: var(--blue); padding: 12px 28px; border-radius: 10px;
          text-decoration: none; transition: all 150ms;
        }
        .sf-landing__cta:hover { background: var(--blue-hover); transform: translateY(-1px); box-shadow: 0 6px 24px rgba(59,130,246,0.3); }
        .sf-landing__cta-ghost {
          font-size: 15px; font-weight: 500; color: var(--text-secondary);
          padding: 12px 20px; border-radius: 10px; text-decoration: none;
          border: 1px solid var(--border-default); transition: all 150ms;
        }
        .sf-landing__cta-ghost:hover { border-color: var(--border-strong); color: var(--text-primary); }

        /* ── Features ── */
        .sf-landing__features {
          max-width: 1100px; margin: 0 auto;
          padding: 0 32px 80px;
        }
        .sf-landing__features-grid {
          display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px;
        }
        .sf-landing__feature {
          padding: 28px 24px;
          background: var(--bg-surface-1);
          border: 1px solid var(--border-subtle);
          border-radius: 14px;
          transition: all 200ms;
        }
        .sf-landing__feature:hover {
          border-color: var(--border-default);
          transform: translateY(-2px);
        }
        .sf-landing__feature-icon {
          width: 40px; height: 40px; border-radius: 10px;
          background: var(--blue-subtle); color: var(--blue);
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 16px;
        }
        .sf-landing__feature-title {
          font-size: 15px; font-weight: 600; color: var(--text-primary);
          margin: 0 0 6px;
        }
        .sf-landing__feature-desc {
          font-size: 13px; line-height: 1.5; color: var(--text-tertiary);
          margin: 0;
        }

        /* ── Footer ── */
        .sf-landing__footer {
          text-align: center; padding: 32px;
          font-size: 12px; color: var(--text-tertiary);
          border-top: 1px solid var(--border-subtle);
        }
        .sf-landing__footer-dot { margin: 0 6px; }

        /* ── Responsive ── */
        @media (max-width: 768px) {
          .sf-landing__h1 { font-size: 36px; }
          .sf-landing__features-grid { grid-template-columns: 1fr 1fr; }
          .sf-landing__hero { padding: 120px 20px 60px; }
        }
        @media (max-width: 480px) {
          .sf-landing__features-grid { grid-template-columns: 1fr; }
          .sf-landing__hero-actions { flex-direction: column; }
        }
      `}</style>
    </div>
  );
}
