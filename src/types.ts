export interface User {
  id: number;
  username: string;
  name: string;
  role: "ADMIN" | "STAFF" | "CUSTOMER";
}

export interface AdminModel {
  id: number;
  username: string;
  password: string;
  nama_admin: string;
}

export interface PegawaiModel {
  id: number;
  username: string;
  password: string;
  nama_pegawai: string;
  adminid?: number;
  admin_id?: number;
}

export interface CustomerModel {
  id: number;
  nama_customer: string;
  no_telepon: string;
  keperluan: string;
  tanggal_kunjungan: string;
  admin_id: number | null;
  pegawai_id: number | null;
}

export interface DataGambarMotifBatikModel {
  id: number;
  tanggal_foto: string;
  file_foto_batik: string;
  pegawai_id: number;
}

export interface HasilValidasiGambarMotifBatikModel {
  id: number;
  tanggal_validasi: string;
  status_validasi: "Valid" | "Invalid";
  keterangan?: string;
  catatan?: string;
  data_gambar_id?: number;
  gambar_id?: number;
}

export interface DataMotifBatikKaggleModel {
  id: number;
  nama_motif: string;
  asal_daerah: string;
  makna_filosofis: string;
  occasion: string;
  contoh_gambar: string; // JSON string encoded array of strings e.g., '["url1", "url2"]'
}

export interface HasilPrediksiMotifBatikModel {
  id: number;
  tanggal_prediksi: string;
  prediksi_utama: string;
  akurasi_utama: number;
  prediksi_sekunder: string;
  akurasi_sekunder: number;
  gambar_id: number;
  motif_id: number;
  pegawai_id: number;
}

export interface FeatureMapCnnModel {
  id: number;
  file_heatmap_cnn: string;
  hasil_prediksi_id: number;
  hasil_validasi_id: number;
}

export interface AttentionMapVitModel {
  id: number;
  file_heatmap_cnn?: string;
  file_heatmap_vit?: string;
  hasil_prediksi_id: number;
  feature_map_cnn_id: number;
  hasil_validasi_id: number;
}

export interface LaporanModel {
  id: number;
  periode_bulan: string;
  total_prediksi: number;
  motif_id: number;
}
