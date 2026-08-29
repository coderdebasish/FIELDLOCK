import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  Trophy, Zap, Shield, BarChart3, ArrowRight,
  Users, Clock, CheckCircle
} from "lucide-react";

export default async function HomePage() {
  const session = await auth();
  if (session?.user) {
    redirect(session.user.role === "ADMIN" ? "/admin" : "/dashboard");
  }

  return (
    <main className="min-h-screen bg-[#0a0a0f] text-white overflow-hidden">
      {/* Background grid */}
      <div
        className="fixed inset-0 opacity-20"
        style={{
          backgroundImage:
            "linear-gradient(rgba(124,58,237,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(124,58,237,0.1) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* Gradient orbs */}
      <div className="fixed top-0 left-1/4 w-[600px] h-[600px] rounded-full bg-purple-600/10 blur-[120px] pointer-events-none" />
      <div className="fixed bottom-0 right-1/4 w-[400px] h-[400px] rounded-full bg-orange-500/10 blur-[100px] pointer-events-none" />

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-8 py-6 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg gradient-brand flex items-center justify-center">
            <Trophy className="w-4 h-4 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight">FIELDLOCK</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-400">IIT Guwahati Sports</span>
          <Link
            href="/login"
            className="px-4 py-2 rounded-lg gradient-brand text-white text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Sign In
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 max-w-6xl mx-auto px-8 pt-24 pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-purple-500/30 bg-purple-500/10 text-purple-300 text-sm mb-8">
          <Zap className="w-4 h-4" />
          IIT Guwahati Sports Board × Tech Board — PLAYHACK
        </div>

        <h1 className="text-6xl md:text-7xl font-black tracking-tight mb-6 leading-[1.05]">
          One platform.
          <br />
          <span className="gradient-text">Zero clashes.</span>
        </h1>

        <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          Intelligent sports facility booking for IIT Guwahati.
          Atomic bookings. Fair allocation. Real-time availability.
          No more WhatsApp chaos.
        </p>

        <div className="flex items-center justify-center gap-4 flex-wrap">
          <Link
            href="/login"
            className="flex items-center gap-2 px-8 py-4 rounded-xl gradient-brand text-white font-semibold text-lg hover:opacity-90 transition-all hover:scale-105 glow-orange"
          >
            Get Started
            <ArrowRight className="w-5 h-5" />
          </Link>
          <Link
            href="/login"
            className="flex items-center gap-2 px-8 py-4 rounded-xl border border-white/10 text-white font-semibold text-lg hover:bg-white/5 transition-all"
          >
            Admin Demo
          </Link>
        </div>
      </section>

      {/* Stats */}
      <section className="relative z-10 max-w-6xl mx-auto px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { value: "5", label: "Sports Facilities" },
            { value: "1", label: "Winner per slot" },
            { value: "0", label: "Double bookings" },
            { value: "∞", label: "Fair by design" },
          ].map((s) => (
            <div key={s.label} className="card text-center">
              <div className="text-4xl font-black gradient-text mb-1">{s.value}</div>
              <div className="text-sm text-slate-400">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="relative z-10 max-w-6xl mx-auto px-8 py-16">
        <h2 className="text-3xl font-bold text-center mb-12">
          Built for real problems. Not demos.
        </h2>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              icon: <Shield className="w-6 h-6 text-orange-400" />,
              title: "Concurrency-Correct",
              description:
                "Every slot has a dedicated database resource. Transactions compete for it. The database guarantees exactly one winner. Always.",
              tag: "Technical Core",
              tagColor: "text-orange-400 bg-orange-500/10 border-orange-500/20",
            },
            {
              icon: <Users className="w-6 h-6 text-purple-400" />,
              title: "Fair Allocation Engine",
              description:
                "Waitlist ranked by reliability, wait time, cancellation quality, and usage balance. Every decision explained in plain English.",
              tag: "Innovation",
              tagColor: "text-purple-400 bg-purple-500/10 border-purple-500/20",
            },
            {
              icon: <BarChart3 className="w-6 h-6 text-emerald-400" />,
              title: "Predictive Intelligence",
              description:
                "Demand forecasting turns into actionable admin recommendations. Not just charts — specific operational decisions.",
              tag: "Intelligence",
              tagColor: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
            },
          ].map((f) => (
            <div key={f.title} className="card hover:border-white/20 transition-all group">
              <div className="mb-4">{f.icon}</div>
              <span
                className={`inline-block px-2 py-0.5 rounded-md text-xs font-medium border mb-3 ${f.tagColor}`}
              >
                {f.tag}
              </span>
              <h3 className="text-lg font-bold mb-2">{f.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Facilities */}
      <section className="relative z-10 max-w-6xl mx-auto px-8 py-12">
        <h2 className="text-3xl font-bold text-center mb-12">Facilities on Platform</h2>
        <div className="flex flex-wrap justify-center gap-4">
          {[
            { icon: "🏸", name: "Badminton Court A" },
            { icon: "🏸", name: "Badminton Court B" },
            { icon: "🎾", name: "Tennis Court" },
            { icon: "⚽", name: "Football Field" },
            { icon: "🏋️", name: "Gymnasium" },
          ].map((f) => (
            <div
              key={f.name}
              className="flex items-center gap-3 px-6 py-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all"
            >
              <span className="text-2xl">{f.icon}</span>
              <span className="font-medium">{f.name}</span>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 max-w-4xl mx-auto px-8 py-20 text-center">
        <div className="card-elevated rounded-3xl p-12 border border-purple-500/20">
          <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
          <h2 className="text-4xl font-black mb-4">
            Ready to book?
          </h2>
          <p className="text-slate-400 mb-8 text-lg">
            Login with your IITG roll number and start booking.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl gradient-brand text-white font-bold text-lg hover:opacity-90 transition-all hover:scale-105"
          >
            Sign In with Roll Number
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 py-8 text-center text-slate-500 text-sm">
        <p>FIELDLOCK · IIT Guwahati · PLAYHACK 2024 · Sports Board × Tech Board</p>
        <div className="flex items-center justify-center gap-2 mt-2">
          <Clock className="w-3 h-3" />
          <span>Built for real facility management, not just demos.</span>
        </div>
      </footer>
    </main>
  );
}
