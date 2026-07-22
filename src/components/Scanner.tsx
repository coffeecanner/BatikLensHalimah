import React, { useState, useRef, useEffect } from "react";
import { Camera, Upload, RefreshCw, AlertCircle, Cpu, Check, HelpCircle } from "lucide-react";
import { User, DataMotifBatikKaggleModel } from "../types";

interface ScannerProps {
  user: User | null;
  onPredictionComplete: (predictionData: any, motifData: DataMotifBatikKaggleModel) => void;
  onScanLogged?: () => void;
}

const getCleanMotifName = (rawName: string): string => {
  if (!rawName) return "";
  const firstUnderscoreIdx = rawName.indexOf("_");
  let motifOnly = firstUnderscoreIdx !== -1 ? rawName.slice(firstUnderscoreIdx + 1) : rawName;
  motifOnly = motifOnly.replace(/_/g, " ").trim();
  return motifOnly.replace(/\s+/g, " ");
};

export default function Scanner({ user, onPredictionComplete, onScanLogged }: ScannerProps) {
  const [dragActive, setDragActive] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<any | null>(null);
  const [associatedMotif, setAssociatedMotif] = useState<DataMotifBatikKaggleModel | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  // Stop camera stream on unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  // Drag and Drop Events
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setApiError("Hanya file gambar yang didukung!");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setImage(reader.result as string);
      setApiError(null);
      setSuccessResult(null);
    };
    reader.readAsDataURL(file);
  };

  // Webcam Handlers
  const startCamera = async () => {
    try {
      setApiError(null);
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 640, height: 480, facingMode: "environment" } 
      });
      setStream(mediaStream);
      setIsCameraActive(true);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err: any) {
      setApiError("Gagal mengakses kamera. Verifikasi izin kamera perangkat Anda.");
      console.error(err);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      
      canvas.width = 224; // Strict requirement for LeViT 224x224 input crop preprocessing
      canvas.height = 224;
      
      if (ctx) {
        // Source crop to ensure central square aspect ratio
        const size = Math.min(video.videoWidth, video.videoHeight);
        const xOffset = (video.videoWidth - size) / 2;
        const yOffset = (video.videoHeight - size) / 2;
        
        ctx.drawImage(video, xOffset, yOffset, size, size, 0, 0, 224, 224);
        const base64Img = canvas.toDataURL("image/jpeg");
        setImage(base64Img);
        stopCamera();
      }
    }
  };

  // Run Real-Time classification on Express Backend
  const triggerInference = async () => {
    if (!image) return;
    setIsAnalyzing(true);
    setApiError(null);
    setSuccessResult(null);

    try {
      const response = await fetch("/api/predict", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token") || ""}`
        },
        body: JSON.stringify({ image })
      });

      if (!response.ok) {
        let message = "Gagal memperoleh prediksi dari motor AI.";
        try {
          const errorResult = await response.json();
          message = errorResult.message || message;
        } catch {
          // Keep generic message when the server response is not JSON.
        }
        onScanLogged?.();
        throw new Error(message);
      }

      const result = await response.json();
      if (result.success) {
        setSuccessResult(result.prediction);
        setAssociatedMotif(result.data_motif);
        onPredictionComplete(result.prediction, result.data_motif);
        onScanLogged?.();
      } else {
        throw new Error(result.message || "Prediksi model gagal.");
      }
    } catch (err: any) {
      setApiError(err.message || "Koneksi ke backend bermasalah.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div id="scanner-widget-container" className="bg-white border border-slate-200/90 rounded-3xl overflow-hidden p-6 shadow-sm text-slate-700 font-sans">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-lg font-bold text-slate-900 font-display">BatikLens Scanner</h2>
          <p className="text-xs text-slate-500">Unggah foto motif batik untuk mendeteksi filosofinya otomatis.</p>
        </div>
        <div className="flex items-center space-x-2">
          <span className="p-1 px-2.5 bg-indigo-50 rounded-lg border border-indigo-100 text-[10px] text-indigo-700 font-mono tracking-wider font-semibold">
            READY: LeViT_224_NORM
          </span>
        </div>
      </div>

      {apiError && (
        <div id="ai-status-error" className="mb-4 bg-rose-50 border border-rose-100 rounded-2xl p-3.5 flex items-start space-x-3 text-rose-700 text-xs text-left">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{apiError}</span>
        </div>
      )}

      {/* Main stage area */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <div 
            id="drop-target-area"
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            className={`relative min-h-[300px] border-2 border-dashed rounded-2xl flex flex-col items-center justify-center p-6 text-center transition-all ${
              dragActive ? "border-indigo-500 bg-indigo-50/30" : "border-slate-200 hover:border-slate-300"
            }`}
          >
            {/* Camera viewport or Upload indicator */}
            {isCameraActive ? (
              <div className="w-full h-full absolute inset-0 rounded-2xl overflow-hidden bg-black flex items-center justify-center">
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  muted 
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-4 left-0 right-0 flex justify-center space-x-3 z-10">
                  <button 
                    onClick={capturePhoto}
                    className="p-3 bg-indigo-600 text-white rounded-full font-bold shadow-lg hover:scale-105 transition-transform"
                    id="btn-capture-snapshot"
                  >
                    Ambil Foto
                  </button>
                  <button 
                    onClick={stopCamera}
                    className="p-3 bg-slate-850 text-white rounded-full text-xs hover:bg-slate-700 transition-colors"
                    id="btn-cancel-camera"
                  >
                    Batal
                  </button>
                </div>
              </div>
            ) : image ? (
              <div className="relative group w-full max-w-[260px] aspect-square rounded-2xl overflow-hidden shadow-inner border border-slate-200">
                <img 
                  src={image} 
                  alt="Batik Uploaded Preview" 
                  className="w-full h-full object-cover" 
                />
                
                {/* Visual Scanner laser lines mockup */}
                {isAnalyzing && (
                  <div className="absolute inset-0 z-10 pointer-events-none flex flex-col justify-between">
                    <div className="w-full h-0.5 bg-indigo-500/80 shadow-[0_0_8px_rgba(99,102,241,0.8)] animate-bounce mt-4"></div>
                    <div className="absolute inset-0 bg-indigo-500/5 animate-pulse flex items-center justify-center">
                      <span className="text-[10px] font-mono tracking-widest text-indigo-700 bg-white/95 px-2 py-0.5 rounded border border-indigo-200 font-semibold uppercase animate-pulse">
                        Inference Running
                      </span>
                    </div>
                  </div>
                )}

                <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-3">
                  <button 
                    onClick={() => { setImage(null); setSuccessResult(null); }}
                    className="p-2 bg-rose-600 text-white rounded-lg text-xs hover:bg-rose-500 transition-colors cursor-pointer"
                    id="btn-remove-selected-image"
                  >
                    Hapus
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <div className="w-14 h-14 bg-indigo-50 rounded-full border border-indigo-100 flex items-center justify-center text-indigo-600 mb-4">
                  <Upload className="w-6 h-6" />
                </div>
                <p className="text-xs font-bold text-slate-800 mb-1">Seret media batik ke sini</p>
                <p className="text-[10px] text-slate-500 mb-4">Mendukung PNG, JPEG, atau WEBP hingga 10MB</p>
                
                <div className="flex flex-wrap gap-2 justify-center">
                  <label className="p-2 px-3 bg-indigo-600 text-white rounded-lg text-xs font-semibold cursor-pointer hover:bg-indigo-700 transition-colors">
                    Pilih File
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleFileChange} 
                      className="hidden" 
                    />
                  </label>
                  <button 
                    onClick={startCamera}
                    className="p-2 px-3 bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold flex items-center space-x-1.5 hover:bg-slate-200 transition-colors animate-fade-in"
                    id="btn-trigger-camera"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Pakai Webcam</span>
                  </button>
                </div>
              </div>
            )}
            <canvas ref={canvasRef} className="hidden" />
          </div>
          
          {image && !isAnalyzing && !successResult && (
            <button 
              onClick={triggerInference}
              type="button"
              className="mt-4 w-full p-3 bg-indigo-600 text-white font-bold rounded-xl text-xs flex items-center justify-center space-x-2 hover:bg-indigo-750 shadow-sm transition-all cursor-pointer animate-fade-in"
              id="btn-run-inference"
            >
              <span>Identifikasi Motif Sekarang</span>
            </button>
          )}

          {isAnalyzing && (
            <div className="mt-4 p-3 bg-indigo-50 border border-indigo-100 text-center text-indigo-700 rounded-xl text-xs font-medium flex items-center justify-center space-x-2">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Inference LeViT / PyTorch sedang dievaluasi...</span>
            </div>
          )}
        </div>

        {/* Inference output side */}
        <div className="flex flex-col justify-between animate-fade-in">
          {!successResult ? (
            <div className="bg-slate-50/50 border border-slate-200/80 rounded-2xl p-6 h-full flex flex-col items-center justify-center text-center">
              <HelpCircle className="w-10 h-10 text-slate-300 mb-2.5 animate-pulse" />
              <p className="text-xs font-bold text-slate-600 mb-1">Belum Ada Hasil Identifikasi</p>
              <p className="text-[10px] text-slate-400 max-w-[200px]">Silakan unggah gambar atau gunakan webcam terlebih dahulu untuk mendapatkan prediksi akurasi.</p>
            </div>
          ) : (
            <div id="classification-results" className="bg-slate-50/55 border border-slate-200/90 rounded-2xl p-5 h-full flex flex-col justify-between space-y-4">
              <div>
                <div id="result-header" className="flex justify-between items-center pb-3 border-b border-slate-200 mb-4">
                  <div className="flex items-center space-x-1.5 text-indigo-700">
                    <Cpu className="w-4 h-4 text-indigo-650 animate-pulse" />
                    <span className="text-xs font-bold tracking-wider font-display uppercase">Top Inference Results</span>
                  </div>
                  <span className="text-[10px] bg-emerald-50 text-emerald-700 p-0.5 px-2.5 rounded-full border border-emerald-100 font-bold font-mono">
                    Success
                  </span>
                </div>

                {/* Top-1 prediction block */}
                <div id="top-1-result-card" className="p-4 bg-indigo-50/60 border border-indigo-100/80 rounded-2xl mb-4 text-left">
                  <div className="flex justify-between items-start mb-1">
                    <div>
                      <span className="text-[9px] uppercase tracking-widest text-indigo-600 font-bold">Prediction 1 (Utama)</span>
                      <h3 className="text-base font-bold text-indigo-950 tracking-tight leading-tight font-serif">{getCleanMotifName(successResult.prediction_utama)}</h3>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-500">Confidence Level</span>
                      <p className="text-sm font-bold font-mono text-indigo-700">{(successResult.akurasi_utama * 100).toFixed(1)}%</p>
                    </div>
                  </div>
                  
                  {/* Progress bar visual */}
                  <div className="w-full bg-slate-200 rounded-full h-1.5 mt-2 overflow-hidden">
                    <div 
                      className="bg-indigo-600 h-1.5 rounded-full" 
                      style={{ width: `${successResult.akurasi_utama * 100}%` }}
                    />
                  </div>
                </div>

                {/* Top-2 secondary prediction block */}
                <div id="top-2-result-card" className="p-4 bg-white border border-slate-200 rounded-2xl text-left">
                  <div className="flex justify-between items-start mb-1">
                    <div>
                      <span className="text-[9px] uppercase tracking-widest text-slate-400 font-semibold">Prediction 2 (Sekunder)</span>
                      <h4 className="text-xs font-bold text-slate-800 font-serif">{getCleanMotifName(successResult.prediksi_sekunder)}</h4>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400">Confidence</span>
                      <p className="text-xs font-bold font-mono text-slate-600">{(successResult.akurasi_sekunder * 100).toFixed(1)}%</p>
                    </div>
                  </div>
                  
                  {/* Progress bar visual */}
                  <div className="w-full bg-slate-100 rounded-full h-1 mt-1.5 overflow-hidden">
                    <div 
                      className="bg-slate-450 h-1 rounded-full" 
                      style={{ width: `${successResult.akurasi_sekunder * 100}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Related metadata snippet */}
              {associatedMotif && (
                <div id="snippet-metadata-card" className="p-4 bg-white border border-slate-200 rounded-2xl text-left">
                  <span className="text-[9px] uppercase tracking-widest text-indigo-600 font-bold block mb-1">Kaggle Metadata Reference</span>
                  <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Asal Daerah</span>
                      <span className="font-bold text-slate-800">{associatedMotif.asal_daerah}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Penggunaan Acara</span>
                      <span className="font-bold text-slate-800 truncate block">{associatedMotif.occasion}</span>
                    </div>
                  </div>
                  <p className="text-[10px] leading-relaxed text-slate-500 line-clamp-2 border-t border-slate-100 pt-1.5 mt-1.5">
                    {associatedMotif.makna_filosofis}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
