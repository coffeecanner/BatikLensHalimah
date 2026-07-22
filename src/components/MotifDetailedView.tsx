import { useState, useEffect } from "react";
import { X, MapPin, Briefcase, RefreshCw } from "lucide-react";
import { DataMotifBatikKaggleModel, HasilPrediksiMotifBatikModel, DataGambarMotifBatikModel } from "../types";

interface MotifDetailedViewProps {
  motif: DataMotifBatikKaggleModel;
  onClose: () => void;
  uploadedImage?: string | null;
}

const getCleanMotifName = (rawName: string): string => {
  if (!rawName) return "";
  const firstUnderscoreIdx = rawName.indexOf("_");
  let motifOnly = firstUnderscoreIdx !== -1 ? rawName.slice(firstUnderscoreIdx + 1) : rawName;
  motifOnly = motifOnly.replace(/_/g, " ").trim();
  return motifOnly.replace(/\s+/g, " ");
};

export default function MotifDetailedView({ motif, onClose, uploadedImage }: MotifDetailedViewProps) {
  const [predictionHistory, setPredictionHistory] = useState<HasilPrediksiMotifBatikModel[]>([]);
  const [dataGambarList, setDataGambarList] = useState<DataGambarMotifBatikModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedGalleryImage, setSelectedGalleryImage] = useState<string>("");

  // Parse contoh_gambar gallery URLs dari database Kaggle
  let imageGallery: string[] = [];
  try {
    imageGallery = JSON.parse(motif.contoh_gambar || "[]");
  } catch (e) {
    if (motif.contoh_gambar) {
      imageGallery = motif.contoh_gambar.split(",").map(url => url.trim());
    }
  }

  // Auto-select gambar utama
  useEffect(() => {
    setSelectedGalleryImage(uploadedImage || (imageGallery.length > 0 ? imageGallery[0] : ""));
  }, [motif, uploadedImage]);

  // Fetch data histori dan gambar
  useEffect(() => {
    const fetchHistoryData = async () => {
      setIsLoading(true);
      try {
        const token = localStorage.getItem("token") || "";
        const headers = { "Authorization": `Bearer ${token}` };

        const [resHP, resDG] = await Promise.all([
          fetch("/api/hasil_prediksi", { headers }),
          fetch("/api/data_gambar_motif_batik", { headers })
        ]);

        if (resHP.ok && resDG.ok) {
          const hpDataObj: HasilPrediksiMotifBatikModel[] = await resHP.json();
          const dgDataObj: DataGambarMotifBatikModel[] = await resDG.json();

          const filteredHP = hpDataObj.filter((item) => item.motif_id === motif.id);
          setPredictionHistory(filteredHP);
          setDataGambarList(dgDataObj);
        }
      } catch (err) {
        console.error("Gagal menjaring dependensi histori audit motif", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistoryData();
  }, [motif]);

  // Helper untuk mencari gambar
  const getImageForPrediction = (hp: any): string => {
    const gambarId = hp.data_gambar_id || hp.gambar_id; 
    const record = dataGambarList.find((g) => g.id === gambarId);
    return record ? record.file_foto_batik : "";
  };

  return (
    <div id="motif-detailed-modal-backdrop" className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div 
        id="motif-detailed-container" 
        className="bg-white border border-slate-200 rounded-3xl w-full max-w-5xl overflow-hidden shadow-2xl flex flex-col md:flex-row max-h-[90vh] text-slate-800 animate-fade-in"
      >
        {/* PANE KIRI: Penampil Gambar (Gaya Produk Shopee) */}
        <div className="w-full md:w-5/12 bg-slate-50 p-6 flex flex-col justify-start border-r border-slate-200 overflow-y-auto">
          <div className="text-left">
            <span className="text-[10px] tracking-widest uppercase font-mono font-bold text-indigo-650 block mb-2">
              Galeri Motif Batik
            </span>
            
            {/* 1. Gambar Utama yang Besar */}
            <div className="w-full aspect-square rounded-2xl overflow-hidden border border-slate-200 bg-white flex items-center justify-center shadow-inner relative mb-3">
              {selectedGalleryImage ? (
                <img 
                  src={selectedGalleryImage} 
                  alt="Motif Zoom View" 
                  className="w-full h-full object-cover transition-all duration-300" 
                />
              ) : (
                <div className="text-slate-400 text-xs">Tidak ada gambar</div>
              )}
            </div>
            
            {/* 2. Carousel Thumbnail di Bawah (Kaggle + Histori) */}
            <div className="flex overflow-x-auto space-x-2 pb-2 scrollbar-thin scrollbar-thumb-slate-300 snap-x">
              
              {/* Thumbnail 1: Gambar Scan Saat Ini (Jika ada) */}
              {uploadedImage && (
                <div className="relative flex-shrink-0 snap-start">
                  <img 
                    src={uploadedImage} 
                    onClick={() => setSelectedGalleryImage(uploadedImage)}
                    className={`w-16 h-16 object-cover rounded-xl cursor-pointer border-2 transition-all ${
                      selectedGalleryImage === uploadedImage ? 'border-indigo-600 scale-105 shadow-md' : 'border-transparent opacity-60 hover:opacity-100'
                    }`}
                    title="Gambar yang baru dipindai"
                  />
                  <span className="absolute bottom-1 right-1 bg-indigo-600 text-white text-[8px] font-bold px-1 rounded">NEW</span>
                </div>
              )}

              {/* Thumbnail 2: Gambar Referensi dari Master Kaggle */}
              {imageGallery.map((url, index) => (
                <div key={`kaggle-${index}`} className="relative flex-shrink-0 snap-start">
                  <img
                    src={url}
                    onClick={() => setSelectedGalleryImage(url)}
                    className={`w-16 h-16 object-cover rounded-xl cursor-pointer border-2 transition-all ${
                      selectedGalleryImage === url ? "border-indigo-600 scale-105 shadow-md" : "border-transparent opacity-60 hover:opacity-100"
                    }`}
                    title={`Referensi Asli #${index + 1}`}
                  />
                  <span className="absolute bottom-1 right-1 bg-slate-800/70 text-white text-[8px] font-bold px-1 rounded">REF</span>
                </div>
              ))}

              {/* Thumbnail 3: Gambar dari Histori Inferensi (Hindari duplikat gambar scan saat ini) */}
              {predictionHistory.map(hp => {
                const imgBase64 = getImageForPrediction(hp);
                if (!imgBase64 || imgBase64 === uploadedImage) return null;
                
                return (
                  <div key={`hist-${hp.id}`} className="relative flex-shrink-0 snap-start">
                    <img 
                      src={imgBase64} 
                      onClick={() => setSelectedGalleryImage(imgBase64)}
                      className={`w-16 h-16 object-cover rounded-xl cursor-pointer border-2 transition-all ${
                        selectedGalleryImage === imgBase64 ? 'border-indigo-600 scale-105 shadow-md' : 'border-transparent opacity-60 hover:opacity-100'
                      }`}
                      title={`Histori Inferensi #${hp.id}`}
                    />
                  </div>
                );
              })}

            </div>
          </div>

          <div className="mt-auto pt-4 border-t border-slate-200 text-left">
            <span className="text-[10px] uppercase text-slate-450 block font-mono">Spesifikasi Ragam Hias</span>
            <div className="mt-2 text-xs font-serif text-slate-500 flex items-center space-x-1.5 justify-start">
              <span>BatikLens Halimah Core v1.4.0</span>
            </div>
          </div>
        </div>

        {/* PANE KANAN: Informasi & Tabel Histori */}
        <div id="detailed-info-pane" className="w-full md:w-7/12 p-6 flex flex-col justify-between overflow-y-auto bg-white text-slate-700 font-sans">
          <div>
            {/* Header Modal */}
            <div className="flex justify-between items-start mb-6 pb-4 border-b border-slate-200 text-left">
              <div>
                <h2 className="text-2xl font-bold font-serif text-slate-900 tracking-tight">{getCleanMotifName(motif.nama_motif)}</h2>
                <div className="flex flex-wrap gap-2 mt-1.5">
                  <span className="inline-flex items-center space-x-1 p-0.5 px-2.5 bg-indigo-50 rounded-full text-[10px] text-indigo-700 font-semibold border border-indigo-100/60">
                    <MapPin className="w-3 h-3 text-indigo-600" />
                    <span>Asal: {motif.asal_daerah}</span>
                  </span>
                  <span className="inline-flex items-center space-x-1 p-0.5 px-2.5 bg-slate-100 rounded-full text-[10px] text-slate-650 font-semibold border border-slate-200">
                    <Briefcase className="w-3 h-3 text-slate-500" />
                    <span>Rekomendasi Acara: {motif.occasion}</span>
                  </span>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Makna Filosofis */}
            <div className="mb-6 text-left">
              <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-600 mb-2 font-display">Tinjauan Makna Filosofis</h3>
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl leading-relaxed text-xs text-slate-600 font-sans">
                {motif.makna_filosofis}
              </div>
            </div>

            {/* Tabel Histori Log Saja */}
            <div className="text-left">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 font-display">Histori audit pengujian kecerdasan buatan</h3>
                <span className="text-[10px] text-slate-450 font-mono">{predictionHistory.length} Log Teridentifikasi</span>
              </div>

              {isLoading ? (
                <div className="p-8 text-center text-xs text-slate-400 flex items-center justify-center space-x-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-indigo-650" />
                  <span>Mengumpulkan database audit motif...</span>
                </div>
              ) : predictionHistory.length === 0 ? (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-center text-xs text-slate-400">
                  Belum ada catatan aktivitas identifikasi kecerdasan buatan untuk motif {getCleanMotifName(motif.nama_motif)}.
                </div>
              ) : (
                <div className="max-h-[200px] overflow-y-auto border border-slate-200 rounded-2xl overflow-hidden bg-slate-50/50 scrollbar-thin scrollbar-thumb-slate-300">
                  <table className="w-full text-left text-xs text-slate-800">
                    <thead className="bg-slate-100 border-b border-slate-200 text-[10px] text-slate-500 uppercase tracking-wider font-semibold sticky top-0 z-10">
                      <tr>
                        <th className="p-3">ID</th>
                        <th className="p-3">Tanggal Identifikasi</th>
                        <th className="p-3 text-right">Akurasi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {predictionHistory.map((hp) => (
                        <tr 
                          key={hp.id} 
                          onClick={() => {
                            const imgBase64 = getImageForPrediction(hp);
                            if (imgBase64) setSelectedGalleryImage(imgBase64);
                          }}
                          className="hover:bg-indigo-50 transition-colors cursor-pointer"
                          title="Klik baris ini untuk melihat foto di galeri utama"
                        >
                          <td className="p-3 font-mono text-[10px] text-slate-500 font-bold">
                            #{hp.id}
                          </td>
                          <td className="p-3 font-mono text-[10px] text-slate-600">
                            {new Date(hp.tanggal_prediksi).toLocaleString("id-ID", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit"
                            })}
                          </td>
                          <td className="p-3 text-right font-mono text-indigo-650 font-bold">
                            {(hp.akurasi_utama * 100).toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-200 flex justify-end">
            <button
              onClick={onClose}
              className="p-2.5 px-6 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-500 hover:shadow-lg hover:shadow-indigo-950/20 active:scale-95 transition-all cursor-pointer"
            >
              Selesai Membaca
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}