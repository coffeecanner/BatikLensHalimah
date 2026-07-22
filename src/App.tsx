import React, { useState, useEffect, useRef } from "react";
import { 
  LayoutDashboard, 
  ShieldCheck, 
  Users, 
  Image as ImageIcon, 
  Cpu, 
  Compass, 
  BarChart3, 
  LogOut,
  Sparkles,
  AlertCircle,
  CheckCircle,
  X,
  Plus,
  Trash2,
  Edit,
  Upload,
  Camera,
  RefreshCw,
  Search,
  Lock,
  User as UserIcon,
  Phone,
  Calendar,
  Eye,
  BookOpen,
  FileSpreadsheet,
  Grid,
  Menu,
  ChevronRight,
  ContactRound,
  Info,
  ArrowLeft
} from "lucide-react";

import Sidebar from "./components/Sidebar";
import Scanner from "./components/Scanner";
import MotifDetailedView from "./components/MotifDetailedView";
import LaporanView from "./components/LaporanView";
import DashboardStats from "./components/DashboardStats";

import { 
  User, 
  AdminModel, 
  PegawaiModel, 
  CustomerModel,
  DataGambarMotifBatikModel, 
  HasilValidasiGambarMotifBatikModel,
  DataMotifBatikKaggleModel, 
  HasilPrediksiMotifBatikModel, 
  FeatureMapCnnModel,
  AttentionMapVitModel,
  LaporanModel 
} from "./types";

export default function App() {
  // Authentication & Session State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentMenu, setCurrentMenu] = useState<string>("Dashboard");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [loginMode, setLoginMode] = useState<"PEGAWAI" | "CUSTOMER">("PEGAWAI");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerPurpose, setCustomerPurpose] = useState("Kunjungan Mandiri / Scan Batik");

  // Global Lists States
  const [adminsList, setAdminsList] = useState<AdminModel[]>([]);
  const [pegawaiList, setPegawaiList] = useState<PegawaiModel[]>([]);
  const [customerList, setCustomerList] = useState<CustomerModel[]>([]);
  const [dataGambarList, setDataGambarList] = useState<DataGambarMotifBatikModel[]>([]);
  const [hasilValidasiList, setHasilValidasiList] = useState<HasilValidasiGambarMotifBatikModel[]>([]);
  const [hasilPrediksiList, setHasilPrediksiList] = useState<HasilPrediksiMotifBatikModel[]>([]);
  const [dataMotifList, setDataMotifList] = useState<DataMotifBatikKaggleModel[]>([]);
  const [featureMapCnnList, setFeatureMapCnnList] = useState<FeatureMapCnnModel[]>([]);
  const [attentionMapVitList, setAttentionMapVitList] = useState<AttentionMapVitModel[]>([]);
  const [laporanList, setLaporanList] = useState<LaporanModel[]>([]);

  // Search Filter State
  const [searchTerm, setSearchTerm] = useState("");

  // Feedback Banner
  const [bannerAlert, setBannerAlert] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Logout confirmation modal
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);

  // Modal / Form opening states
  const [isAdminFormOpen, setIsAdminFormOpen] = useState(false);
  const [isEditingAdmin, setIsEditingAdmin] = useState(false);
  const [adminForm, setAdminForm] = useState({ id: 0, username: "", password: "", nama_admin: "" });

  const [isPegawaiFormOpen, setIsPegawaiFormOpen] = useState(false);
  const [isEditingPegawai, setIsEditingPegawai] = useState(false);
  const [pegawaiForm, setPegawaiForm] = useState({ id: 0, username: "", password: "", nama_pegawai: "", adminid: 0 });

  const [isCustomerFormOpen, setIsCustomerFormOpen] = useState(false);
  const [isEditingCustomer, setIsEditingCustomer] = useState(false);
  const [customerForm, setCustomerForm] = useState({ id: 0, nama_customer: "", no_telepon: "", keperluan: "", pegawai_id: 0 });

  // Dedicated Motif Edit Page
  const [isEditingMotifPage, setIsEditingMotifPage] = useState(false);
  const [selectedMotifForEdit, setSelectedMotifForEdit] = useState<DataMotifBatikKaggleModel | null>(null);
  const [editMotifForm, setEditMotifForm] = useState({
    id: 0,
    nama_motif: "",
    asal_daerah: "",
    makna_filosofis: "",
    occasion: ""
  });
  const [editGallery, setEditGallery] = useState<string[]>([]);
  const [newImageUrl, setNewImageUrl] = useState("");

  // Detailed Modal state
  const [selectedDetailedMotif, setSelectedDetailedMotif] = useState<DataMotifBatikKaggleModel | null>(null);
  const [selectedDetailedImage, setSelectedDetailedImage] = useState<string | null>(null);

  // CNN/ViT map preview state
  const [previewMapImage, setPreviewMapImage] = useState<string | null>(null);
  const [previewMapTitle, setPreviewMapTitle] = useState<string>("");

  // Custom Deletion Confirmation State (Cascade warning system to avoid parent-fails IntegrityError)
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    type: "ADMIN" | "PEGAWAI" | "CUSTOMER" | "GAMBAR" | "VALIDASI" | "PREDIKSI" | "KAGGLE";
    id: number;
    title: string;
    details: string[];
    onConfirm: () => Promise<void>;
  } | null>(null);

  const [isDeletingLoading, setIsDeletingLoading] = useState(false);

  // Format ID helper
  const formatId = (id: number | null | undefined, type: "ADMIN" | "PEGAWAI" | "CUSTOMER" | "GAMBAR" | "VALIDASI" | "PREDIKSI" | "KAGGLE" | "LAPORAN"): string => {
    if (id === null || id === undefined) return "N/A";
    const prefix = {
      ADMIN: "ADM",
      PEGAWAI: "STA",
      CUSTOMER: "CUST",
      GAMBAR: "IMG",
      VALIDASI: "VAL",
      PREDIKSI: "PRED",
      KAGGLE: "KAG",
      LAPORAN: "REP"
    }[type];
    return `${prefix}-${id}`;
  };

  // Region color badge selector helper
  const getRegionBadgeStyles = (region: string): string => {
    const reg = (region || "").toUpperCase();
    if (reg.includes("ACEH")) return "bg-blue-50 text-blue-600 border border-blue-100";
    if (reg.includes("BALI")) return "bg-indigo-50 text-indigo-600 border border-indigo-100";
    if (reg.includes("BETAWI") || reg.includes("JAKARTA")) return "bg-sky-50 text-sky-600 border border-sky-100";
    if (reg.includes("PEKALONGAN")) return "bg-purple-50 text-purple-600 border border-purple-100";
    if (reg.includes("CIREBON")) return "bg-violet-50 text-violet-600 border border-violet-100";
    if (reg.includes("YOGYAKARTA") || reg.includes("JOGJA") || reg.includes("KULON")) return "bg-amber-50 text-amber-700 border border-amber-100";
    if (reg.includes("SOLO") || reg.includes("SURAKARTA")) return "bg-orange-50 text-orange-700 border border-orange-100";
    return "bg-slate-50 text-slate-600 border border-slate-200";
  };

  const triggerAlert = (type: "success" | "error", text: string) => {
    setBannerAlert({ type, text });
    setTimeout(() => setBannerAlert(null), 5000);
  };

  const fetchAllData = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    const headers = { "Authorization": `Bearer ${token}` };

    const endpoints = [
      { url: "/api/admin", setter: setAdminsList, name: "Admin" },
      { url: "/api/pegawai", setter: setPegawaiList, name: "Pegawai" },
      { url: "/api/customer", setter: setCustomerList, name: "Customer" },
      { url: "/api/data_gambar_motif_batik", setter: setDataGambarList, name: "Data Gambar" },
      { url: "/api/hasil_validasi", setter: setHasilValidasiList, name: "Hasil Validasi" },
      { url: "/api/hasil_prediksi", setter: setHasilPrediksiList, name: "Hasil Prediksi" },
      { url: "/api/data_motif", setter: setDataMotifList, name: "Data Motif Kaggle" },
      { url: "/api/feature_maps_cnn", setter: setFeatureMapCnnList, name: "Feature Map CNN" },
      { url: "/api/attention_maps_vit", setter: setAttentionMapVitList, name: "Attention Map VIT" },
      { url: "/api/laporan", setter: setLaporanList, name: "Laporan" }
    ];

    for (const ep of endpoints) {
      try {
        const res = await fetch(ep.url, { headers });
        if (res.ok) {
          const data = await res.json();
          ep.setter(data);
        } else {
          console.error(`Gagal sync data ${ep.name}: HTTP ${res.status}`);
        }
      } catch (err) {
        console.error(`Error koneksi ke ${ep.url}:`, err);
      }
    }
  };

  // Auth Effects
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    const storedToken = localStorage.getItem("token");
    if (storedUser && storedToken) {
      setCurrentUser(JSON.parse(storedUser));
    }
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchAllData();
    }
  }, [currentUser]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setIsAuthenticating(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: loginUsername, password: loginPassword })
      });

      if (!response.ok) {
        throw new Error("Kredensial username atau sandi salah!");
      }

      const resData = await response.json();
      localStorage.setItem("token", resData.token);
      localStorage.setItem("user", JSON.stringify(resData.user));
      setCurrentUser(resData.user);
      triggerAlert("success", `Selamat Datang kembali, ${resData.user.name}!`);
    } catch (err: any) {
      setLoginError(err.message || "Gagal menghubungkan ke server.");
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleCustomerLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setIsAuthenticating(true);

    try {
      const response = await fetch("/api/auth/customer_login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nama_customer: customerName,
          no_telepon: customerPhone,
          keperluan: customerPurpose || "Kunjungan Mandiri / Scan Batik"
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || "Gagal mendaftarkan atau masuk sebagai customer.");
      }

      const resData = await response.json();
      localStorage.setItem("token", resData.token);
      localStorage.setItem("user", JSON.stringify(resData.user));
      setCurrentUser(resData.user);
      triggerAlert("success", `Selamat Datang, ${resData.user.name}!`);
    } catch (err: any) {
      setLoginError(err.message || "Gagal menghubungkan ke server.");
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleLogout = () => {
    setIsLogoutConfirmOpen(true);
  };

  const executeLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setCurrentUser(null);
    setSelectedDetailedMotif(null);
    setSelectedDetailedImage(null);
    setCurrentMenu("Dashboard");
    setIsLogoutConfirmOpen(false);
    triggerAlert("success", "Berhasil keluar dari sesi.");
  };

  // ================= ADMIN CRUD =================
  const handleSaveAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    const headers = { 
      "Content-Type": "application/json",
      "Authorization": `Bearer ${localStorage.getItem("token")}`
    };
    try {
      const url = isEditingAdmin ? `/api/admin/${adminForm.id}` : "/api/admin";
      const method = isEditingAdmin ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(adminForm)
      });
      if (res.ok) {
        triggerAlert("success", `Admin berhasil ${isEditingAdmin ? "diperbarui" : "ditambahkan"}`);
        setIsAdminFormOpen(false);
        setIsEditingAdmin(false);
        setAdminForm({ id: 0, username: "", password: "", nama_admin: "" });
        fetchAllData();
      } else {
        const err = await res.json();
        triggerAlert("error", err.message || "Gagal memproses admin.");
      }
    } catch {
      triggerAlert("error", "Koneksi ke backend bermasalah.");
    }
  };

  // Safe Deletes
  const triggerDeleteAdmin = (id: number) => {
    if (currentUser?.role === "ADMIN" && currentUser?.id === id) {
      triggerAlert("error", "Anda tidak boleh menghapus akun Anda sendiri yang sedang aktif!");
      return;
    }

    const adm = adminsList.find(a => a.id === id);
    const name = adm ? adm.nama_admin : `#${id}`;

    // Dependencies
    const matchingPegawais = pegawaiList.filter(p => p.adminid === id);
    const details = [];
    if (matchingPegawais.length > 0) {
      details.push(`Menghapus admin ini akan berdampak pada ${matchingPegawais.length} akun pegawai yang diawasinya.`);
    }

    setDeleteConfirmation({
      type: "ADMIN",
      id,
      title: `Hapus Akun Administrator: ${name}`,
      details,
      onConfirm: async () => {
        setIsDeletingLoading(true);
        try {
          // If there are cascading pegawais, we must delete them first
          for (const peg of matchingPegawais) {
            await cascadeDeletePegawaiRelations(peg.id);
            await fetch(`/api/pegawai/${peg.id}`, {
              method: "DELETE",
              headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
            });
          }
          // Now delete the admin
          const res = await fetch(`/api/admin/${id}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
          });
          if (res.ok) {
            triggerAlert("success", "Admin dan seluruh relasi cascade berhasil dihapus.");
          } else {
            const err = await res.json();
            triggerAlert("error", err.message || "Gagal menghapus admin.");
          }
        } catch (e) {
          triggerAlert("error", "Gagal mengeksekusi penghapusan cascade.");
        } finally {
          setIsDeletingLoading(false);
          setDeleteConfirmation(null);
          fetchAllData();
        }
      }
    });
  };

  // ================= PEGAWAI CRUD =================
  const handleSavePegawai = async (e: React.FormEvent) => {
    e.preventDefault();
    const headers = { 
      "Content-Type": "application/json",
      "Authorization": `Bearer ${localStorage.getItem("token")}`
    };
    try {
      const url = isEditingPegawai ? `/api/pegawai/${pegawaiForm.id}` : "/api/pegawai";
      const method = isEditingPegawai ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify({
          ...pegawaiForm,
          id_admin: currentUser?.id || 1
        })
      });
      if (res.ok) {
        triggerAlert("success", `Pegawai berhasil ${isEditingPegawai ? "diperbarui" : "ditambahkan"}`);
        setIsPegawaiFormOpen(false);
        setIsEditingPegawai(false);
        setPegawaiForm({ id: 0, username: "", password: "", nama_pegawai: "", adminid: 0 });
        fetchAllData();
      } else {
        const err = await res.json();
        triggerAlert("error", err.message || "Gagal memproses pegawai.");
      }
    } catch {
      triggerAlert("error", "Koneksi ke backend bermasalah.");
    }
  };

  // Helper function to safely delete Pegawai dependencies (scans, validation, prediction, customer)
  const cascadeDeletePegawaiRelations = async (pegId: number) => {
    const token = localStorage.getItem("token");
    const headers = { "Authorization": `Bearer ${token}` };

    // 1. Delete associated customer records
    const matchingCusts = customerList.filter(c => c.pegawai_id === pegId);
    for (const c of matchingCusts) {
      await fetch(`/api/customer/${c.id}`, { method: "DELETE", headers });
    }

    // 2. Delete associated predictions & validations
    const matchingPreds = hasilPrediksiList.filter(p => p.pegawai_id === pegId);
    for (const pred of matchingPreds) {
      // Find associated heatmaps
      const matchingCnn = featureMapCnnList.filter(c => c.hasil_prediksi_id === pred.id);
      const matchingVit = attentionMapVitList.filter(v => v.hasil_prediksi_id === pred.id);
      
      // Delete cnn & vit heatmap if database allows or let it cascade, but let's try calling predictions delete which sweeps them
      await fetch(`/api/hasil_prediksi/${pred.id}`, { method: "DELETE", headers });
    }

    // 3. Delete associated validation records
    const matchingImgIds = dataGambarList.filter(g => g.pegawai_id === pegId).map(g => g.id);
    const matchingVals = hasilValidasiList.filter(v => matchingImgIds.includes(v.data_gambar_id));
    for (const val of matchingVals) {
      await fetch(`/api/hasil_validasi/${val.id}`, { method: "DELETE", headers });
    }

    // 4. Delete associated raw images
    for (const imgId of matchingImgIds) {
      await fetch(`/api/data_gambar_motif_batik/${imgId}`, { method: "DELETE", headers });
    }
  };

  const triggerDeletePegawai = (id: number) => {
    const peg = pegawaiList.find(p => p.id === id);
    const name = peg ? peg.nama_pegawai : `#${id}`;

    const matchingCusts = customerList.filter(c => c.pegawai_id === id);
    const matchingImages = dataGambarList.filter(g => g.pegawai_id === id);
    const matchingPreds = hasilPrediksiList.filter(p => p.pegawai_id === id);

    const details = [];
    if (matchingCusts.length > 0) details.push(`- ${matchingCusts.length} data customer yang dilayani oleh staff ini.`);
    if (matchingImages.length > 0) details.push(`- ${matchingImages.length} berkas foto motif batik yang diunggah.`);
    if (matchingPreds.length > 0) details.push(`- ${matchingPreds.length} histori analisis prediksi pola AI.`);

    setDeleteConfirmation({
      type: "PEGAWAI",
      id,
      title: `Hapus Akun Pegawai (Staff): ${name}`,
      details: details.length > 0 
        ? ["Menghapus akun pegawai ini juga akan memicu penghapusan otomatis (cascade) pada data berikut untuk menjaga integritas database:", ...details]
        : ["Tidak ada data relasi yang bergantung. Akun pegawai ini aman dihapus langsung."],
      onConfirm: async () => {
        setIsDeletingLoading(true);
        try {
          await cascadeDeletePegawaiRelations(id);
          const res = await fetch(`/api/pegawai/${id}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
          });
          if (res.ok) {
            triggerAlert("success", "Akun pegawai dan seluruh data terkait berhasil dihapus.");
          } else {
            const err = await res.json();
            triggerAlert("error", err.message || "Gagal menghapus pegawai.");
          }
        } catch {
          triggerAlert("error", "Error memproses cascade delete.");
        } finally {
          setIsDeletingLoading(false);
          setDeleteConfirmation(null);
          fetchAllData();
        }
      }
    });
  };

  // ================= CUSTOMER CRUD =================
  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    const headers = { 
      "Content-Type": "application/json",
      "Authorization": `Bearer ${localStorage.getItem("token")}`
    };
    try {
      const url = isEditingCustomer ? `/api/customer/${customerForm.id}` : "/api/customer";
      const method = isEditingCustomer ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(customerForm)
      });
      if (res.ok) {
        triggerAlert("success", `Customer berhasil ${isEditingCustomer ? "diperbarui" : "ditambahkan"}`);
        setIsCustomerFormOpen(false);
        setIsEditingCustomer(false);
        setCustomerForm({ id: 0, nama_customer: "", no_telepon: "", keperluan: "", pegawai_id: 0 });
        fetchAllData();
      } else {
        const err = await res.json();
        triggerAlert("error", err.message || "Gagal memproses data customer.");
      }
    } catch {
      triggerAlert("error", "Koneksi ke backend bermasalah.");
    }
  };

  const triggerDeleteCustomer = (id: number) => {
    const cust = customerList.find(c => c.id === id);
    const name = cust ? cust.nama_customer : `#${id}`;

    setDeleteConfirmation({
      type: "CUSTOMER",
      id,
      title: `Hapus Data Customer: ${name}`,
      details: ["Data kunjungan customer ini akan dihapus permanen dari sistem."],
      onConfirm: async () => {
        setIsDeletingLoading(true);
        try {
          const res = await fetch(`/api/customer/${id}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
          });
          if (res.ok) {
            triggerAlert("success", "Data customer berhasil dihapus.");
          } else {
            const err = await res.json();
            triggerAlert("error", err.message || "Gagal menghapus customer.");
          }
        } catch {
          triggerAlert("error", "Gagal memproses penghapusan.");
        } finally {
          setIsDeletingLoading(false);
          setDeleteConfirmation(null);
          fetchAllData();
        }
      }
    });
  };

  // ================= IMAGES & PREDICTIONS DELETE =================
  const triggerDeleteGambar = (id: number) => {
    const matchingVals = hasilValidasiList.filter(v => v.data_gambar_id === id);
    const matchingPreds = hasilPrediksiList.filter(p => p.gambar_id === id);

    const details = [];
    if (matchingVals.length > 0) details.push(`- ${matchingVals.length} data validasi hasil scan.`);
    if (matchingPreds.length > 0) details.push(`- ${matchingPreds.length} histori kalkulasi prediksi model.`);

    setDeleteConfirmation({
      type: "GAMBAR",
      id,
      title: `Hapus Berkas Gambar: ${formatId(id, "GAMBAR")}`,
      details: details.length > 0 
        ? ["Menghapus gambar ini juga akan menghapus data berikut yang terkait:", ...details]
        : ["Gambar ini aman dihapus langsung karena tidak memiliki tautan prediksi."],
      onConfirm: async () => {
        setIsDeletingLoading(true);
        const headers = { "Authorization": `Bearer ${localStorage.getItem("token")}` };
        try {
          // Delete validations first
          for (const val of matchingVals) {
            await fetch(`/api/hasil_validasi/${val.id}`, { method: "DELETE", headers });
          }
          // Delete predictions first
          for (const pred of matchingPreds) {
            await fetch(`/api/hasil_prediksi/${pred.id}`, { method: "DELETE", headers });
          }
          // Delete image
          const res = await fetch(`/api/data_gambar_motif_batik/${id}`, { method: "DELETE", headers });
          if (res.ok) {
            triggerAlert("success", "Berkas foto dan seluruh relasi prediksi berhasil dihapus.");
          } else {
            triggerAlert("error", "Gagal menghapus berkas foto.");
          }
        } catch {
          triggerAlert("error", "Error saat memproses penghapusan.");
        } finally {
          setIsDeletingLoading(false);
          setDeleteConfirmation(null);
          fetchAllData();
        }
      }
    });
  };

  const triggerDeletePrediction = (id: number) => {
    setDeleteConfirmation({
      type: "PREDIKSI",
      id,
      title: `Hapus Histori Prediksi: ${formatId(id, "PREDIKSI")}`,
      details: ["Data prediksi ini akan dihapus permanen, termasuk visualisasi heatmap CNN/VIT terkait."],
      onConfirm: async () => {
        setIsDeletingLoading(true);
        try {
          const res = await fetch(`/api/hasil_prediksi/${id}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
          });
          if (res.ok) {
            triggerAlert("success", "Histori prediksi berhasil dihapus.");
          } else {
            triggerAlert("error", "Gagal menghapus histori prediksi.");
          }
        } catch {
          triggerAlert("error", "Error koneksi.");
        } finally {
          setIsDeletingLoading(false);
          setDeleteConfirmation(null);
          fetchAllData();
        }
      }
    });
  };

  const triggerDeleteValidation = (id: number) => {
    setDeleteConfirmation({
      type: "VALIDASI",
      id,
      title: `Hapus Data Validasi: ${formatId(id, "VALIDASI")}`,
      details: ["Menghapus status validasi ini tanpa menghapus berkas gambarnya."],
      onConfirm: async () => {
        setIsDeletingLoading(true);
        try {
          const res = await fetch(`/api/hasil_validasi/${id}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
          });
          if (res.ok) {
            triggerAlert("success", "Data validasi berhasil dihapus.");
          } else {
            triggerAlert("error", "Gagal menghapus data validasi.");
          }
        } catch {
          triggerAlert("error", "Error koneksi.");
        } finally {
          setIsDeletingLoading(false);
          setDeleteConfirmation(null);
          fetchAllData();
        }
      }
    });
  };

  // ================= DATA MOTIF KAGGLE & IMAGE MANAGEMENT =================
  const handleOpenEditMotifPage = (motif: DataMotifBatikKaggleModel) => {
    setSelectedMotifForEdit(motif);
    setEditMotifForm({
      id: motif.id,
      nama_motif: motif.nama_motif,
      asal_daerah: motif.asal_daerah,
      makna_filosofis: motif.makna_filosofis,
      occasion: motif.occasion
    });
    
    // Parse current contoh_gambar list
    let parsedGallery: string[] = [];
    try {
      parsedGallery = JSON.parse(motif.contoh_gambar || "[]");
    } catch {
      if (motif.contoh_gambar) {
        parsedGallery = motif.contoh_gambar.split(",").map(url => url.trim());
      }
    }
    setEditGallery(parsedGallery);
    setIsEditingMotifPage(true);
  };

  const handleLocalImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = () => {
        const base64Str = reader.result as string;
        setEditGallery(prev => [...prev, base64Str]);
        triggerAlert("success", "Gambar berhasil dikonversi dan dimasukkan ke galeri lokal sementara.");
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddImageUrl = () => {
    if (!newImageUrl.trim()) return;
    setEditGallery(prev => [...prev, newImageUrl.trim()]);
    setNewImageUrl("");
    triggerAlert("success", "Tautan URL berhasil ditambahkan ke galeri.");
  };

  const handleRemoveGalleryImage = (indexToRemove: number) => {
    setEditGallery(prev => prev.filter((_, idx) => idx !== indexToRemove));
    triggerAlert("success", "Gambar berhasil dihapus dari galeri draf.");
  };

  const handleSaveMotif = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem("token");
    const headers = { 
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    };

    try {
      const payload = {
        ...editMotifForm,
        contoh_gambar: JSON.stringify(editGallery) // Encoded properly as JSON array string!
      };

      const res = await fetch(`/api/data_motif/${editMotifForm.id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        triggerAlert("success", "Informasi motif dan galeri contoh gambar berhasil diperbarui.");
        setIsEditingMotifPage(false);
        setSelectedMotifForEdit(null);
        fetchAllData();
      } else {
        const err = await res.json();
        triggerAlert("error", err.message || "Gagal memperbarui motif.");
      }
    } catch {
      triggerAlert("error", "Error koneksi ke backend.");
    }
  };

  const triggerDeleteMotif = (id: number) => {
    const motif = dataMotifList.find(m => m.id === id);
    const name = motif ? motif.nama_motif : `#${id}`;
    const matchingPreds = hasilPrediksiList.filter(p => p.motif_id === id);

    const details = [];
    if (matchingPreds.length > 0) {
      details.push(`Menghapus data motif batik ini akan ikut menghapus ${matchingPreds.length} histori prediksi pola AI yang bersangkutan.`);
    }

    setDeleteConfirmation({
      type: "KAGGLE",
      id,
      title: `Hapus Referensi Motif Batik Kaggle: ${name}`,
      details,
      onConfirm: async () => {
        setIsDeletingLoading(true);
        const headers = { "Authorization": `Bearer ${localStorage.getItem("token")}` };
        try {
          // Delete predictions referencing this motif
          for (const pred of matchingPreds) {
            await fetch(`/api/hasil_prediksi/${pred.id}`, { method: "DELETE", headers });
          }
          // Delete motif
          const res = await fetch(`/api/data_motif/${id}`, { method: "DELETE", headers });
          if (res.ok) {
            triggerAlert("success", "Referensi motif dan relasi prediksi berhasil dihapus.");
          } else {
            triggerAlert("error", "Gagal menghapus motif.");
          }
        } catch {
          triggerAlert("error", "Gagal memproses.");
        } finally {
          setIsDeletingLoading(false);
          setDeleteConfirmation(null);
          fetchAllData();
        }
      }
    });
  };

  // ================= GENERAL RENDER VALUES =================
  const filteredAdmins = adminsList.filter(adm => 
    adm.nama_admin.toLowerCase().includes(searchTerm.toLowerCase()) ||
    adm.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    formatId(adm.id, "ADMIN").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredPegawai = pegawaiList.filter(peg => 
    peg.nama_pegawai.toLowerCase().includes(searchTerm.toLowerCase()) ||
    peg.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    formatId(peg.id, "PEGAWAI").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredCustomer = customerList.filter(cust => 
    cust.nama_customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cust.no_telepon.includes(searchTerm) ||
    cust.keperluan.toLowerCase().includes(searchTerm.toLowerCase()) ||
    formatId(cust.id, "CUSTOMER").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredGambar = dataGambarList.filter(img => 
    formatId(img.id, "GAMBAR").toLowerCase().includes(searchTerm.toLowerCase()) ||
    formatId(img.pegawai_id, "PEGAWAI").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredValidasi = hasilValidasiList.filter(val => 
    formatId(val.id, "VALIDASI").toLowerCase().includes(searchTerm.toLowerCase()) ||
    formatId(val.data_gambar_id, "GAMBAR").toLowerCase().includes(searchTerm.toLowerCase()) ||
    val.status_validasi.toLowerCase().includes(searchTerm.toLowerCase()) ||
    val.keterangan.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredPrediksi = hasilPrediksiList.filter(pred => 
    formatId(pred.id, "PREDIKSI").toLowerCase().includes(searchTerm.toLowerCase()) ||
    formatId(pred.gambar_id, "GAMBAR").toLowerCase().includes(searchTerm.toLowerCase()) ||
    pred.prediksi_utama.toLowerCase().includes(searchTerm.toLowerCase()) ||
    pred.prediksi_sekunder.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredMotif = dataMotifList.filter(motif => 
    motif.nama_motif.toLowerCase().includes(searchTerm.toLowerCase()) ||
    motif.asal_daerah.toLowerCase().includes(searchTerm.toLowerCase()) ||
    motif.makna_filosofis.toLowerCase().includes(searchTerm.toLowerCase()) ||
    motif.occasion.toLowerCase().includes(searchTerm.toLowerCase()) ||
    formatId(motif.id, "KAGGLE").toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Authentication Guard
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4">
        <div className="w-full max-w-md bg-white border border-slate-200 shadow-2xl rounded-3xl p-8 space-y-6 text-center">
          <div className="w-16 h-16 bg-white border border-slate-200/90 rounded-2xl mx-auto flex items-center justify-center p-1.5 shadow-sm overflow-hidden mb-2">
            <img 
              src="/src/logo.png" 
              alt="BatikLens Logo" 
              className="w-full h-full object-contain" 
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                const pNode = e.currentTarget.parentNode as HTMLElement;
                if (pNode) {
                  const fallbackIcon = document.createElement('span');
                  fallbackIcon.className = 'text-indigo-650 font-black text-2xl font-sans';
                  fallbackIcon.innerText = 'B';
                  pNode.appendChild(fallbackIcon);
                }
              }}
            />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold font-sans tracking-tight text-slate-900">BatikLens Login</h1>
            <p className="text-sm text-slate-500 mt-1.5 font-serif italic">Sistem Identifikasi Ragam Hias Halimah</p>
          </div>

          {loginError && (
            <div className="bg-rose-50 border border-rose-100 rounded-xl p-3 flex space-x-2 text-rose-700 text-sm items-center justify-start text-left">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{loginError}</span>
            </div>
          )}

          {loginMode === "PEGAWAI" ? (
            <form onSubmit={handleLoginSubmit} className="space-y-4 text-left">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">USERNAME</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                    <UserIcon className="w-5 h-5" />
                  </span>
                  <input 
                    type="text" required
                    placeholder="Masukkan username Anda"
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-11 pr-4 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">PASSWORD</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                    <Lock className="w-5 h-5" />
                  </span>
                  <input 
                    type="password" required
                    placeholder="Masukkan sandi akun"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-11 pr-4 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setLoginMode("CUSTOMER");
                    setLoginError("");
                  }}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-700 hover:underline transition-colors cursor-pointer"
                >
                  Login sebagai Customer
                </button>
              </div>

              <button
                type="submit"
                disabled={isAuthenticating}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold rounded-xl text-sm tracking-wider uppercase transition-all shadow-md flex items-center justify-center space-x-2 cursor-pointer"
              >
                {isAuthenticating ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin text-white" />
                    <span>Memverifikasi...</span>
                  </>
                ) : (
                  <span>Login</span>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleCustomerLoginSubmit} className="space-y-4 text-left">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">NAMA LENGKAP CUSTOMER</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                    <UserIcon className="w-5 h-5" />
                  </span>
                  <input 
                    type="text" required
                    placeholder="Masukkan nama lengkap Anda"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-11 pr-4 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">NO. TELEPON / WHATSAPP</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                    <Phone className="w-5 h-5" />
                  </span>
                  <input 
                    type="tel" required
                    placeholder="Masukkan nomor telepon"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-11 pr-4 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">KEPERLUAN KUNJUNGAN</label>
                <select
                  value={customerPurpose}
                  onChange={(e) => setCustomerPurpose(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-3.5 text-sm text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors cursor-pointer"
                >
                  <option value="Kunjungan Mandiri / Scan Batik">Kunjungan Mandiri / Scan Batik</option>
                  <option value="Konsultasi Desain Batik">Konsultasi Desain Batik</option>
                  <option value="Pembelian Produk Griya Batik">Pembelian Produk Griya Batik</option>
                  <option value="Penelitian Akademis / Tugas">Penelitian Akademis / Tugas</option>
                </select>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setLoginMode("PEGAWAI");
                    setLoginError("");
                  }}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-700 hover:underline transition-colors cursor-pointer"
                >
                  Login sebagai Admin / Pegawai
                </button>
              </div>

              <button
                type="submit"
                disabled={isAuthenticating}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold rounded-xl text-sm tracking-wider uppercase transition-all shadow-md flex items-center justify-center space-x-2 cursor-pointer"
              >
                {isAuthenticating ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin text-white" />
                    <span>Mendaftarkan...</span>
                  </>
                ) : (
                  <span>Daftar & Masuk</span>
                )}
              </button>
            </form>
          )}

          <div className="border-t border-slate-100 pt-4 mt-6">
            <p className="text-[10px] text-slate-400 tracking-wide">
              &copy; 2026 Griya Batik Halimah. Hak Cipta Dilindungi.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-white text-slate-800 font-sans">
      <Sidebar 
        currentMenu={currentMenu}
        setCurrentMenu={(menu) => {
          setCurrentMenu(menu);
          setSearchTerm("");
          setIsEditingMotifPage(false);
          setSelectedMotifForEdit(null);
        }}
        user={currentUser}
        onLogout={handleLogout}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* Main Viewport */}
      <main className="flex-1 flex flex-col min-w-0 bg-white overflow-y-auto">
        
        {/* Top Header */}
        <header className="h-16 border-b border-slate-100 bg-white px-6 sm:px-8 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 text-slate-600 hover:text-slate-900 rounded-lg lg:hidden cursor-pointer"
              title="Buka Menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="text-sm font-bold text-slate-700 uppercase tracking-widest">{currentMenu}</span>
          </div>

          <div className="flex items-center space-x-4">
            {bannerAlert && (
              <div 
                className={`flex items-center space-x-2 py-1.5 px-4 rounded-lg text-xs font-bold border animate-fade-in ${
                  bannerAlert.type === "success" 
                    ? "bg-emerald-50 text-emerald-700 border-emerald-100" 
                    : "bg-rose-50 text-rose-700 border-rose-100"
                }`}
              >
                {bannerAlert.type === "success" ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                <span>{bannerAlert.text}</span>
              </div>
            )}
            <div className="text-xs bg-slate-50 border border-slate-200 py-1 px-3 rounded-lg text-slate-500 font-mono font-bold">
              REPORT PRINT MODE
            </div>
          </div>
        </header>

        {/* Content Container (Fluid & High Print Quality) */}
        <div className="p-6 sm:p-10 max-w-7xl w-full mx-auto space-y-8 flex-1 text-left">

          {/* ================= EDIT MOTIF DEDICATED PAGE ================= */}
          {isEditingMotifPage && selectedMotifForEdit && (
            <div className="bg-white border-2 border-slate-200 rounded-2xl p-8 shadow-sm space-y-8">
              <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                <div>
                  <span className="text-xs font-extrabold text-indigo-600 uppercase tracking-widest">{formatId(selectedMotifForEdit.id, "KAGGLE")}</span>
                  <h2 className="text-2xl font-black text-slate-900 mt-1 font-sans">Edit Ragam Hias Motif Batik</h2>
                </div>
                <button 
                  onClick={() => {
                    setIsEditingMotifPage(false);
                    setSelectedMotifForEdit(null);
                  }}
                  className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveMotif} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-2">Nama Motif</label>
                    <input 
                      type="text" required
                      value={editMotifForm.nama_motif}
                      onChange={(e) => setEditMotifForm({ ...editMotifForm, nama_motif: e.target.value })}
                      className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl p-3 text-sm text-slate-900 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-2">Asal Daerah</label>
                    <input 
                      type="text" required
                      value={editMotifForm.asal_daerah}
                      onChange={(e) => setEditMotifForm({ ...editMotifForm, asal_daerah: e.target.value })}
                      className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl p-3 text-sm text-slate-900 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-2">Makna Filosofis</label>
                  <textarea 
                    required rows={4}
                    value={editMotifForm.makna_filosofis}
                    onChange={(e) => setEditMotifForm({ ...editMotifForm, makna_filosofis: e.target.value })}
                    className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl p-3 text-sm text-slate-900 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-2">Saran Penggunaan (Occasion)</label>
                  <input 
                    type="text" required
                    value={editMotifForm.occasion}
                    onChange={(e) => setEditMotifForm({ ...editMotifForm, occasion: e.target.value })}
                    className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl p-3 text-sm text-slate-900 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* IMAGE MANAGEMENT PANEL */}
                <div className="border-t-2 border-slate-100 pt-6 space-y-4">
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Manajemen Galeri Contoh Gambar</h3>
                  
                  {/* Current Thumbnails Grid */}
                  {editGallery.length === 0 ? (
                    <div className="p-4 bg-slate-50 border border-dashed rounded-xl text-center text-sm text-slate-500">
                      Galeri kosong. Silakan unggah gambar lokal atau tambahkan URL gambar di bawah.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4">
                      {editGallery.map((imgUrl, idx) => (
                        <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 bg-slate-50 group shadow-sm">
                          <img src={imgUrl} alt="Thumbnail preview" className="w-full h-full object-cover" />
                          <button 
                            type="button"
                            onClick={() => handleRemoveGalleryImage(idx)}
                            className="absolute top-1 right-1 p-1 bg-rose-600 text-white rounded-md hover:bg-rose-700 shadow-sm cursor-pointer"
                            title="Hapus dari Galeri"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add New Image Controls */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                    <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-3">
                      <span className="text-xs font-bold text-slate-700 uppercase block">Metode 1: Unggah Gambar Lokal</span>
                      <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-300 hover:border-indigo-500 bg-white rounded-xl cursor-pointer transition-colors">
                        <Upload className="w-6 h-6 text-slate-400 mb-1" />
                        <span className="text-xs font-semibold text-indigo-600">Klik untuk upload berkas lokal</span>
                        <input 
                          type="file" accept="image/*"
                          onChange={handleLocalImageUpload}
                          className="hidden"
                        />
                      </label>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-3 flex flex-col justify-between">
                      <div>
                        <span className="text-xs font-bold text-slate-700 uppercase block mb-2">Metode 2: Tambahkan Tautan URL</span>
                        <input 
                          type="url"
                          placeholder="https://contoh.com/gambar-batik.jpg"
                          value={newImageUrl}
                          onChange={(e) => setNewImageUrl(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <button 
                        type="button"
                        onClick={handleAddImageUrl}
                        className="w-full p-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs cursor-pointer transition-colors mt-2"
                      >
                        Hubungkan Tautan Gambar
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end space-x-3 border-t border-slate-100 pt-6">
                  <button 
                    type="button"
                    onClick={() => {
                      setIsEditingMotifPage(false);
                      setSelectedMotifForEdit(null);
                    }}
                    className="px-6 py-2.5 bg-white border-2 border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-xl text-sm cursor-pointer"
                  >
                    Batal
                  </button>
                  <button 
                    type="submit"
                    className="px-8 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm cursor-pointer shadow-md"
                  >
                    Simpan Perubahan
                  </button>
                </div>
              </form>
            </div>
          )}


          {/* ================= MENU: DASHBOARD ================= */}
          {!isEditingMotifPage && currentMenu === "Dashboard" && (
            <div className="space-y-6">
              <div className="p-6 bg-indigo-50/60 border border-indigo-100 rounded-2xl text-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 text-left">
                <div className="space-y-1">
                  <h3 className="text-xl font-bold font-sans text-indigo-950">Selamat Datang, {currentUser?.name || "User"}!</h3>
                  <p className="text-sm text-indigo-800/90 leading-relaxed">
                    Sistem monitoring dan visualisasi data analisis BatikLens Griya Batik Halimah. Panel statistik di bawah menyajikan akurasi klasifikasi sistem AI secara terperinci.
                  </p>
                </div>
                <div className="shrink-0 w-full md:w-auto">
                  <button
                    onClick={() => setCurrentMenu("Hasil Prediksi Motif Batik")}
                    className="w-full md:w-auto inline-flex items-center justify-center space-x-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm transition-all shadow-md cursor-pointer hover:shadow-indigo-150"
                  >
                    <Camera className="w-4 h-4 animate-pulse" />
                    <span>Scan Gambar Batik</span>
                  </button>
                </div>
              </div>

              <DashboardStats 
                hasilPrediksiList={hasilPrediksiList}
                dataMotifList={dataMotifList}
                dataGambarList={dataGambarList}
              />
            </div>
          )}

          {/* ================= MENU: ADMIN ================= */}
          {!isEditingMotifPage && currentMenu === "Admin" && (
            isAdminFormOpen ? (
              <div className="bg-white border-2 border-slate-200 rounded-2xl p-8 shadow-sm space-y-6">
                <div className="flex items-center space-x-3 border-b border-slate-100 pb-4">
                  <button
                    onClick={() => setIsAdminFormOpen(false)}
                    className="p-2 hover:bg-slate-100 rounded-xl text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div className="text-left">
                    <h3 className="text-lg font-black text-slate-900 font-sans">
                      {isEditingAdmin ? "Ubah Akun Admin" : "Tambahkan Akun Admin Baru"}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">Lengkapi formulir di bawah ini untuk menyimpan akun administrator baru.</p>
                  </div>
                </div>

                <form onSubmit={handleSaveAdmin} className="space-y-6 max-w-2xl text-left">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Username</label>
                      <input 
                        type="text" required
                        value={adminForm.username}
                        onChange={(e) => setAdminForm({ ...adminForm, username: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 rounded-xl p-3 text-sm transition-all outline-none"
                        placeholder="Masukkan username admin"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Nama Lengkap Admin</label>
                      <input 
                        type="text" required
                        value={adminForm.nama_admin}
                        onChange={(e) => setAdminForm({ ...adminForm, nama_admin: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 rounded-xl p-3 text-sm transition-all outline-none"
                        placeholder="Nama lengkap administrator"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Kata Sandi</label>
                      <input 
                        type="password" required={!isEditingAdmin}
                        placeholder={isEditingAdmin ? "Biarkan kosong jika tidak ingin diubah" : "Masukkan kata sandi"}
                        value={adminForm.password}
                        onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 rounded-xl p-3 text-sm transition-all outline-none"
                      />
                    </div>
                  </div>
                  <div className="flex space-x-3 pt-4 border-t border-slate-100">
                    <button type="submit" className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm transition-all cursor-pointer shadow-md shadow-indigo-100">
                      Simpan Admin
                    </button>
                    <button type="button" onClick={() => setIsAdminFormOpen(false)} className="px-5 py-2.5 bg-white text-slate-700 border border-slate-200 rounded-xl text-sm hover:bg-slate-50 transition-all cursor-pointer">
                      Batal
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <div className="bg-white border-2 border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-black text-slate-900 font-sans">Admin</h3>
                    <p className="text-sm text-slate-500">Daftar akun administrator dengan kendali operasional sistem.</p>
                  </div>
                  {currentUser.role === "ADMIN" && (
                    <button 
                      onClick={() => {
                        setIsEditingAdmin(false);
                        setAdminForm({ id: 0, username: "", password: "", nama_admin: "" });
                        setIsAdminFormOpen(true);
                      }}
                      className="p-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold flex items-center space-x-2 cursor-pointer shadow-md transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Tambah Admin</span>
                    </button>
                  )}
                </div>

                {/* Admins Table */}
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-sm text-slate-800 border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600 uppercase font-bold">
                      <tr>
                        <th className="p-4">ID Admin</th>
                        <th className="p-4">Username</th>
                        <th className="p-4">Nama Lengkap</th>
                        <th className="p-4 text-right">Opsi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono text-sm">
                      {filteredAdmins.map((adm) => (
                        <tr key={adm.id} className="hover:bg-slate-50/40">
                          <td className="p-4 font-bold text-indigo-700">{formatId(adm.id, "ADMIN")}</td>
                          <td className="p-4">{adm.username}</td>
                          <td className="p-4 font-sans">{adm.nama_admin}</td>
                          <td className="p-4 text-right space-x-2 font-sans">
                            {currentUser.role === "ADMIN" && (
                              <button 
                                onClick={() => {
                                  setAdminForm({ id: adm.id, username: adm.username, password: "", nama_admin: adm.nama_admin });
                                  setIsEditingAdmin(true);
                                  setIsAdminFormOpen(true);
                                }}
                                className="text-indigo-600 hover:text-indigo-800"
                                title="Edit Admin"
                              >
                                <Edit className="w-4 h-4 inline" />
                              </button>
                            )}
                            {currentUser.role === "ADMIN" && (
                              <button onClick={() => triggerDeleteAdmin(adm.id)} className="text-rose-600 hover:text-rose-800" title="Hapus Admin">
                                <Trash2 className="w-4 h-4 inline" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          )}

          {/* ================= MENU: PEGAWAI ================= */}
          {!isEditingMotifPage && currentMenu === "Pegawai" && (
            isPegawaiFormOpen ? (
              <div className="bg-white border-2 border-slate-200 rounded-2xl p-8 shadow-sm space-y-6">
                <div className="flex items-center space-x-3 border-b border-slate-100 pb-4">
                  <button
                    onClick={() => setIsPegawaiFormOpen(false)}
                    className="p-2 hover:bg-slate-100 rounded-xl text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div className="text-left">
                    <h3 className="text-lg font-black text-slate-900 font-sans">
                      {isEditingPegawai ? "Ubah Akun Pegawai" : "Tambahkan Akun Pegawai Baru"}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">Lengkapi formulir di bawah ini untuk menyimpan data pegawai baru.</p>
                  </div>
                </div>

                <form onSubmit={handleSavePegawai} className="space-y-6 max-w-2xl text-left">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Username</label>
                      <input 
                        type="text" required
                        value={pegawaiForm.username}
                        onChange={(e) => setPegawaiForm({ ...pegawaiForm, username: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 rounded-xl p-3 text-sm transition-all outline-none"
                        placeholder="Masukkan username pegawai"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Nama Lengkap Pegawai</label>
                      <input 
                        type="text" required
                        value={pegawaiForm.nama_pegawai}
                        onChange={(e) => setPegawaiForm({ ...pegawaiForm, nama_pegawai: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 rounded-xl p-3 text-sm transition-all outline-none"
                        placeholder="Nama lengkap pegawai"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Kata Sandi</label>
                      <input 
                        type="password" required={!isEditingPegawai}
                        placeholder={isEditingPegawai ? "Biarkan kosong jika tidak ingin diubah" : "Masukkan kata sandi"}
                        value={pegawaiForm.password}
                        onChange={(e) => setPegawaiForm({ ...pegawaiForm, password: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 rounded-xl p-3 text-sm transition-all outline-none"
                      />
                    </div>
                  </div>
                  <div className="flex space-x-3 pt-4 border-t border-slate-100">
                    <button type="submit" className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm transition-all cursor-pointer shadow-md shadow-indigo-100">
                      Simpan Pegawai
                    </button>
                    <button type="button" onClick={() => setIsPegawaiFormOpen(false)} className="px-5 py-2.5 bg-white text-slate-700 border border-slate-200 rounded-xl text-sm hover:bg-slate-50 transition-all cursor-pointer">
                      Batal
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <div className="bg-white border-2 border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-black text-slate-900 font-sans">Pegawai</h3>
                    <p className="text-sm text-slate-500">Daftar pegawai / staff yang mengoperasikan sistem analisis pola batik di Griya Batik Halimah.</p>
                  </div>
                  {currentUser.role === "ADMIN" && (
                    <button 
                      onClick={() => {
                        setIsEditingPegawai(false);
                        setPegawaiForm({ id: 0, username: "", password: "", nama_pegawai: "", adminid: currentUser.id });
                        setIsPegawaiFormOpen(true);
                      }}
                      className="p-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold flex items-center space-x-2 cursor-pointer shadow-md"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Tambah Pegawai</span>
                    </button>
                  )}
                </div>

                {/* Pegawai Table */}
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-sm text-slate-800 border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600 uppercase font-bold">
                      <tr>
                        <th className="p-4">ID Pegawai</th>
                        <th className="p-4">Username</th>
                        <th className="p-4">Nama Pegawai</th>
                        <th className="p-4">Didaftarkan Oleh</th>
                        <th className="p-4 text-right">Opsi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono text-sm">
                      {filteredPegawai.map((peg) => (
                        <tr key={peg.id} className="hover:bg-slate-50/40">
                          <td className="p-4 font-bold text-indigo-700">{formatId(peg.id, "PEGAWAI")}</td>
                          <td className="p-4">{peg.username}</td>
                          <td className="p-4 font-sans">{peg.nama_pegawai}</td>
                          <td className="p-4 font-mono text-xs">{formatId(peg.admin_id || peg.adminid, "ADMIN")}</td>
                          <td className="p-4 text-right space-x-2 font-sans">
                            {currentUser.role === "ADMIN" && (
                              <button 
                                onClick={() => {
                                  setPegawaiForm({ id: peg.id, username: peg.username, password: "", nama_pegawai: peg.nama_pegawai, adminid: peg.admin_id || peg.adminid || 0 });
                                  setIsEditingPegawai(true);
                                  setIsPegawaiFormOpen(true);
                                }}
                                className="text-indigo-600 hover:text-indigo-800"
                                title="Edit Pegawai"
                              >
                                <Edit className="w-4 h-4 inline" />
                              </button>
                            )}
                            {currentUser.role === "ADMIN" && (
                              <button onClick={() => triggerDeletePegawai(peg.id)} className="text-rose-600 hover:text-rose-800" title="Hapus Pegawai">
                                <Trash2 className="w-4 h-4 inline" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          )}

          {/* ================= MENU: CUSTOMER ================= */}
          {!isEditingMotifPage && currentMenu === "Customer" && (
            isCustomerFormOpen ? (
              <div className="bg-white border-2 border-slate-200 rounded-2xl p-8 shadow-sm space-y-6">
                <div className="flex items-center space-x-3 border-b border-slate-100 pb-4">
                  <button
                    onClick={() => setIsCustomerFormOpen(false)}
                    className="p-2 hover:bg-slate-100 rounded-xl text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div className="text-left">
                    <h3 className="text-lg font-black text-slate-900 font-sans">
                      {isEditingCustomer ? "Ubah Data Customer" : "Tambahkan Data Customer Baru"}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">Lengkapi formulir di bawah ini untuk menyimpan data customer baru.</p>
                  </div>
                </div>

                <form onSubmit={handleSaveCustomer} className="space-y-6 max-w-4xl text-left">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Nama Customer</label>
                      <input 
                        type="text" required
                        value={customerForm.nama_customer}
                        onChange={(e) => setCustomerForm({ ...customerForm, nama_customer: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 rounded-xl p-3 text-sm transition-all outline-none"
                        placeholder="Nama lengkap customer"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">No. Telepon / WhatsApp</label>
                      <input 
                        type="text" required
                        value={customerForm.no_telepon}
                        onChange={(e) => setCustomerForm({ ...customerForm, no_telepon: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 rounded-xl p-3 text-sm transition-all outline-none"
                        placeholder="Masukkan nomor telepon"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Keperluan Kunjungan</label>
                      <input 
                        type="text" required
                        value={customerForm.keperluan}
                        onChange={(e) => setCustomerForm({ ...customerForm, keperluan: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 rounded-xl p-3 text-sm transition-all outline-none"
                        placeholder="Misal: Konsultasi Desain, Pembelian"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Dilayani Oleh (Petugas)</label>
                      <select 
                        value={customerForm.pegawai_id}
                        onChange={(e) => setCustomerForm({ ...customerForm, pegawai_id: Number(e.target.value) })}
                        className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 rounded-xl p-3 text-sm transition-all outline-none cursor-pointer"
                      >
                        <option value={0}>Pilih Staff Pegawai</option>
                        {pegawaiList.map(p => (
                          <option key={p.id} value={p.id}>{p.nama_pegawai} ({formatId(p.id, "PEGAWAI")})</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="flex space-x-3 pt-4 border-t border-slate-100">
                    <button type="submit" className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm transition-all cursor-pointer shadow-md shadow-indigo-100">
                      Simpan Customer
                    </button>
                    <button type="button" onClick={() => setIsCustomerFormOpen(false)} className="px-5 py-2.5 bg-white text-slate-700 border border-slate-200 rounded-xl text-sm hover:bg-slate-50 transition-all cursor-pointer">
                      Batal
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <div className="bg-white border-2 border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-black text-slate-900 font-sans">Customer</h3>
                    <p className="text-sm text-slate-500">Daftar kunjungan customer Griya Batik Halimah yang dilayani.</p>
                  </div>
                  <button 
                    onClick={() => {
                      setIsEditingCustomer(false);
                      setCustomerForm({ id: 0, nama_customer: "", no_telepon: "", keperluan: "", pegawai_id: currentUser.id });
                      setIsCustomerFormOpen(true);
                    }}
                    className="p-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold flex items-center space-x-2 cursor-pointer shadow-md"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Tambah Customer</span>
                  </button>
                </div>

                {/* Customer Table */}
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-sm text-slate-800 border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600 uppercase font-bold">
                      <tr>
                        <th className="p-4">ID Customer</th>
                        <th className="p-4">Nama</th>
                        <th className="p-4">No. Telpon</th>
                        <th className="p-4">Keperluan</th>
                        <th className="p-4">Tanggal Kunjungan</th>
                        <th className="p-4">User ID (Petugas)</th>
                        <th className="p-4 text-right">Opsi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono text-sm">
                      {filteredCustomer.map((cust) => (
                        <tr key={cust.id} className="hover:bg-slate-50/40">
                          <td className="p-4 font-bold text-indigo-700">{formatId(cust.id, "CUSTOMER")}</td>
                          <td className="p-4 font-sans">{cust.nama_customer}</td>
                          <td className="p-4">{cust.no_telepon}</td>
                          <td className="p-4 font-sans">{cust.keperluan}</td>
                          <td className="p-4 font-sans">{new Date(cust.tanggal_kunjungan).toLocaleDateString("id-ID", { hour: "2-digit", minute: "2-digit" })}</td>
                          <td className="p-4 font-bold text-indigo-650">
                            {cust.pegawai_id ? formatId(cust.pegawai_id, "PEGAWAI") : (cust.admin_id ? formatId(cust.admin_id, "ADMIN") : "N/A")}
                          </td>
                          <td className="p-4 text-right space-x-2 font-sans">
                            <button 
                              onClick={() => {
                                setCustomerForm({ id: cust.id, nama_customer: cust.nama_customer, no_telepon: cust.no_telepon, keperluan: cust.keperluan, pegawai_id: cust.pegawai_id || 0 });
                                setIsEditingCustomer(true);
                                setIsCustomerFormOpen(true);
                              }}
                              className="text-indigo-600 hover:text-indigo-800"
                              title="Edit Customer"
                            >
                              <Edit className="w-4 h-4 inline" />
                            </button>
                            <button onClick={() => triggerDeleteCustomer(cust.id)} className="text-rose-600 hover:text-rose-800" title="Hapus Customer">
                              <Trash2 className="w-4 h-4 inline" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          )}

          {/* ================= MENU: DATA GAMBAR MOTIF BATIK ================= */}
          {!isEditingMotifPage && currentMenu === "Data Gambar Motif Batik" && (
            <div className="space-y-8">
              {/* SCANNER COMPONENT ROW */}
              <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
                <Scanner 
                  user={currentUser} 
                  onPredictionComplete={(pred, motif) => {
                    fetchAllData(); // Refresh list immediately
                    if (motif) {
                      setSelectedDetailedMotif(motif);
                      setSelectedDetailedImage(pred.file_foto_batik || pred.image || null);
                    }
                  }}
                  onScanLogged={fetchAllData}
                />
              </div>

              <div className="bg-white border-2 border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
                <div className="text-left">
                  <h3 className="text-lg font-black text-slate-900 font-sans">Data Gambar Motif Batik</h3>
                  <p className="text-sm text-slate-500">Kumpulan raw foto motif batik hasil unggahan lokal maupun tangkapan kamera.</p>
                </div>

              {/* Data Gambar Table */}
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-sm text-slate-800 border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600 uppercase font-bold">
                    <tr>
                      <th className="p-4">ID Gambar</th>
                      <th className="p-4">Visual Thumbnail</th>
                      <th className="p-4">Tanggal Diunggah</th>
                      <th className="p-4">User ID (Perekam)</th>
                      <th className="p-4 text-right">Opsi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-sm">
                    {filteredGambar.map((img) => (
                      <tr key={img.id} className="hover:bg-slate-50/40">
                        <td className="p-4 font-bold text-indigo-700">{formatId(img.id, "GAMBAR")}</td>
                        <td className="p-4">
                          <div className="w-16 h-16 rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                            <img src={img.file_foto_batik} alt="Thumbnail" className="w-full h-full object-cover" />
                          </div>
                        </td>
                        <td className="p-4 font-sans">{new Date(img.tanggal_foto).toLocaleDateString("id-ID", { hour: "2-digit", minute: "2-digit" })}</td>
                        <td className="p-4 font-bold text-indigo-650">{img.pegawai_id ? formatId(img.pegawai_id, "PEGAWAI") : "ADM-1"}</td>
                        <td className="p-4 text-right font-sans">
                          <button onClick={() => triggerDeleteGambar(img.id)} className="text-rose-600 hover:text-rose-800" title="Hapus Gambar">
                            <Trash2 className="w-4 h-4 inline" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          )}

          {/* ================= MENU: HASIL VALIDASI GAMBAR MOTIF BATIK ================= */}
          {!isEditingMotifPage && currentMenu === "Hasil Validasi Gambar Motif Batik" && (
            <div className="bg-white border-2 border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
              <div className="text-left">
                <h3 className="text-lg font-black text-slate-900 font-sans">Hasil Validasi Gambar Motif Batik</h3>
                <p className="text-sm text-slate-500">Daftar keputusan validitas dan penolakan pola gambar batik masukan.</p>
              </div>

              {/* Validation Table */}
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-sm text-slate-800 border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600 uppercase font-bold">
                    <tr>
                      <th className="p-4">ID Validasi</th>
                      <th className="p-4">Gambar ID</th>
                      <th className="p-4">Tanggal Penilaian</th>
                      <th className="p-4">Status Validasi</th>
                      <th className="p-4">Keterangan</th>
                      <th className="p-4 text-right">Opsi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-sm">
                    {filteredValidasi.map((val) => (
                      <tr key={val.id} className="hover:bg-slate-50/40">
                        <td className="p-4 font-bold text-indigo-700">{formatId(val.id, "VALIDASI")}</td>
                        <td className="p-4 font-bold text-slate-700">{formatId(val.gambar_id || val.data_gambar_id, "GAMBAR")}</td>
                        <td className="p-4 font-sans">{new Date(val.tanggal_validasi).toLocaleDateString("id-ID")}</td>
                        <td className="p-4 font-sans">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${val.status_validasi === "Valid" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-rose-50 text-rose-700 border border-rose-200"}`}>
                            {val.status_validasi}
                          </span>
                        </td>
                        <td className="p-4 font-sans max-w-xs truncate">{val.catatan || val.keterangan || "-"}</td>
                        <td className="p-4 text-right font-sans">
                          <button onClick={() => triggerDeleteValidation(val.id)} className="text-rose-600 hover:text-rose-800" title="Hapus Validasi">
                            <Trash2 className="w-4 h-4 inline" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ================= MENU: FEATURE MAP CNN ================= */}
          {!isEditingMotifPage && currentMenu === "Feature Map CNN" && (
            <div className="bg-white border-2 border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
              <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                <div className="text-left">
                  <h3 className="text-xl font-black text-slate-900 font-sans">Feature Map CNN</h3>
                  <p className="text-sm text-slate-500">Visualisasi representasi fitur spasial konvolusi stem block neural network model LeViT.</p>
                </div>
              </div>

              {/* Feature Map CNN Table */}
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-sm text-slate-800 border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600 uppercase font-bold">
                    <tr>
                      <th className="p-4">ID Feature Map</th>
                      <th className="p-4">ID Hasil Prediksi</th>
                      <th className="p-4">Gambar Batik Asli</th>
                      <th className="p-4">Peta Fitur Spasial</th>
                      <th className="p-4 text-right">Opsi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-sm">
                    {featureMapCnnList.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-slate-400 font-sans">
                          Belum ada data Feature Map CNN terekam. Silakan lakukan klasifikasi motif batik.
                        </td>
                      </tr>
                    ) : (
                      featureMapCnnList.map((cnn) => {
                        const matchingPred = hasilPrediksiList.find(p => p.id === cnn.hasil_prediksi_id);
                        const matchingImg = matchingPred ? dataGambarList.find(g => g.id === matchingPred.gambar_id) : null;
                        return (
                          <tr key={cnn.id} className="hover:bg-slate-50/40">
                            <td className="p-4 font-bold text-indigo-700">CNN-{cnn.id}</td>
                            <td className="p-4 font-bold text-indigo-650">{formatId(cnn.hasil_prediksi_id, "PREDIKSI")}</td>
                            <td className="p-4">
                              {matchingImg?.file_foto_batik ? (
                                <img 
                                  src={matchingImg.file_foto_batik} 
                                  alt="Batik Asli" 
                                  className="w-12 h-12 rounded-lg object-cover border border-slate-200"
                                />
                              ) : (
                                <span className="text-slate-400 font-sans text-xs">Belum ada gambar</span>
                              )}
                            </td>
                            <td className="p-4">
                              {cnn.file_heatmap_cnn ? (
                                <img 
                                  src={cnn.file_heatmap_cnn} 
                                  alt="CNN Heatmap" 
                                  className="w-12 h-12 rounded-lg object-cover border border-slate-200"
                                />
                              ) : (
                                <span className="text-slate-400 font-sans text-xs">Tidak ada peta</span>
                              )}
                            </td>
                            <td className="p-4 text-right font-sans">
                              <button
                                onClick={() => {
                                  setPreviewMapImage(cnn.file_heatmap_cnn);
                                  setPreviewMapTitle(`Feature Map CNN - ID ${cnn.id}`);
                                }}
                                className="p-1.5 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg transition-colors inline-flex items-center space-x-1"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Lihat Detail</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ================= MENU: ATTENTION MAP VIT ================= */}
          {!isEditingMotifPage && currentMenu === "Attention Map VIT" && (
            <div className="bg-white border-2 border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
              <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                <div className="text-left">
                  <h3 className="text-xl font-black text-slate-900 font-sans">Attention Map VIT</h3>
                  <p className="text-sm text-slate-500">Visualisasi bobot multi-head self-attention transformer pada patch gambar batik.</p>
                </div>
              </div>

              {/* Attention Map ViT Table */}
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-sm text-slate-800 border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600 uppercase font-bold">
                    <tr>
                      <th className="p-4">ID Attention Map</th>
                      <th className="p-4">ID Hasil Prediksi</th>
                      <th className="p-4">Gambar Batik Asli</th>
                      <th className="p-4">Peta Atensi ViT</th>
                      <th className="p-4 text-right">Opsi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-sm">
                    {attentionMapVitList.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-slate-400 font-sans">
                          Belum ada data Attention Map VIT terekam. Silakan lakukan klasifikasi motif batik.
                        </td>
                      </tr>
                    ) : (
                      attentionMapVitList.map((vit) => {
                        const matchingPred = hasilPrediksiList.find(p => p.id === vit.hasil_prediksi_id);
                        const matchingImg = matchingPred ? dataGambarList.find(g => g.id === matchingPred.gambar_id) : null;
                        const heatmapSrc = vit.file_heatmap_vit || vit.file_heatmap_cnn;
                        return (
                          <tr key={vit.id} className="hover:bg-slate-50/40">
                            <td className="p-4 font-bold text-indigo-700">VIT-{vit.id}</td>
                            <td className="p-4 font-bold text-indigo-650">{formatId(vit.hasil_prediksi_id, "PREDIKSI")}</td>
                            <td className="p-4">
                              {matchingImg?.file_foto_batik ? (
                                <img 
                                  src={matchingImg.file_foto_batik} 
                                  alt="Batik Asli" 
                                  className="w-12 h-12 rounded-lg object-cover border border-slate-200"
                                />
                              ) : (
                                <span className="text-slate-400 font-sans text-xs">Belum ada gambar</span>
                              )}
                            </td>
                            <td className="p-4">
                              {heatmapSrc ? (
                                <img 
                                  src={heatmapSrc} 
                                  alt="ViT Heatmap" 
                                  className="w-12 h-12 rounded-lg object-cover border border-slate-200"
                                />
                              ) : (
                                <span className="text-slate-400 font-sans text-xs">Tidak ada peta</span>
                              )}
                            </td>
                            <td className="p-4 text-right font-sans">
                              <button
                                onClick={() => {
                                  setPreviewMapImage(heatmapSrc || null);
                                  setPreviewMapTitle(`Attention Map VIT - ID ${vit.id}`);
                                }}
                                className="p-1.5 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg transition-colors inline-flex items-center space-x-1"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Lihat Detail</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ================= MENU: HASIL PREDIKSI MOTIF BATIK ================= */}
          {!isEditingMotifPage && currentMenu === "Hasil Prediksi Motif Batik" && (
            <div className="bg-white border-2 border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-100 pb-4 gap-4">
                <div className="text-left">
                  <h3 className="text-xl font-black text-slate-900 font-sans">Hasil Prediksi Motif Batik</h3>
                  <p className="text-sm text-slate-500">Log pencatatan kecocokan visual model kecerdasan buatan terhadap motif batik.</p>
                </div>
                <div className="relative w-full md:w-64">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Search className="w-4 h-4" />
                  </span>
                  <input 
                    type="text"
                    placeholder="Cari hasil prediksi..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl py-2 pl-9 pr-4 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
              </div>

              {/* HISTORI PREDIKSI TABLE */}
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-sm text-slate-800 border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600 uppercase font-bold">
                    <tr>
                      <th className="p-4">ID Prediksi</th>
                      <th className="p-4">Gambar ID</th>
                      <th className="p-4">Pratinjau</th>
                      <th className="p-4">Tanggal Identifikasi</th>
                      <th className="p-4">Prediksi Utama</th>
                      <th className="p-4">Akurasi</th>
                      <th className="p-4">Pegawai</th>
                      <th className="p-4 text-right">Opsi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {filteredPrediksi.map((pred) => {
                      // Find matching motif data
                      const matchedMotif = dataMotifList.find(m => m.id === pred.motif_id);
                      // Find associated image data
                      const matchedImg = dataGambarList.find(g => g.id === pred.gambar_id);

                      return (
                        <tr key={pred.id} className="hover:bg-slate-50/40">
                          <td className="p-4 font-mono font-bold text-indigo-700">{formatId(pred.id, "PREDIKSI")}</td>
                          <td className="p-4 font-mono text-slate-500">{formatId(pred.gambar_id, "GAMBAR")}</td>
                          <td className="p-4">
                            {matchedImg?.file_foto_batik ? (
                              <img 
                                src={matchedImg.file_foto_batik} 
                                alt="Batik Asli" 
                                className="w-12 h-12 rounded-lg object-cover border border-slate-200 cursor-zoom-in hover:opacity-85 transition-opacity"
                                onClick={() => {
                                  setPreviewMapImage(matchedImg.file_foto_batik);
                                  setPreviewMapTitle(`Pratinjau Gambar - ${formatId(pred.gambar_id, "GAMBAR")}`);
                                }}
                              />
                            ) : (
                              <span className="text-slate-400 text-xs font-sans">Tidak ada gambar</span>
                            )}
                          </td>
                          <td className="p-4 font-sans text-slate-600">{new Date(pred.tanggal_prediksi).toLocaleDateString("id-ID", { hour: "2-digit", minute: "2-digit" })}</td>
                          <td className="p-4 font-sans font-bold text-slate-900">{pred.prediksi_utama.replace(/_/g, " ").toUpperCase()}</td>
                          <td className="p-4 font-sans">
                            <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 font-bold rounded-lg border border-indigo-200">
                              {(pred.akurasi_utama * 100).toFixed(1)}%
                            </span>
                          </td>
                          <td className="p-4 font-mono font-bold text-slate-600">{formatId(pred.pegawai_id, "PEGAWAI")}</td>
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                              <button 
                                onClick={() => {
                                  if (matchedMotif) {
                                    setSelectedDetailedMotif(matchedMotif);
                                    setSelectedDetailedImage(matchedImg ? matchedImg.file_foto_batik : null);
                                  } else {
                                    triggerAlert("error", "Data spesifikasi motif Kaggle tidak ditemukan.");
                                  }
                                }}
                                className="p-1.5 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg text-xs inline-flex items-center space-x-1 shrink-0 transition-colors cursor-pointer"
                                title="Lihat Rincian Filosofi"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Lihat Rincian</span>
                              </button>
                              <button 
                                onClick={() => triggerDeletePrediction(pred.id)} 
                                className="p-1.5 px-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 rounded-lg text-xs font-bold inline-flex items-center shrink-0 transition-colors cursor-pointer"
                                title="Hapus Prediksi"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ================= MENU: DATA MOTIF BATIK KAGGLE ================= */}
          {!isEditingMotifPage && currentMenu === "Data Motif Batik Kaggle" && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-100 pb-4 gap-4">
                <div className="text-left">
                  <h3 className="text-xl font-bold text-slate-800 font-sans tracking-tight">Data Motif Batik Kaggle</h3>
                  <p className="text-xs text-slate-400 mt-1">Referensi pustaka batik luhur. Admin memiliki hak penuh menyunting data motif luhur.</p>
                </div>
                <div className="relative w-full md:w-64">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Search className="w-4 h-4" />
                  </span>
                  <input 
                    type="text"
                    placeholder="Cari motif..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 focus:border-indigo-500 rounded-xl py-2 pl-9 pr-4 text-xs text-slate-800 placeholder-slate-400 focus:outline-none transition-all"
                  />
                </div>
              </div>

              {/* Tabular data representation */}
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-sm text-slate-800 border-collapse">
                  <thead className="bg-[#f8fafc] border-b border-slate-150 text-[11px] text-slate-500 uppercase tracking-wider font-semibold">
                    <tr>
                      <th className="p-4">PRATINJAU</th>
                      <th className="p-4">ID</th>
                      <th className="p-4">NAMA MOTIF</th>
                      <th className="p-4">ASAL DAERAH</th>
                      <th className="p-4">PENGGUNAAN ACARA</th>
                      <th className="p-4">MAKNA FILOSOFIS</th>
                      <th className="p-4 text-right">OPSI</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm bg-white">
                    {filteredMotif.map((motif) => {
                      let imageGallery: string[] = [];
                      try {
                        imageGallery = JSON.parse(motif.contoh_gambar || "[]");
                      } catch {
                        if (motif.contoh_gambar) {
                          imageGallery = motif.contoh_gambar.split(",").map(url => url.trim());
                        }
                      }
                      const thumbnail = imageGallery.length > 0 ? imageGallery[0] : null;

                      return (
                        <tr key={motif.id} className="hover:bg-slate-50/40 transition-colors">
                          <td className="p-4 align-middle">
                            {thumbnail ? (
                              <img 
                                src={thumbnail} 
                                alt={motif.nama_motif} 
                                className="w-11 h-11 rounded-lg object-cover border border-slate-200 cursor-zoom-in hover:opacity-85 transition-opacity"
                                onClick={() => {
                                  setPreviewMapImage(thumbnail);
                                  setPreviewMapTitle(`Gambar Referensi - ${motif.nama_motif.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}`);
                                }}
                              />
                            ) : (
                              <span className="text-slate-400 text-xs font-sans italic">Belum ada</span>
                            )}
                          </td>
                          <td className="p-4 align-middle font-semibold text-blue-600 font-mono text-xs">
                            #MTF-{motif.id}
                          </td>
                          <td className="p-4 align-middle font-medium text-slate-800 text-sm">
                            {motif.nama_motif.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}
                          </td>
                          <td className="p-4 align-middle">
                            <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded uppercase ${getRegionBadgeStyles(motif.asal_daerah)}`}>
                              {motif.asal_daerah.toUpperCase()}
                            </span>
                          </td>
                          <td className="p-4 align-middle text-xs text-slate-700 font-sans leading-relaxed max-w-[240px] break-words">
                            {motif.occasion}
                          </td>
                          <td className="p-4 align-middle text-xs text-slate-500 font-sans leading-relaxed max-w-[280px] break-words">
                            {motif.makna_filosofis}
                          </td>
                          <td className="p-4 align-middle text-right">
                            <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                              <button 
                                onClick={() => {
                                  setSelectedDetailedMotif(motif);
                                  setSelectedDetailedImage(null);
                                }}
                                className="px-3.5 py-1 bg-white hover:bg-slate-50 border border-slate-250 text-slate-600 hover:text-slate-900 text-[11px] font-semibold rounded-full transition-colors cursor-pointer shadow-xs inline-flex items-center"
                              >
                                Lihat Rincian
                              </button>
                              {currentUser?.role === "ADMIN" && (
                                <button 
                                  onClick={() => handleOpenEditMotifPage(motif)}
                                  className="px-3.5 py-1 bg-white hover:bg-slate-50 border border-slate-250 text-slate-600 hover:text-slate-900 text-[11px] font-semibold rounded-full transition-colors cursor-pointer shadow-xs inline-flex items-center"
                                >
                                  Edit
                                </button>
                              )}
                              {currentUser?.role === "ADMIN" && (
                                <button 
                                  onClick={() => triggerDeleteMotif(motif.id)}
                                  className="p-1 px-2.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 hover:text-rose-800 text-[11px] font-semibold rounded-full transition-colors cursor-pointer shadow-xs inline-flex items-center"
                                  title="Hapus Motif"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ================= MENU: LAPORAN ================= */}
          {!isEditingMotifPage && currentMenu === "Laporan" && (
            <div className="space-y-6">
              <LaporanView 
                hasilPrediksiList={hasilPrediksiList}
                dataMotifList={dataMotifList}
                pegawaiList={pegawaiList}
              />
            </div>
          )}

        </div>
      </main>

      {/* ================= DETAILED filosofi & GALERI MODAL ================= */}
      {selectedDetailedMotif && (
        <MotifDetailedView 
          motif={selectedDetailedMotif}
          onClose={() => {
            setSelectedDetailedMotif(null);
            setSelectedDetailedImage(null);
          }}
          uploadedImage={selectedDetailedImage}
        />
      )}

      {/* ================= CASCADE DELETE CONFIRMATION SYSTEM MODAL ================= */}
      {deleteConfirmation && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border-2 border-slate-300 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl p-6 text-slate-800 space-y-4 animate-fade-in text-left">
            <div className="flex items-center space-x-3 text-rose-600">
              <AlertCircle className="w-7 h-7" />
              <h3 className="text-lg font-black tracking-tight uppercase font-sans">PERINGATAN PENGHAPUSAN CASCADE</h3>
            </div>
            
            <div className="border-t border-b border-slate-100 py-3 space-y-2">
              <h4 className="font-bold text-slate-900">{deleteConfirmation.title}</h4>
              <p className="text-sm text-slate-600">
                Menghapus entitas ini berisiko melanggar constraint integritas basis data. Tindakan ini akan memicu penghapusan seketika (CASCADE) pada data berikut dari sistem:
              </p>
              <div className="bg-rose-50/50 p-3 rounded-xl border border-rose-100 text-sm space-y-1 text-slate-700">
                {deleteConfirmation.details.map((detail, idx) => (
                  <p key={idx} className="font-semibold">{detail}</p>
                ))}
              </div>
            </div>

            <p className="text-xs text-rose-600 font-bold uppercase italic tracking-wider">
              *TINDAKAN INI BERSIFAT PERMANEN & TIDAK DAPAT DIURUNKAN DI DATABASE!
            </p>

            <div className="flex justify-end space-x-2 pt-2">
              <button 
                onClick={() => setDeleteConfirmation(null)}
                disabled={isDeletingLoading}
                className="px-4 py-2 border-2 border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-xl text-sm cursor-pointer disabled:opacity-50"
              >
                Batal
              </button>
              <button 
                onClick={deleteConfirmation.onConfirm}
                disabled={isDeletingLoading}
                className="px-6 py-2 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-400 text-white font-bold rounded-xl text-sm cursor-pointer flex items-center space-x-1"
              >
                {isDeletingLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Menghapus...</span>
                  </>
                ) : (
                  <span>Konfirmasi Hapus Cascade</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= HEATMAP PREVIEW MODAL ================= */}
      {previewMapImage && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border-2 border-slate-200 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl p-6 text-slate-800 space-y-4 animate-fade-in relative text-left">
            <button 
              onClick={() => {
                setPreviewMapImage(null);
                setPreviewMapTitle("");
              }}
              className="absolute top-4 right-4 p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 rounded-full transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="space-y-1 pr-10">
              <h3 className="text-lg font-black tracking-tight text-slate-900 font-sans">{previewMapTitle || "Pratinjau Peta Panas"}</h3>
              <p className="text-sm text-slate-500">Visualisasi intensitas spasial hasil kalkulasi model kecerdasan buatan.</p>
            </div>
            
            <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-950 aspect-[4/3] flex items-center justify-center shadow-inner relative">
              <img 
                src={previewMapImage} 
                referrerPolicy="no-referrer"
                alt="Heatmap Preview" 
                className="max-w-full max-h-full object-contain"
              />
            </div>

            <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 flex items-start space-x-3 text-slate-700">
              <Sparkles className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <span className="font-bold text-indigo-900 block">Peta Aktivitas Neural Network</span>
                <p className="text-indigo-800/90 leading-relaxed">
                  Warna yang lebih cerah mengindikasikan atensi dan konsentrasi fitur visual yang paling krusial bagi model dalam menentukan klasifikasi motif batik.
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button 
                onClick={() => {
                  setPreviewMapImage(null);
                  setPreviewMapTitle("");
                }}
                className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm transition-all shadow-md cursor-pointer"
              >
                Tutup Pratinjau
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= LOGOUT CONFIRMATION MODAL ================= */}
      {isLogoutConfirmOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border-2 border-slate-200 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl p-6 text-slate-800 space-y-4 animate-fade-in text-center">
            <div className="w-12 h-12 bg-rose-50 border border-rose-100 rounded-2xl mx-auto flex items-center justify-center text-rose-600">
              <LogOut className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-extrabold tracking-tight text-slate-900 font-sans">Konfirmasi Keluar Sesi</h3>
              <p className="text-sm text-slate-500">Apakah Anda yakin ingin keluar dari sistem BatikLens dan mengakhiri sesi aktif Anda?</p>
            </div>
            
            <div className="flex space-x-3 pt-2">
              <button 
                onClick={() => setIsLogoutConfirmOpen(false)}
                className="flex-1 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold border border-slate-200 rounded-xl text-sm transition-all cursor-pointer"
              >
                Batal
              </button>
              <button 
                onClick={executeLogout}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-sm transition-all shadow-md shadow-rose-100 cursor-pointer"
              >
                Ya, Keluar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
