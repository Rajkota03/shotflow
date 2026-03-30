"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Film, ArrowRight, Loader2 } from "lucide-react";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth/signin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Sign in failed");
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link href="/" className="auth-brand">
          <div className="auth-logo"><Film size={18} /></div>
          <span className="auth-wordmark">ShotFlow</span>
        </Link>

        <h1 className="auth-title">Welcome back</h1>
        <p className="auth-subtitle">Sign in to your production workspace</p>

        <form onSubmit={handleSubmit} className="auth-form">
          {error && <div className="auth-error">{error}</div>}

          <div className="auth-field">
            <label className="auth-label">Email</label>
            <input
              type="email"
              className="auth-input"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
              required
            />
          </div>

          <div className="auth-field">
            <label className="auth-label">Password</label>
            <input
              type="password"
              className="auth-input"
              placeholder="Your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? (
              <Loader2 size={16} className="auth-spinner" />
            ) : (
              <>Sign In <ArrowRight size={15} /></>
            )}
          </button>
        </form>

        <p className="auth-footer-text">
          No account yet?{" "}
          <Link href="/signup" className="auth-footer-link">Create one</Link>
        </p>
      </div>

      <style>{authStyles}</style>
    </div>
  );
}

const authStyles = `
  .auth-page {
    min-height: 100vh;
    background: var(--bg-void);
    display: flex; align-items: center; justify-content: center;
    padding: 24px;
    font-family: var(--font-ui);
  }
  .auth-card {
    width: 100%; max-width: 400px;
    background: var(--bg-surface-1);
    border: 1px solid var(--border-subtle);
    border-radius: 16px;
    padding: 40px 36px;
  }

  .auth-brand {
    display: flex; align-items: center; gap: 10px;
    text-decoration: none; margin-bottom: 32px;
  }
  .auth-logo {
    width: 34px; height: 34px; border-radius: 10px;
    background: var(--blue); color: var(--text-on-accent);
    display: flex; align-items: center; justify-content: center;
  }
  .auth-wordmark {
    font-size: 17px; font-weight: 700; color: var(--text-primary);
    letter-spacing: -0.02em;
  }

  .auth-title {
    font-size: 22px; font-weight: 700; color: var(--text-primary);
    margin: 0 0 4px; letter-spacing: -0.02em;
  }
  .auth-subtitle {
    font-size: 13px; color: var(--text-tertiary); margin: 0 0 28px;
  }

  .auth-form { display: flex; flex-direction: column; gap: 18px; }

  .auth-error {
    font-size: 12px; color: var(--red);
    background: var(--red-subtle); border: 1px solid var(--red-border);
    padding: 10px 14px; border-radius: 8px;
  }

  .auth-field { display: flex; flex-direction: column; gap: 6px; }
  .auth-label {
    font-size: 11px; font-weight: 600; color: var(--text-tertiary);
    text-transform: uppercase; letter-spacing: 0.06em;
  }
  .auth-input {
    width: 100%; padding: 10px 14px;
    background: var(--bg-void); border: 1px solid var(--border-subtle);
    border-radius: 8px; color: var(--text-primary);
    font-size: 14px; outline: none; transition: border-color 150ms;
    font-family: var(--font-ui);
  }
  .auth-input:focus { border-color: var(--blue); }
  .auth-input::placeholder { color: var(--text-tertiary); }

  .auth-submit {
    display: flex; align-items: center; justify-content: center; gap: 8px;
    padding: 11px 20px; margin-top: 4px;
    background: var(--blue); color: var(--text-on-accent);
    font-size: 14px; font-weight: 600;
    border: none; border-radius: 10px; cursor: pointer;
    transition: all 150ms; font-family: var(--font-ui);
  }
  .auth-submit:hover:not(:disabled) { background: var(--blue-hover); }
  .auth-submit:disabled { opacity: 0.6; cursor: not-allowed; }

  .auth-spinner { animation: auth-spin 1s linear infinite; }
  @keyframes auth-spin { to { transform: rotate(360deg); } }

  .auth-footer-text {
    text-align: center; margin-top: 24px;
    font-size: 13px; color: var(--text-tertiary);
  }
  .auth-footer-link {
    color: var(--blue); text-decoration: none; font-weight: 500;
  }
  .auth-footer-link:hover { text-decoration: underline; }
`;
