import React, { useMemo } from "react";
import { Info } from "lucide-react";
import { HasilPrediksiMotifBatikModel, DataMotifBatikKaggleModel, DataGambarMotifBatikModel } from "../types";

interface DashboardStatsProps {
  hasilPrediksiList: HasilPrediksiMotifBatikModel[];
  dataMotifList: DataMotifBatikKaggleModel[];
  dataGambarList: DataGambarMotifBatikModel[];
}

export default function DashboardStats({ hasilPrediksiList, dataMotifList, dataGambarList }: DashboardStatsProps) {
  const getCleanMotifName = (rawName: string) => {
    const underScoreIdx = rawName.indexOf("_");
    return underScoreIdx !== -1 ? rawName.slice(underScoreIdx + 1) : rawName;
  };

  // 1. Calculate Average Top-1 Accuracy
  const avgAccuracy = useMemo(() => {
    if (hasilPrediksiList.length === 0) return 0;
    const total = hasilPrediksiList.reduce((acc, hp) => acc + hp.akurasi_utama, 0);
    return total / hasilPrediksiList.length;
  }, [hasilPrediksiList]);

  // 2. Scan Frequencies (Top 10)
  const scanFreqs = useMemo(() => {
    const counts: Record<string, number> = {};
    hasilPrediksiList.forEach(hp => {
      const motif = getCleanMotifName(hp.prediksi_utama);
      counts[motif] = (counts[motif] || 0) + 1;
    });

    const arr = Object.keys(counts).map(k => ({ name: k, count: counts[k] }));
    arr.sort((a,b) => b.count - a.count);

    const total = hasilPrediksiList.length;
    let topN = arr.slice(0, 10);
    const othersCount = arr.slice(10).reduce((acc, obj) => acc + obj.count, 0);
    if(othersCount > 0) {
       topN.push({ name: "Lain-lain", count: othersCount });
    } else if (arr.length === 0) {
       return [];
    } else {
       topN = arr;
    }
    
    return topN.map(item => ({
      ...item,
      percentage: total > 0 ? (item.count / total) * 100 : 0
    }));
  }, [hasilPrediksiList]);

  // 3. Geographic Distribution based on dataMotifList
  const geoStats = useMemo(() => {
    const counts: Record<string, number> = {};
    dataMotifList.forEach(m => {
       counts[m.asal_daerah] = (counts[m.asal_daerah] || 0) + 1;
    });
    const arr = Object.keys(counts).map(k => ({ name: k, count: counts[k] }));
    arr.sort((a,b) => b.count - a.count);
    return arr.slice(0, 4).map(item => ({
      ...item,
      percentage: dataMotifList.length > 0 ? (item.count / dataMotifList.length) * 100 : 0
    }));
  }, [dataMotifList]);

  // 4. Get 3 most recent scans
  const recentScans = useMemo(() => {
    return [...hasilPrediksiList]
      .sort((a, b) => b.id - a.id)
      .slice(0, 3);
  }, [hasilPrediksiList]);

  const dashoffset = Math.PI * 2 * 60 * (1 - avgAccuracy);
  const colors = ["bg-indigo-600", "bg-indigo-500", "bg-violet-500", "bg-slate-400"];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Column 1: Stack of Gauge and Recent Activity */}
      <div className="lg:col-span-1 space-y-6 flex flex-col justify-between">
        {/* Infographic Card 1: Model Accuracy Gauge */}
        <div className="p-6 bg-white border border-slate-200/90 rounded-3xl shadow-sm text-left flex flex-col justify-between space-y-4 w-full flex-1">
          <div>
            <span className="text-[10px] uppercase text-indigo-600 font-bold tracking-widest">Rata-rata Akurasi</span>
            <h4 className="text-sm font-bold text-slate-800 mt-1">Akurasi Sistem</h4>
          </div>
          
          <div className="relative flex items-center justify-center p-2">
            <svg className="w-32 h-32 transform -rotate-90">
              <circle cx="64" cy="64" r="52" stroke="#f1f5f9" strokeWidth="8" fill="transparent" />
              <circle cx="64" cy="64" r="52" stroke="#4f46e5" strokeWidth="8" fill="transparent" strokeDasharray={Math.PI * 2 * 52} strokeDashoffset={isNaN(dashoffset) ? 0 : Math.PI * 2 * 52 * (1 - avgAccuracy)} strokeLinecap="round" className="transition-all duration-1000" />
            </svg>
            <div className="absolute text-center">
              <span className="text-2xl font-black text-slate-800">{(avgAccuracy * 100).toFixed(1)}%</span>
              <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-bold">Kecocokan Pola</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-center text-xs border-t border-slate-100 pt-4">
            <div className="border-r border-slate-100">
               <span className="text-[9px] uppercase text-slate-400 block font-semibold">Koleksi Motif</span>
               <strong className="text-sm font-bold text-slate-700">{dataMotifList.length} Motif</strong>
            </div>
            <div>
               <span className="text-[9px] uppercase text-slate-400 block font-semibold">Total Pemindaian</span>
               <strong className="text-sm font-bold text-indigo-600">{hasilPrediksiList.length} Scan</strong>
            </div>
          </div>
        </div>

        {/* Infographic Card 1.5: Recent Activity Log */}
        <div className="p-6 bg-white border border-slate-200/90 rounded-3xl shadow-sm text-left flex flex-col space-y-4 w-full">
          <div>
            <span className="text-[10px] uppercase text-indigo-600 font-bold tracking-widest">Aktivitas Terkini</span>
            <h4 className="text-sm font-bold text-slate-800 mt-1">Pemindaian Terbaru</h4>
          </div>

          <div className="divide-y divide-slate-100 flex-1 flex flex-col justify-center">
            {recentScans.map((hp) => {
              const matchedImg = dataGambarList.find((g) => g.id === hp.gambar_id);
              const imgUrl = matchedImg?.file_foto_batik || "https://images.unsplash.com/photo-1528459801416-a9e53bbf4e17?w=80";
              
              return (
                <div key={hp.id} className="py-2.5 flex items-center justify-between first:pt-0 last:pb-0 hover:bg-slate-50/40 rounded-xl px-1 transition-colors">
                  <div className="flex items-center space-x-3">
                    <img 
                      src={imgUrl} 
                      alt={hp.prediksi_utama} 
                      className="w-10 h-10 object-cover rounded-xl border border-slate-100 shadow-sm"
                    />
                    <div>
                      <h5 className="text-xs font-bold text-slate-800 leading-tight">{getCleanMotifName(hp.prediksi_utama)}</h5>
                      <span className="text-[9px] text-slate-400 block font-mono mt-0.5">
                        {new Date(hp.tanggal_prediksi).toLocaleDateString("id-ID", {
                          day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
                        })}
                      </span>
                    </div>
                  </div>
                  
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${
                    hp.akurasi_utama > 0.85 
                      ? "bg-emerald-50 text-emerald-700 border-emerald-100" 
                      : "bg-amber-50 text-amber-700 border-amber-100"
                  }`}>
                    {(hp.akurasi_utama * 100).toFixed(1)}%
                  </span>
                </div>
              );
            })}
            {recentScans.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-4">Belum ada aktivitas pemindaian.</p>
            )}
          </div>
        </div>
      </div>

      {/* Infographic Card 2: Peak Hours & Scans Frequency */}
      <div className="p-6 bg-white border border-slate-200/90 rounded-3xl shadow-sm text-left flex flex-col justify-between space-y-4 lg:col-span-2">
        <div>
          <span className="text-[10px] uppercase text-indigo-600 font-bold tracking-widest font-mono">Visual Analytics</span>
          <h4 className="text-sm font-bold text-slate-800 mt-1">Identifikasi Motif Terbanyak (Top 10)</h4>
        </div>

        <div className="space-y-3.5 flex-1 flex flex-col justify-center">
          {scanFreqs.map((sf, idx) => (
             <div key={sf.name}>
                <div className="flex justify-between items-center text-xs mb-1">
                  <span className="font-semibold text-slate-700">{sf.name}</span>
                  <span className="font-mono text-slate-500 font-bold">{sf.count} Scans ({sf.percentage.toFixed(1)}%)</span>
                </div>
                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                  <div className={`${colors[idx % colors.length]} h-full rounded-full transition-all duration-1000`} style={{ width: `${sf.percentage}%` }}></div>
                </div>
             </div>
          ))}
          {scanFreqs.length === 0 && (
            <p className="text-xs text-slate-400 text-center py-4">Belum ada kompilasi pemindaian yang terbentuk.</p>
          )}
        </div>

        <div className="flex items-center space-x-2 text-[10px] text-slate-400 border-t border-slate-100 pt-3">
          <Info className="w-3.5 h-3.5 text-indigo-500" />
          <span>Statistik distribusi diperbarui secara dinamis mengikuti interaksi pengguna.</span>
        </div>
      </div>

      {/* Infographic Card 3: Geolocation Origin Distribution */}
      <div className="p-6 bg-white border border-slate-200/90 rounded-3xl shadow-sm text-left lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
        <div className="space-y-2">
          <span className="text-[10px] uppercase text-indigo-600 font-bold tracking-widest font-mono">Geographic Distribution</span>
          <h4 className="text-base font-bold text-slate-800 leading-tight">Representasi Asal Daerah Ragam Motif Batik</h4>
          <p className="text-xs text-slate-500 leading-relaxed">
            Jumlah koleksi motif batik Nusantara yang terdaftar dalam database di sistem kami.
          </p>
        </div>

        <div className="col-span-2 grid grid-cols-2 md:grid-cols-4 gap-4">
          {geoStats.map(stat => (
            <div key={stat.name} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
              <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-bold font-mono truncate">{stat.name}</span>
              <strong className="text-lg font-black font-serif text-slate-800 block mt-1">{stat.count} Motif</strong>
              <span className="text-[9px] text-indigo-600 block mt-0.5">{stat.percentage.toFixed(1)}% Representasi</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
