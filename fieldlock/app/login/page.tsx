"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Trophy, Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await signIn("credentials", {
      email: form.email,
      password: form.password,
      redirect: false,
    });

    setLoading(false);

    if (res?.error) {
      setError("Invalid credentials. Check your email and password.");
      return;
    }

    // Redirect based on role — fetch session to determine
    const sessionRes = await fetch("/api/auth/session");
    const session = await sessionRes.json();
    router.push(session?.user?.role === "ADMIN" ? "/admin" : "/dashboard");
    router.refresh();
  };

  const quickFill = (email: string, pw: string) => {
    setForm({ email, password: pw });
    setError("");
  };

  return (
    <main className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4">
      {/* Background */}
      <div className="fixed top-0 left-1/3 w-[500px] h-[500px] rounded-full bg-purple-600/8 blur-[120px] pointer-events-none" />
      <div className="fixed bottom-0 right-1/3 w-[400px] h-[400px] rounded-full bg-orange-500/8 blur-[100px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl gradient-brand mb-4 glow-orange">
            <Trophy className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-3xl font-black tracking-tight">FIELDLOCK</h1>
          <p className="text-slate-400 mt-1 text-sm">IIT Guwahati Sports Booking</p>
        </div>

        {/* Form card */}
        <div className="card-elevated rounded-2xl p-8 border border-white/10">
          <h2 className="text-xl font-bold mb-6">Sign in to your account</h2>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Email / Roll Number
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="220101001@iitg.ac.in"
                required
                className="w-full bg-[#0a0a0f] border border-[#2a2a3a] rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="••••••••"
                  required
                  className="w-full bg-[#0a0a0f] border border-[#2a2a3a] rounded-xl px-4 py-3 pr-12 text-white placeholder-slate-600 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={cn(
                "w-full py-3 rounded-xl gradient-brand text-white font-semibold transition-all",
                loading ? "opacity-70 cursor-not-allowed" : "hover:opacity-90 hover:scale-[1.02]"
              )}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Signing in...
                </span>
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          {/* Quick demo login */}
          <div className="mt-6 pt-6 border-t border-[#2a2a3a]">
            <p className="text-xs text-slate-500 mb-3 text-center">Demo accounts</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => quickFill("admin@iitg.ac.in", "admin123")}
                className="px-3 py-2 rounded-lg border border-orange-500/20 bg-orange-500/5 text-orange-400 text-xs font-medium hover:bg-orange-500/10 transition-all text-left"
              >
                <div className="font-semibold">Admin</div>
                <div className="opacity-70">admin@iitg.ac.in</div>
              </button>
              <button
                onClick={() => quickFill("220101001@iitg.ac.in", "pass123")}
                className="px-3 py-2 rounded-lg border border-purple-500/20 bg-purple-500/5 text-purple-400 text-xs font-medium hover:bg-purple-500/10 transition-all text-left"
              >
                <div className="font-semibold">Student</div>
                <div className="opacity-70">220101001@iitg.ac.in</div>
              </button>
            </div>
            <p className="text-xs text-slate-600 text-center mt-2">Passwords: admin123 / pass123</p>
          </div>
        </div>
      </div>
    </main>
  );
}
