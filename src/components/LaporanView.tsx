import React, { useState, useMemo } from "react";
import { HasilPrediksiMotifBatikModel, DataMotifBatikKaggleModel, PegawaiModel } from "../types";
import { FileSpreadsheet, Download, RefreshCw, BarChart2 } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface LaporanViewProps {
  hasilPrediksiList: HasilPrediksiMotifBatikModel[];
  dataMotifList: DataMotifBatikKaggleModel[];
  pegawaiList: PegawaiModel[];
}

export default function LaporanView({ hasilPrediksiList, dataMotifList, pegawaiList }: LaporanViewProps) {
  const [filterMonth, setFilterMonth] = useState<string>("ALL");

  const getCleanMotifName = (rawName: string) => {
    const underScoreIdx = rawName.indexOf("_");
    return underScoreIdx !== -1 ? rawName.slice(underScoreIdx + 1) : rawName;
  };

  // Group by Month (YYYY-MM Format)
  const uniqueMonths = useMemo(() => {
    const months = new Set<string>();
    hasilPrediksiList.forEach(hp => {
      const date = new Date(hp.tanggal_prediksi);
      const mm = (date.getMonth() + 1).toString().padStart(2, "0");
      const yyyy = date.getFullYear();
      months.add(`${yyyy}-${mm}`);
    });
    return Array.from(months).sort((a,b) => b.localeCompare(a));
  }, [hasilPrediksiList]);

  // Filtered dataset
  const filteredData = useMemo(() => {
    if (filterMonth === "ALL") return hasilPrediksiList;
    return hasilPrediksiList.filter(hp => {
      const date = new Date(hp.tanggal_prediksi);
      const mm = (date.getMonth() + 1).toString().padStart(2, "0");
      const yyyy = date.getFullYear();
      return `${yyyy}-${mm}` === filterMonth;
    });
  }, [filterMonth, hasilPrediksiList]);

  // Pie chart aggregation
  const chartData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredData.forEach(hp => {
      const motifLabel = getCleanMotifName(hp.prediksi_utama);
      counts[motifLabel] = (counts[motifLabel] || 0) + 1;
    });

    const output = Object.keys(counts).map(motif => ({
      name: motif,
      value: counts[motif]
    })).sort((a,b) => b.value - a.value);

    // Group anything past top 5 into "Others"
    if (output.length > 5) {
      const top5 = output.slice(0, 5);
      const othersVal = output.slice(5).reduce((acc, obj) => acc + obj.value, 0);
      top5.push({ name: "Lainnya", value: othersVal });
      return top5;
    }

    return output;
  }, [filteredData]);

  const COLORS = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#64748b'];

  const exportCSV = () => {
    const headers = "ID Log,Tanggal,Motif Utama,Akurasi,Staff\n";
    const rows = filteredData.map(hp => {
      const dt = new Date(hp.tanggal_prediksi).toLocaleString("id-ID");
      const motif = getCleanMotifName(hp.prediksi_utama);
      const staffInfo = pegawaiList.find(p => p.id === hp.pegawai_id);
      const staffName = staffInfo ? staffInfo.nama_pegawai : "System";
      return `PRD-${hp.id},"${dt}","${motif}",${(hp.akurasi_utama*100).toFixed(1)}%,"${staffName}"`;
    }).join("\n");
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `laporan_batiklens_${filterMonth}.csv`;
    a.click();
  };

  return (
    <div id="view-laporan" className="space-y-6 text-left animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Laporan</h2>
          <p className="text-xs text-slate-500 font-sans">
            Analisis lengkap seluruh pengujian mesin inferensi dengan opsi cetak dan eksportasi.
          </p>
        </div>
        
        <div className="flex space-x-2">
          <select 
            value={filterMonth}
            onChange={e => setFilterMonth(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-200 text-slate-700 text-xs rounded-xl focus:outline-none focus:border-indigo-500 cursor-pointer transition-colors hover:border-slate-350"
          >
            <option value="ALL">Semua Waktu</option>
            {uniqueMonths.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <button 
            onClick={exportCSV}
            className="p-2 px-4 bg-emerald-600 text-white rounded-xl text-xs font-semibold flex items-center space-x-1.5 hover:bg-emerald-500 hover:shadow-lg hover:shadow-emerald-950/20 active:scale-95 transition-all font-sans cursor-pointer shadow-sm"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Ekspor CSV</span>
          </button>
          <button 
            onClick={() => window.print()}
            className="p-2 px-4 bg-indigo-600 text-white rounded-xl text-xs font-semibold flex items-center space-x-1.5 hover:bg-indigo-500 hover:shadow-lg hover:shadow-indigo-950/20 active:scale-95 transition-all font-sans cursor-pointer shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Cetak PDF</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col">
          <h3 className="text-[10px] uppercase text-slate-500 tracking-widest font-mono font-bold mb-4">Sebaran Motif Terdeteksi</h3>
          <div className="flex-1 h-64">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%" cy="50%"
                    innerRadius={60} outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
               <div className="h-full flex items-center justify-center text-xs text-slate-400">Tidak ada data untuk bulan ini</div>
            )}
          </div>
        </div>

        <div className="md:col-span-2 bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm flex flex-col">
          <div className="p-4 border-b border-slate-100 bg-slate-50">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest flex items-center space-x-1">
              <BarChart2 className="w-4 h-4 text-indigo-600" />
              <span>Detail Riwayat Pemindaian ({filteredData.length})</span>
            </h3>
          </div>
          <div className="overflow-x-auto flex-1 max-h-[400px]">
            <table className="w-full text-left text-xs text-slate-800 table-auto">
              <thead className="bg-slate-50/50 sticky top-0 border-b border-slate-200 text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="p-3.5">ID Log</th>
                  <th className="p-3.5">Tanggal</th>
                  <th className="p-3.5">Hasil (Top-1)</th>
                  <th className="p-3.5">Akurasi</th>
                  <th className="p-3.5">Staff Entry</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredData.map(hp => {
                   const staffInfo = pegawaiList.find(p => p.id === hp.pegawai_id);
                   const staffName = staffInfo ? staffInfo.nama_pegawai : "System/Admin";
                   return (
                    <tr key={hp.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-3.5 text-indigo-650 font-semibold font-mono">#PRD-{hp.id}</td>
                      <td className="p-3.5 text-slate-500 font-mono">
                        {new Date(hp.tanggal_prediksi).toLocaleDateString("id-ID", {
                          day: "numeric", month: "long", year: "numeric",
                          hour: "2-digit", minute: "2-digit"
                        })}
                      </td>
                      <td className="p-3.5 font-bold text-slate-800">{getCleanMotifName(hp.prediksi_utama)}</td>
                      <td className="p-3.5">
                        <span className={`p-1 px-2 rounded-md font-semibold border ${
                          hp.akurasi_utama > 0.85 ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-amber-50 text-amber-700 border-amber-100"
                        }`}>
                          {(hp.akurasi_utama * 100).toFixed(1)}%
                        </span>
                      </td>
                      <td className="p-3.5 text-slate-600">{staffName}</td>
                    </tr>
                   );
                })}
                {filteredData.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-xs text-slate-400">Belum ada pemindaian tercatat pada periode ini.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
