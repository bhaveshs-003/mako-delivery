"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";

const DEMO_ACCOUNTS = [
  { role: "Super Admin", email: "super@mako.dev" },
  { role: "Admin", email: "admin@mako.dev" },
  { role: "Sub-admin (PM)", email: "priya@mako.dev" },
  { role: "RL User", email: "john@rocketlane.dev" },
  { role: "Resource", email: "raj@mako.dev" },
];

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const deactivated = params.get("deactivated");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError("Invalid email or password.");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-navy">
            Mako <span className="font-medium text-slate">Governance</span>
          </h1>
          <p className="mt-1 text-sm text-slate">
            Sign in to your account
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-lg border border-border bg-surface p-6 shadow-card"
        >
          {deactivated && (
            <div className="rounded-md border-l-4 border-danger bg-red-50 px-3 py-2 text-sm text-danger">
              Your account has been deactivated.
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium text-navy">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-9 w-full rounded-md border border-border bg-surface px-3 text-sm focus:border-border-strong focus:outline-none"
              placeholder="you@mako.dev"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-navy">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-9 w-full rounded-md border border-border bg-surface px-3 text-sm focus:border-border-strong focus:outline-none"
              placeholder="••••••••"
            />
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <div className="mt-6 rounded-lg border border-dashed border-border bg-surface/60 p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate">
            Demo accounts · password{" "}
            <code className="rounded bg-bg px-1 font-mono">password123</code>
          </p>
          <ul className="space-y-1 text-xs">
            {DEMO_ACCOUNTS.map((a) => (
              <li key={a.email} className="flex justify-between">
                <span className="text-slate">{a.role}</span>
                <button
                  type="button"
                  onClick={() => {
                    setEmail(a.email);
                    setPassword("password123");
                  }}
                  className="font-mono text-info hover:underline"
                >
                  {a.email}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
