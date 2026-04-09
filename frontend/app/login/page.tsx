"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Shield, Eye, EyeOff, ArrowRight, Lock, Mail } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { api } = await import("@/lib/api");
      const data = await api.login(email, password);
      localStorage.setItem("uwsd_token", data.token);
      localStorage.setItem("uwsd_user", JSON.stringify(data.user));
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Login failed");
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950">
      {/* Animated background */}
      <div className="absolute inset-0">
        <div className="absolute left-1/4 top-1/4 h-96 w-96 rounded-full bg-blue-600/5 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-indigo-600/5 blur-3xl" />
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(148, 163, 184, 0.05) 1px, transparent 0)",
            backgroundSize: "40px 40px",
          }}
        />
      </div>

      <div className="relative z-10 w-full max-w-md px-4">
        <div className="text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600 shadow-lg shadow-blue-600/25">
            <Shield className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">UWSD</h1>
          <p className="mt-2 text-sm text-slate-400">
            Unified Watch & Surveillance Device
          </p>
          <p className="mt-1 text-xs text-slate-600">
            AI-Powered Campus Security Platform
          </p>
        </div>

        <form
          onSubmit={handleLogin}
          className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/50 p-8 backdrop-blur-xl"
        >
          <h2 className="text-lg font-semibold text-white">Sign in to Dashboard</h2>
          <p className="mt-1 text-sm text-slate-500">
            Enter your credentials to access the security console
          </p>

          <div className="mt-6 space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="guard@muj.edu"
                  className="h-11 w-full rounded-xl border border-slate-700 bg-slate-800/50 pl-10 pr-4 text-sm text-white placeholder-slate-600 outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-11 w-full rounded-xl border border-slate-700 bg-slate-800/50 pl-10 pr-10 text-sm text-white placeholder-slate-600 outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-800 text-blue-600"
                />
                <span className="text-xs text-slate-500">Remember me</span>
              </label>
              <button type="button" className="text-xs text-blue-400 hover:text-blue-300">
                Forgot password?
              </button>
            </div>
          </div>

          {error && (
            <p className="mt-4 rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-xs text-red-400 text-center">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 text-sm font-semibold text-white transition-all hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <>
                Access Dashboard
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>

          <div className="mt-6 rounded-lg bg-slate-800/50 p-3">
            <p className="text-center text-[10px] font-medium uppercase tracking-wider text-slate-600">
              Demo Credentials
            </p>
            <div className="mt-2 space-y-1 text-center text-xs text-slate-500">
              <p>
                Guard: <span className="text-slate-400">vikram@muj.edu</span>
              </p>
              <p>
                Warden: <span className="text-slate-400">meera@muj.edu</span>
              </p>
              <p>
                Admin: <span className="text-slate-400">amit@muj.edu</span>
              </p>
              <p className="text-slate-600">Password: any</p>
            </div>
          </div>
        </form>

        <p className="mt-6 text-center text-[10px] text-slate-700">
          UWSD v2.0 · Manipal University Jaipur · 2026
        </p>
      </div>
    </div>
  );
}
