import { requireAdmin } from "@/lib/auth-guards";
import Link from "next/link";
import prisma from "@/lib/db";
import { Trophy, Zap, AlertTriangle, CheckCircle, ArrowRight, BarChart3 } from "lucide-react";
import { getFacilityIcon } from "@/lib/utils";

export default async function IntelligencePage() {
  await requireAdmin();

  const predictions = await prisma.demandPrediction.findMany({
    where: {
      predictedDate: { gte: new Date() },
    },
    include: { facility: true },
    orderBy: [{ capacityRatio: "desc" }, { hour: "asc" }],
    take: 20,
  });

  const highDemand = predictions.filter((p) => p.capacityRatio > 1.5);
  const lowDemand = predictions.filter((p) => p.capacityRatio < 0.5);

  return (
    <main className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Top Bar */}
      <div className="border-b border-white/5 px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg gradient-brand flex items-center justify-center">
            <Trophy className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-lg">FIELDLOCK</span>
        </div>
        <nav className="flex items-center gap-6 text-sm">
          <Link href="/admin" className="text-slate-400 hover:text-white transition-colors">Admin Dashboard</Link>
          <Link href="/admin/race-demo" className="text-orange-400 font-medium hover:text-orange-300 transition-colors">⚡ Race Demo</Link>
        </nav>
      </div>

      <div className="max-w-6xl mx-auto px-8 py-8">
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs mb-3">
            <Zap className="w-3.5 h-3.5" />
            AI & Analytics Layer
          </div>
          <h1 className="text-3xl font-black mb-2">Predictive Intelligence Layer</h1>
          <p className="text-slate-400">
            Translating historical demand patterns into actionable facility administrative decisions.
          </p>
        </div>

        {/* Actionable Insights Grid */}
        <div className="grid md:grid-cols-2 gap-6 mb-10">
          {/* Overcapacity Warnings */}
          <div className="card border-orange-500/30 bg-orange-500/5">
            <h2 className="text-lg font-bold text-orange-400 mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Predicted Overcapacity Hotspots ({highDemand.length})
            </h2>
            {highDemand.length === 0 ? (
              <p className="text-sm text-slate-500">No major capacity bottlenecks predicted.</p>
            ) : (
              <div className="space-y-3">
                {highDemand.map((item) => (
                  <div key={item.id} className="p-3.5 rounded-xl bg-[#13131a] border border-orange-500/20">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-semibold text-sm flex items-center gap-2">
                        {getFacilityIcon(item.facility.type)} {item.facility.name}
                      </span>
                      <span className="text-xs font-mono font-bold text-orange-400">
                        {item.capacityRatio.toFixed(1)}× Capacity
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Peak hour: <span className="text-slate-200 font-mono">{item.hour}:00</span> · Expected demand: {item.predictedDemand} requests
                    </p>
                    {item.recommendation && (
                      <p className="text-xs text-orange-300/90 mt-2 bg-orange-500/10 p-2 rounded-lg border border-orange-500/20">
                        💡 {item.recommendation}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Underutilization Opportunities */}
          <div className="card border-blue-500/30 bg-blue-500/5">
            <h2 className="text-lg font-bold text-blue-400 mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Underutilized Capacity ({lowDemand.length})
            </h2>
            {lowDemand.length === 0 ? (
              <p className="text-sm text-slate-500">No underutilized slots identified.</p>
            ) : (
              <div className="space-y-3">
                {lowDemand.map((item) => (
                  <div key={item.id} className="p-3.5 rounded-xl bg-[#13131a] border border-blue-500/20">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-semibold text-sm flex items-center gap-2">
                        {getFacilityIcon(item.facility.type)} {item.facility.name}
                      </span>
                      <span className="text-xs font-mono font-bold text-blue-400">
                        {Math.round(item.capacityRatio * 100)}% Occupancy
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Off-peak hour: <span className="text-slate-200 font-mono">{item.hour}:00</span>
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
