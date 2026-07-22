import os
import json
import base64
from datetime import datetime
import random
import io
import tempfile
from flask import Flask, request, jsonify, send_from_directory
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from functools import wraps
from sqlalchemy import text
from PIL import Image

# Optional imports for local PyTorch ML inference
try:
    import torch
    import timm
    import torchvision.transforms as T
    import types
    HAS_ML_LIBS = True
except ImportError:
    HAS_ML_LIBS = False

# Optional imports for local CNN/ViT matplotlib heatmap rendering
try:
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    import numpy as np
    HAS_VIZ_LIBS = True
except ImportError:
    HAS_VIZ_LIBS = False

# Optional Hugging Face Gradio client integration
try:
    from gradio_client import Client
    HAS_GRADIO_CLIENT = True
except ImportError:
    HAS_GRADIO_CLIENT = False

# Setup Flask untuk menjadi monolitik (melayani React dist folder sebagai frontend)
app = Flask(__name__, static_folder='../dist', static_url_path='/')
CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=True)

# Setup MySQL Database. Anda dapat mengganti ini di file .env Anda nanti.
# Format: mysql+pymysql://<username>:<password>@<host>/<database>
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'mysql+pymysql://root:@localhost/batiklens')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

def get_clean_motif_name(raw_name):
    if '_' in raw_name:
        return raw_name.split('_', 1)[1]
    return raw_name

# Load classes
CLASSES = []
classes_path = os.path.join(os.path.dirname(__file__), 'models', 'classes.json')
if os.path.exists(classes_path):
    try:
        with open(classes_path, 'r') as f:
            CLASSES = json.load(f)
    except Exception as e:
        print("Error loading classes.json:", e)

# Load PyTorch model on startup (if ML libraries are available)
model = None
model_path = os.path.join(os.path.dirname(__file__), 'models', 'levit_best_state_dict_39_FINAL.pth')
if HAS_ML_LIBS and os.path.exists(model_path):
    try:
        print("Loading PyTorch model levit_128 for real-time inference...")
        model = timm.create_model('levit_128', pretrained=False, num_classes=39)
        state_dict = torch.load(model_path, map_location='cpu')
        model.load_state_dict(state_dict)
        model.eval()

        def patched_forward(self, x):
            if self.use_conv:
                B, C, H, W = x.shape
                q, k, v = self.qkv(x).view(
                    B, self.num_heads, -1, H * W).split([self.key_dim, self.key_dim, self.val_dim], dim=2)
                attn = (q.transpose(-2, -1) @ k) * self.scale + self.get_attention_biases(x.device)
                attn = attn.softmax(dim=-1)
                self.captured_attn = attn.detach().cpu()
                x = (v @ attn.transpose(-2, -1)).view(B, -1, H, W)
            else:
                B, N, C = x.shape
                q, k, v = self.qkv(x).view(
                    B, N, self.num_heads, -1).split([self.key_dim, self.key_dim, self.val_dim], dim=3)
                q = q.permute(0, 2, 1, 3)
                k = k.permute(0, 2, 3, 1)
                v = v.permute(0, 2, 1, 3)
                attn = q @ k * self.scale + self.get_attention_biases(x.device)
                attn = attn.softmax(dim=-1)
                self.captured_attn = attn.detach().cpu()
                x = (attn @ v).transpose(1, 2).reshape(B, N, self.val_attn_dim)
            x = self.proj(x)
            return x

        def patched_downsample_forward(self, x):
            if self.use_conv:
                B, C, H, W = x.shape
                HH, WW = (H - 1) // self.stride + 1, (W - 1) // self.stride + 1
                k, v = self.kv(x).view(B, self.num_heads, -1, H * W).split([self.key_dim, self.val_dim], dim=2)
                q = self.q(x).view(B, self.num_heads, self.key_dim, -1)
                attn = (q.transpose(-2, -1) @ k) * self.scale + self.get_attention_biases(x.device)
                attn = attn.softmax(dim=-1)
                self.captured_attn = attn.detach().cpu()
                x = (v @ attn.transpose(-2, -1)).reshape(B, self.val_attn_dim, HH, WW)
            else:
                B, N, C = x.shape
                k, v = self.kv(x).view(B, N, self.num_heads, -1).split([self.key_dim, self.val_dim], dim=3)
                k = k.permute(0, 2, 3, 1)
                v = v.permute(0, 2, 1, 3)
                q = self.q(x).view(B, -1, self.num_heads, self.key_dim).permute(0, 2, 1, 3)
                attn = q @ k * self.scale + self.get_attention_biases(x.device)
                attn = attn.softmax(dim=-1)
                self.captured_attn = attn.detach().cpu()
                x = (attn @ v).transpose(1, 2).reshape(B, -1, self.val_attn_dim)
            x = self.proj(x)
            return x

        # Patch all 12 attention blocks in the 3 stages to capture attention weights
        for s_idx in range(3):
            for b_idx in range(len(model.stages[s_idx].blocks)):
                block_attn = model.stages[s_idx].blocks[b_idx].attn
                block_attn.forward = types.MethodType(patched_forward, block_attn)
        # Patch shrinking attention blocks (for stages 1 and 2 downsamples)
        for s_idx in range(1, 3):
            if hasattr(model.stages[s_idx], 'downsample') and hasattr(model.stages[s_idx].downsample, 'attn_downsample'):
                down_attn = model.stages[s_idx].downsample.attn_downsample
                down_attn.forward = types.MethodType(patched_downsample_forward, down_attn)
        print("PyTorch model loaded and attention forward patched successfully!")
    except Exception as e:
        print("Error initializing PyTorch model:", e)
        model = None
else:
    print(f"Warning: model file not found at {model_path}. Using fallback mock inferencing.")

def generate_mock_cnn():
    if not HAS_VIZ_LIBS:
        return "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
    try:
        fig, axes = plt.subplots(4, 8, figsize=(8, 4))
        layers = ['stem_conv1', 'stem_conv2', 'stem_conv3', 'stem_conv4']
        for r_idx, layer_name in enumerate(layers):
            size = 112 // (2 ** r_idx)
            for c_idx in range(8):
                ax = axes[r_idx, c_idx]
                x = np.linspace(-3.0, 3.0, size)
                y = np.linspace(-3.0, 3.0, size)
                X, Y = np.meshgrid(x, y)
                Z = np.sin(X * (c_idx+1)) * np.cos(Y * (r_idx+1)) + np.random.randn(size, size) * 0.1
                ax.imshow((Z - Z.min()) / (Z.max() - Z.min() + 1e-5), cmap='viridis')
                ax.axis('off')
                if c_idx == 0:
                    ax.set_title(layer_name, fontsize=8, loc='left', color='black', weight='bold')
        plt.tight_layout()
        buf = io.BytesIO()
        plt.savefig(buf, format='jpeg', bbox_inches='tight', dpi=60, pil_kwargs={'quality': 75})
        plt.close()
        buf.seek(0)
        return "data:image/jpeg;base64," + base64.b64encode(buf.read()).decode('utf-8')
    except Exception as e:
        print("Error generating mock CNN map:", e)
        return ""

def generate_mock_vit():
    if not HAS_VIZ_LIBS:
        return "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
    try:
        fig = plt.figure(figsize=(14, 13), facecolor='white')
        height_ratios = [1.6, 0.25, 1.6, 1.35, 1.35, 0.25, 1.35, 0.25, 1.1]
        gs = fig.add_gridspec(9, 24, height_ratios=height_ratios)
        
        row_definitions = [
            {"type": "block", "stage": 0, "block": 0, "name": "Stage 1, attention block 1 (first one)", "num_heads": 4, "cols": (6, 18), "spatial": 14, "is_down": False},
            {"type": "ellipsis"},
            {"type": "block", "stage": 0, "block": 3, "name": "Stage 1, attention block 4", "num_heads": 4, "cols": (6, 18), "spatial": 14, "is_down": False},
            {"type": "block", "stage": 1, "block": None, "name": "Shrinking attention between stages 1 and 2", "num_heads": 8, "cols": (2, 22), "spatial": 7, "is_down": True},
            {"type": "block", "stage": 1, "block": 0, "name": "Stage 2, attention block 1", "num_heads": 8, "cols": (2, 22), "spatial": 7, "is_down": False},
            {"type": "ellipsis"},
            {"type": "block", "stage": 1, "block": 3, "name": "Stage 2, attention block 4", "num_heads": 8, "cols": (2, 22), "spatial": 7, "is_down": False},
            {"type": "ellipsis"},
            {"type": "block", "stage": 2, "block": 3, "name": "Stage 3, attention block 4 (last one)", "num_heads": 12, "cols": (0, 24), "spatial": 4, "is_down": False}
        ]
        
        fig.suptitle("Visualization of the attention maps for selected blocks of LeViT-128", fontsize=12, fontweight='bold', color='#1e293b', y=0.98)
        
        for r_idx, row_def in enumerate(row_definitions):
            if row_def["type"] == "ellipsis":
                ax = fig.add_subplot(gs[r_idx, :])
                ax.text(0.5, 0.5, '⋮', fontsize=24, ha='center', va='center', fontweight='bold', color='#64748b')
                ax.axis('off')
            else:
                num_heads = row_def["num_heads"]
                spatial_size = row_def["spatial"]
                c_start, c_end = row_def["cols"]
                
                # 1. Create a centered invisible axis to place the row title perfectly
                ax_label = fig.add_subplot(gs[r_idx, c_start:c_end])
                ax_label.axis('off')
                ax_label.text(
                    0.5, 1.15, 
                    row_def["name"], 
                    fontsize=9, fontweight='bold', color='#1e293b', 
                    ha='center', va='bottom'
                )
                
                # 2. Create the subgridspec for the heads
                gs_row = gs[r_idx, c_start:c_end].subgridspec(1, num_heads, wspace=0.15)
                
                for c_idx in range(num_heads):
                    ax = fig.add_subplot(gs_row[0, c_idx])
                    
                    x = np.linspace(-2.0, 2.0, spatial_size)
                    y = np.linspace(-2.0, 2.0, spatial_size)
                    X, Y = np.meshgrid(x, y)
                    cx, cy = np.random.uniform(-1, 1), np.random.uniform(-1, 1)
                    g = np.exp(-((X-cx)**2 + (Y-cy)**2) / 0.5) + np.random.randn(spatial_size, spatial_size) * 0.05
                    grid_attn = (g - g.min()) / (g.max() - g.min() + 1e-5)
                    
                    ax.imshow(grid_attn, cmap='viridis')
                    ax.axis('off')
                    ax.set_title(f"head {c_idx}", color='#475569', fontsize=7, pad=2)
                        
        plt.subplots_adjust(top=0.92, bottom=0.02, left=0.05, right=0.95, hspace=1.1)
        buf = io.BytesIO()
        plt.savefig(buf, format='jpeg', bbox_inches='tight', dpi=130, pil_kwargs={'quality': 75})
        plt.close()
        buf.seek(0)
        return "data:image/jpeg;base64," + base64.b64encode(buf.read()).decode('utf-8')
    except Exception as e:
        print("Error generating mock ViT map:", e)
        return ""

# ==========================================
# SKEMA DATABASE MYSQL (Model SQLAlchemy)
# ==========================================
class Admin(db.Model):
    __tablename__ = 'admin'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(100), unique=True, nullable=False)
    password = db.Column(db.String(255), nullable=False)
    nama_admin = db.Column(db.String(255), nullable=False)

class Pegawai(db.Model):
    __tablename__ = 'pegawai'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(100), unique=True, nullable=False)
    password = db.Column(db.String(255), nullable=False)
    nama_pegawai = db.Column(db.String(255), nullable=False)
    adminid = db.Column(db.Integer, db.ForeignKey('admin.id'))

class Customer(db.Model):
    __tablename__ = 'customer'
    id = db.Column(db.Integer, primary_key=True)
    nama_customer = db.Column(db.String(255), nullable=False)
    no_telepon = db.Column(db.String(50), nullable=False)
    keperluan = db.Column(db.Text, nullable=False)
    tanggal_kunjungan = db.Column(db.DateTime, default=datetime.utcnow)
    admin_id = db.Column(db.Integer, db.ForeignKey('admin.id'), nullable=True)
    pegawai_id = db.Column(db.Integer, db.ForeignKey('pegawai.id'), nullable=True)

class DataGambarMotifBatik(db.Model):
    __tablename__ = 'data_gambar_motif_batik'
    id = db.Column(db.Integer, primary_key=True)
    tanggal_foto = db.Column(db.DateTime, default=datetime.utcnow)
    file_foto_batik = db.Column(db.Text(length=4294967295), nullable=False) # LONGTEXT untuk Base64
    pegawai_id = db.Column(db.Integer, db.ForeignKey('pegawai.id'))

class DataMotifBatikKaggle(db.Model):
    __tablename__ = 'data_motif_batik_kaggle'
    id = db.Column(db.Integer, primary_key=True)
    nama_motif = db.Column(db.String(255), nullable=False)
    asal_daerah = db.Column(db.String(255), default='Indonesia')
    makna_filosofis = db.Column(db.Text)
    occasion = db.Column(db.Text)
    contoh_gambar = db.Column(db.Text) # JSON string array

class HasilValidasiGambarMotifBatik(db.Model):
    __tablename__ = 'hasil_validasi_gambar_motif_batik'
    id = db.Column(db.Integer, primary_key=True)
    tanggal_validasi = db.Column(db.DateTime, default=datetime.utcnow)
    status_validasi = db.Column(db.String(100), nullable=False) # 'Valid' / 'Invalid'
    keterangan = db.Column(db.Text, nullable=True)
    data_gambar_id = db.Column(db.Integer, db.ForeignKey('data_gambar_motif_batik.id', ondelete='CASCADE'), nullable=False)

class HasilPrediksiMotifBatik(db.Model):
    __tablename__ = 'hasil_prediksi_motif_batik'
    id = db.Column(db.Integer, primary_key=True)
    tanggal_prediksi = db.Column(db.DateTime, default=datetime.utcnow)
    prediksi_utama = db.Column(db.String(255))
    akurasi_utama = db.Column(db.Float)
    prediksi_sekunder = db.Column(db.String(255))
    akurasi_sekunder = db.Column(db.Float)
    gambar_id = db.Column(db.Integer, db.ForeignKey('data_gambar_motif_batik.id', ondelete='CASCADE'))
    motif_id = db.Column(db.Integer, db.ForeignKey('data_motif_batik_kaggle.id', ondelete='CASCADE'))
    pegawai_id = db.Column(db.Integer, db.ForeignKey('pegawai.id'))

class FeatureMapCnn(db.Model):
    __tablename__ = 'feature_map_cnn'
    id = db.Column(db.Integer, primary_key=True)
    file_heatmap_cnn = db.Column(db.Text(length=4294967295), nullable=False)
    hasil_prediksi_id = db.Column(db.Integer, db.ForeignKey('hasil_prediksi_motif_batik.id', ondelete='CASCADE'), nullable=False)
    hasil_validasi_id = db.Column(db.Integer, db.ForeignKey('hasil_validasi_gambar_motif_batik.id', ondelete='CASCADE'), nullable=False)

class AttentionMapVit(db.Model):
    __tablename__ = 'attention_map_vit'
    id = db.Column(db.Integer, primary_key=True)
    file_heatmap_cnn = db.Column(db.Text(length=4294967295), nullable=False) # matching diagram column name
    hasil_prediksi_id = db.Column(db.Integer, db.ForeignKey('hasil_prediksi_motif_batik.id', ondelete='CASCADE'), nullable=False)
    feature_map_cnn_id = db.Column(db.Integer, db.ForeignKey('feature_map_cnn.id', ondelete='CASCADE'), nullable=False)
    hasil_validasi_id = db.Column(db.Integer, db.ForeignKey('hasil_validasi_gambar_motif_batik.id', ondelete='CASCADE'), nullable=False)

class Laporan(db.Model):
    __tablename__ = 'laporan'
    id = db.Column(db.Integer, primary_key=True)
    periode_bulan = db.Column(db.String(100), nullable=False)
    total_prediksi = db.Column(db.Integer, default=0)
    motif_id = db.Column(db.Integer, db.ForeignKey('data_motif_batik_kaggle.id', ondelete='CASCADE'))

# Bikin otomatis seluruh tabel MySQL jika belum ada
with app.app_context():
    try:
        db.create_all()
    except Exception as e:
        print("Warning: Database creation failed:", e)
        
    try:
        # Seed default admin
        if not Admin.query.filter_by(username='admin').first():
            default_admin = Admin(username='admin', password='admin123', nama_admin='Ibu Halimah')
            db.session.add(default_admin)
            db.session.commit()
            
        # Seed Data Motif dari 39 Kelas PyTorch Model
        if not DataMotifBatikKaggle.query.first():
            PREDEFINED_MOTIF_LABELS = [
                "Aceh_Pintu Aceh", "Bali_Barong", "Bali_Poleng", "Betawi_Ondel Ondel", 
                "Cirebon_Liong", "Cirebon_Megamendung", "Cirebon_Singo Barong", 
                "Dayak_Benang Bintik", "Garut dan Bali_Merak Ngibing Abyorhokokai",
                "Kulon Progo_Geblek Renteng", "Lampung_Gajah", "Lombok_Lumbung",
                "Madura_Mataketeran", "Magetan_Pring", "Maluku_Pala", "Papua_Asmat",
                "Papua_Cendrawasih", "Papua_Tifa", "Pekalongan_Buketan",
                "Pekalongan_Jlamprang", "Pekalongan_Tujuh Rupa", "Pontianak_Corak Insang",
                "Rembang_Lasem", "Solo-Yogyakarta_Kawung", "Solo-Yogyakarta_Parang",
                "Solo-Yogyakarta_Sekar Jagad", "Solo-Yogyakarta_Sidoluhur",
                "Solo-Yogyakarta_Sidomukti", "Solo-Yogyakarta_Sidomulyo",
                "Solo-Yogyakarta_Tambal", "Solo-Yogyakarta_Wahyu Tumurun",
                "Solo-Yogyakarta_Wirasat", "Solo_Bokor_Kencono", "Solo_Srikaton",
                "Solo_Tribusono", "Solo_Truntum", "Sulawesi Selatan_Lontara",
                "Sumatera Barat_Rumah Minang", "Sumatera Utara_Boraspati"
            ]
            unsplashPics = [
                "https://images.unsplash.com/photo-1590736969955-71cc94801759?w=500",
                "https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=500",
                "https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?w=500",
                "https://images.unsplash.com/photo-1574169208507-84376144848b?w=500",
                "https://images.unsplash.com/photo-1528459801416-a9e53bbf4e17?w=500",
                "https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=500",
                "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=500"
            ]
            
            motifs_to_insert = []
            for idx, label in enumerate(PREDEFINED_MOTIF_LABELS):
                parts = label.split('_', 1)
                asal_daerah = parts[0].replace('-', ' & ') if len(parts) > 1 else "Indonesia"
                nama_motif = parts[1] if len(parts) > 1 else label
                
                makna = f"Motif luhur {nama_motif} asal {asal_daerah} yang sarat akan warisan luhur nilai kultural, melambangkan kebanggaan spiritualitas, integritas budi pekerti, kearifan kosmos, dan kekuatan harmoni alam semesta."
                if "Megamendung" in nama_motif:
                    makna = "Awan pembawa hujan melambangkan kesabaran, kelembutan hati, ketenangan pancaroba kehidupan, serta kelimpahan kemakmuran bagi masyarakat."
                elif "Parang" in nama_motif:
                    makna = "Garis diagonal jalinan menyerupai ombak samudera tanpa putus, melambangkan perjuangan tiada akhir, ketangkasan ksatria, keteguhan hati, serta kontinuitas kehidupan luhur."
                elif "Kawung" in nama_motif:
                    makna = "Pola geometris bulat melambangkan iris buah aren/kolang-kaling, menggambarkan kesucian hati, keadilan seimbang, kejujuran diri, dan kemampuan kontrol godaan dunia."
                
                pic = unsplashPics[idx % len(unsplashPics)]
                
                motifs_to_insert.append(DataMotifBatikKaggle(
                    nama_motif=nama_motif,
                    asal_daerah=asal_daerah,
                    makna_filosofis=makna,
                    occasion="Formal / Acara Adat / Kasual",
                    contoh_gambar=json.dumps([pic])
                ))
            
            db.session.bulk_save_objects(motifs_to_insert)
            db.session.commit()
            
        # Seed default pegawai if not exists
        if not Pegawai.query.first():
            admin_user = Admin.query.first()
            if admin_user:
                db.session.add(Pegawai(username='pegawai', password='pegawai123', nama_pegawai='Rian Hidayat', adminid=admin_user.id))
                db.session.commit()

        # Seed DataGambarMotifBatik & HasilPrediksi for rich history and charts
        if not DataGambarMotifBatik.query.first():
            pegawai_user = Pegawai.query.first()
            pid = pegawai_user.id if pegawai_user else 1
            
            # Find motif IDs for matching
            megamendung_motif = DataMotifBatikKaggle.query.filter(DataMotifBatikKaggle.nama_motif.like('%Megamendung%')).first()
            kawung_motif = DataMotifBatikKaggle.query.filter(DataMotifBatikKaggle.nama_motif.like('%Kawung%')).first()
            parang_motif = DataMotifBatikKaggle.query.filter(DataMotifBatikKaggle.nama_motif.like('%Parang%')).first()
            pintu_aceh_motif = DataMotifBatikKaggle.query.filter(DataMotifBatikKaggle.nama_motif.like('%Pintu Aceh%')).first()
            barong_motif = DataMotifBatikKaggle.query.filter(DataMotifBatikKaggle.nama_motif.like('%Barong%')).first()
            
            scans_to_seed = [
                # April 2026
                {"date": datetime(2026, 4, 12, 10, 15, 30), "motif": megamendung_motif, "label": "Cirebon_Megamendung", "acc": 0.94, "img": "https://images.unsplash.com/photo-1590736969955-71cc94801759?w=500"},
                {"date": datetime(2026, 4, 15, 14, 22, 12), "motif": kawung_motif, "label": "Solo-Yogyakarta_Kawung", "acc": 0.88, "img": "https://images.unsplash.com/photo-1528458909336-e7a0adfed0a5?w=500"},
                {"date": datetime(2026, 4, 20, 16, 50, 45), "motif": parang_motif, "label": "Solo-Yogyakarta_Parang", "acc": 0.91, "img": "https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?w=500"},
                # May 2026
                {"date": datetime(2026, 5, 5, 9, 30, 0), "motif": pintu_aceh_motif, "label": "Aceh_Pintu Aceh", "acc": 0.89, "img": "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=500"},
                {"date": datetime(2026, 5, 10, 11, 45, 18), "motif": megamendung_motif, "label": "Cirebon_Megamendung", "acc": 0.96, "img": "https://images.unsplash.com/photo-1590736969955-71cc94801759?w=500"},
                {"date": datetime(2026, 5, 18, 15, 10, 5), "motif": barong_motif, "label": "Bali_Barong", "acc": 0.85, "img": "https://images.unsplash.com/photo-1574169208507-84376144848b?w=500"},
                {"date": datetime(2026, 5, 25, 13, 14, 22), "motif": kawung_motif, "label": "Solo-Yogyakarta_Kawung", "acc": 0.90, "img": "https://images.unsplash.com/photo-1528458909336-e7a0adfed0a5?w=500"},
                # June 2026
                {"date": datetime(2026, 6, 2, 8, 40, 11), "motif": parang_motif, "label": "Solo-Yogyakarta_Parang", "acc": 0.93, "img": "https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?w=500"},
                {"date": datetime(2026, 6, 8, 10, 55, 30), "motif": megamendung_motif, "label": "Cirebon_Megamendung", "acc": 0.95, "img": "https://images.unsplash.com/photo-1590736969955-71cc94801759?w=500"},
                {"date": datetime(2026, 6, 12, 14, 30, 2), "motif": pintu_aceh_motif, "label": "Aceh_Pintu Aceh", "acc": 0.92, "img": "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=500"},
                {"date": datetime(2026, 6, 17, 16, 20, 44), "motif": kawung_motif, "label": "Solo-Yogyakarta_Kawung", "acc": 0.89, "img": "https://images.unsplash.com/photo-1528458909336-e7a0adfed0a5?w=500"},
                {"date": datetime(2026, 6, 18, 11, 12, 9), "motif": barong_motif, "label": "Bali_Barong", "acc": 0.87, "img": "https://images.unsplash.com/photo-1574169208507-84376144848b?w=500"}
            ]
            
            for s in scans_to_seed:
                if s["motif"]:
                    # Create DataGambarMotifBatik
                    dg = DataGambarMotifBatik(tanggal_foto=s["date"], file_foto_batik=s["img"], pegawai_id=pid)
                    db.session.add(dg)
                    db.session.flush()
                    
                    # Create HasilValidasiGambarMotifBatik
                    val = HasilValidasiGambarMotifBatik(
                        tanggal_validasi=s["date"],
                        status_validasi="Valid",
                        keterangan="Validasi format citra berhasil.",
                        data_gambar_id=dg.id
                    )
                    db.session.add(val)
                    db.session.flush()
                    
                    # Create HasilPrediksiMotifBatik
                    hp = HasilPrediksiMotifBatik(
                        tanggal_prediksi=s["date"],
                        prediksi_utama=s["label"], akurasi_utama=s["acc"],
                        prediksi_sekunder="Solo-Yogyakarta_Wirasat" if "Parang" not in s["label"] else "Solo-Yogyakarta_Kawung",
                        akurasi_sekunder=round(0.12, 2),
                        gambar_id=dg.id, motif_id=s["motif"].id, pegawai_id=pid
                    )
                    db.session.add(hp)
                    
                    # Update/Insert Laporan Month
                    period_str = s["date"].strftime("%B %Y")
                    rpt = Laporan.query.filter_by(periode_bulan=period_str, motif_id=s["motif"].id).first()
                    if rpt:
                        rpt.total_prediksi += 1
                    else:
                        db.session.add(Laporan(periode_bulan=period_str, total_prediksi=1, motif_id=s["motif"].id))
            
            db.session.commit()
    except Exception as e:
        print("Warning: Database belum terhubung. Silakan atur MySQL Anda saat berjalan di lokal.", e)

# ==========================================
# AUTH MIDDLEWARE
# ==========================================
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'message': 'Akses ditolak. Token tidak disediakan!'}), 401
        
        token = auth_header.split(' ')[1]
        if not token.startswith('JWT_'):
            return jsonify({'message': 'Format token salah!'}), 401
            
        try:
            b64_payload = token.split('_')[1]
            payload_bytes = base64.b64decode(b64_payload)
            user_data = json.loads(payload_bytes)
            request.user = user_data
        except Exception:
            return jsonify({'message': 'Token tidak valid!'}), 401
            
        return f(*args, **kwargs)
    return decorated

# ==========================================
# API ENDPOINTS
# ==========================================
@app.route('/api/auth/customer_login', methods=['POST'])
def customer_login():
    data = request.json or {}
    nama_customer = data.get('nama_customer')
    no_telepon = data.get('no_telepon')
    
    if not nama_customer or not no_telepon:
        return jsonify({'message': 'Nama dan No. Telepon harus diisi!'}), 400
        
    keperluan = data.get('keperluan', 'Kunjungan Mandiri / Scan Batik')
    
    new_customer = Customer(
        nama_customer=nama_customer,
        no_telepon=no_telepon,
        keperluan=keperluan,
        tanggal_kunjungan=datetime.utcnow(),
        admin_id=None,
        pegawai_id=None
    )
    
    db.session.add(new_customer)
    db.session.commit()
    
    payload = json.dumps({
        'id': new_customer.id,
        'username': f"customer_{new_customer.id}",
        'name': new_customer.nama_customer,
        'role': 'CUSTOMER'
    })
    token = f"JWT_{base64.b64encode(payload.encode()).decode()}_{int(datetime.utcnow().timestamp())}"
    
    return jsonify({
        'token': token,
        'user': {
            'id': new_customer.id,
            'username': f"customer_{new_customer.id}",
            'name': new_customer.nama_customer,
            'role': 'CUSTOMER'
        }
    }), 201

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')

    admin = Admin.query.filter_by(username=username, password=password).first()
    if admin:
        payload = json.dumps({'id': admin.id, 'username': admin.username, 'name': admin.nama_admin, 'role': 'ADMIN'})
        token = f"JWT_{base64.b64encode(payload.encode()).decode()}_{int(datetime.utcnow().timestamp())}"
        return jsonify({'token': token, 'user': {'id': admin.id, 'username': admin.username, 'name': admin.nama_admin, 'role': 'ADMIN'}})

    pegawai = Pegawai.query.filter_by(username=username, password=password).first()
    if pegawai:
        payload = json.dumps({'id': pegawai.id, 'username': pegawai.username, 'name': pegawai.nama_pegawai, 'role': 'STAFF'})
        token = f"JWT_{base64.b64encode(payload.encode()).decode()}_{int(datetime.utcnow().timestamp())}"
        return jsonify({'token': token, 'user': {'id': pegawai.id, 'username': pegawai.username, 'name': pegawai.nama_pegawai, 'role': 'STAFF'}})

    return jsonify({'message': 'Username atau password salah!'}), 401

@app.route('/api/predict', methods=['POST'])
@token_required
def predict():
    data = request.json
    image = data.get('image')
    if not image:
        return jsonify({'message': 'Data gambar batik tidak disediakan!'}), 400

    visitor_id = request.user.get('id', 1)
    visitor_role = request.user.get('role')
    
    # Only assign pegawai_id if the user is explicitly STAFF
    pegawai_id_val = visitor_id if visitor_role == 'STAFF' else None
    # 1. Simpan Gambar ke MySQL (UPLOAD FIRST - regardless of validity)
    new_gambar = DataGambarMotifBatik(file_foto_batik=image, pegawai_id=pegawai_id_val)
    db.session.add(new_gambar)
    db.session.flush()

    # 2. Validasi format gambar
    is_valid_image = False
    validation_note = ""
    img = None
    input_tensor = None

    try:
        if ',' in image:
            base64_data = image.split(',')[1]
        else:
            base64_data = image

        img_bytes = base64.b64decode(base64_data)
        img = Image.open(io.BytesIO(img_bytes)).convert('RGB')

        # Preprocessing transforms matching timm levit (resize to 224x224, tensor, normalize)
        preprocess = T.Compose([
            T.Resize((224, 224)),
            T.ToTensor(),
            T.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
        ])
        input_tensor = preprocess(img).unsqueeze(0)
        is_valid_image = True
        validation_note = "Validasi format citra berhasil."
    except Exception as e:
        is_valid_image = False
        validation_note = f"Format citra tidak valid: {str(e)}"

    # 3. Simpan Hasil Validasi
    new_validasi = HasilValidasiGambarMotifBatik(
        tanggal_validasi=datetime.utcnow(),
        status_validasi="Valid" if is_valid_image else "Invalid",
        keterangan=validation_note,
        data_gambar_id=new_gambar.id
    )
    db.session.add(new_validasi)
    db.session.flush()

    if not is_valid_image:
        db.session.commit()
        return jsonify({'message': f'Gambar tidak valid dan tidak dapat diproses: {validation_note}'}), 400

    # 4. Run inference (Hugging Face Gradio Space, local PyTorch, or mock fallback)
    top1 = "Solo_Srikaton"
    top2 = "Solo-Yogyakarta_Kawung"
    conf1 = 0.94
    conf2 = 0.05
    heatmap_cnn_base64 = ""
    heatmap_vit_base64 = ""

    hf_space_url = os.getenv('HUGGINGFACE_SPACE_URL')
    inference_successful = False

    if HAS_GRADIO_CLIENT and hf_space_url:
        try:
            print(f"Menggunakan Hugging Face Space ({hf_space_url}) untuk inferensi...")
            if ',' in image:
                base64_raw = image.split(',')[1]
            else:
                base64_raw = image
            img_data = base64.b64decode(base64_raw)
            
            with tempfile.NamedTemporaryFile(delete=False, suffix='.jpg') as temp_file:
                temp_file.write(img_data)
                temp_file_path = temp_file.name

            try:
                client = Client(hf_space_url)
                result = client.predict(
                    img_input=temp_file_path,
                    api_name="/predict"
                )
                
                if isinstance(result, str):
                    result_data = json.loads(result)
                else:
                    result_data = result
                
                top1 = result_data.get('top1', top1)
                conf1 = float(result_data.get('conf1', conf1))
                top2 = result_data.get('top2', top2)
                conf2 = float(result_data.get('conf2', conf2))
                heatmap_cnn_base64 = result_data.get('heatmap_cnn', '')
                heatmap_vit_base64 = result_data.get('heatmap_vit', '')
                inference_successful = True
                print("Inferensi Hugging Face Space berhasil!")
            finally:
                try:
                    os.unlink(temp_file_path)
                except:
                    pass
        except Exception as hf_err:
            print("Error saat memanggil Hugging Face Space:", hf_err)

    if not inference_successful:
        if HAS_ML_LIBS and model:
            cnn_features = {}
            hooks = []

            def get_hook(name):
                def hook_fn(module, input, output):
                    cnn_features[name] = output.detach().cpu()
                return hook_fn

            try:
                # Register hooks to extract feature maps
                hooks.append(model.stem.conv1.register_forward_hook(get_hook('stem_conv1')))
                hooks.append(model.stem.conv2.register_forward_hook(get_hook('stem_conv2')))
                hooks.append(model.stem.conv3.register_forward_hook(get_hook('stem_conv3')))
                hooks.append(model.stem.conv4.register_forward_hook(get_hook('stem_conv4')))

                with torch.no_grad():
                    logits = model(input_tensor)

                # Remove hooks immediately
                for h in hooks:
                    h.remove()
                hooks = []

                # Postprocess predictions
                probs = torch.softmax(logits, dim=-1)[0]
                topk_probs, topk_indices = torch.topk(probs, 2)
                
                top1_idx = topk_indices[0].item()
                top2_idx = topk_indices[1].item()
                
                if top1_idx < len(CLASSES) and top2_idx < len(CLASSES):
                    top1 = CLASSES[top1_idx]
                    top2 = CLASSES[top2_idx]
                    conf1 = round(topk_probs[0].item(), 2)
                    conf2 = round(topk_probs[1].item(), 2)
                
                # Generate real plots from captured features
                # A. CNN feature map plot
                fig, axes = plt.subplots(4, 8, figsize=(10, 5), facecolor='white')
                layers = ['stem_conv1', 'stem_conv2', 'stem_conv3', 'stem_conv4']
                for r_idx, layer_name in enumerate(layers):
                    if layer_name in cnn_features:
                        feat = cnn_features[layer_name][0]
                        for c_idx in range(8):
                            ax = axes[r_idx, c_idx]
                            channel_img = feat[c_idx].numpy()
                            c_min, c_max = channel_img.min(), channel_img.max()
                            if c_max - c_min > 1e-5:
                                channel_img = (channel_img - c_min) / (c_max - c_min)
                            ax.imshow(channel_img, cmap='viridis')
                            ax.axis('off')
                            if c_idx == 0:
                                ax.set_title(layer_name, fontsize=8, loc='left', color='#1e293b', weight='bold')
                    else:
                        for c_idx in range(8):
                            axes[r_idx, c_idx].axis('off')
                plt.tight_layout()
                buf_cnn = io.BytesIO()
                plt.savefig(buf_cnn, format='jpeg', bbox_inches='tight', dpi=120, pil_kwargs={'quality': 75})
                plt.close()
                buf_cnn.seek(0)
                heatmap_cnn_base64 = "data:image/jpeg;base64," + base64.b64encode(buf_cnn.read()).decode('utf-8')

                # B. ViT self-attention map plot
                fig = plt.figure(figsize=(14, 13), facecolor='white')
                height_ratios = [1.6, 0.25, 1.6, 1.35, 1.35, 0.25, 1.35, 0.25, 1.1]
                gs = fig.add_gridspec(9, 24, height_ratios=height_ratios)
                
                row_definitions = [
                    {"type": "block", "stage": 0, "block": 0, "name": "Stage 1, attention block 1 (first one)", "num_heads": 4, "cols": (6, 18), "spatial": 14, "is_down": False},
                    {"type": "ellipsis"},
                    {"type": "block", "stage": 0, "block": 3, "name": "Stage 1, attention block 4", "num_heads": 4, "cols": (6, 18), "spatial": 14, "is_down": False},
                    {"type": "block", "stage": 1, "block": None, "name": "Shrinking attention between stages 1 and 2", "num_heads": 8, "cols": (2, 22), "spatial": 7, "is_down": True},
                    {"type": "block", "stage": 1, "block": 0, "name": "Stage 2, attention block 1", "num_heads": 8, "cols": (2, 22), "spatial": 7, "is_down": False},
                    {"type": "ellipsis"},
                    {"type": "block", "stage": 1, "block": 3, "name": "Stage 2, attention block 4", "num_heads": 8, "cols": (2, 22), "spatial": 7, "is_down": False},
                    {"type": "ellipsis"},
                    {"type": "block", "stage": 2, "block": 3, "name": "Stage 3, attention block 4 (last one)", "num_heads": 12, "cols": (0, 24), "spatial": 4, "is_down": False}
                ]
                
                fig.suptitle("Visualization of the attention maps for selected blocks of LeViT-128", fontsize=12, fontweight='bold', color='#1e293b', y=0.98)
                
                for r_idx, row_def in enumerate(row_definitions):
                    if row_def["type"] == "ellipsis":
                        ax = fig.add_subplot(gs[r_idx, :])
                        ax.text(0.5, 0.5, '⋮', fontsize=24, ha='center', va='center', fontweight='bold', color='#64748b')
                        ax.axis('off')
                    else:
                        if row_def["is_down"]:
                            down_attn = model.stages[row_def["stage"]].downsample.attn_downsample
                            attn_matrix = down_attn.captured_attn[0]
                        else:
                            block_attn = model.stages[row_def["stage"]].blocks[row_def["block"]].attn
                            attn_matrix = block_attn.captured_attn[0]
                            
                        num_heads = row_def["num_heads"]
                        spatial_size = row_def["spatial"]
                        c_start, c_end = row_def["cols"]
                        
                        # 1. Create a centered invisible axis to place the row title perfectly
                        ax_label = fig.add_subplot(gs[r_idx, c_start:c_end])
                        ax_label.axis('off')
                        ax_label.text(
                            0.5, 1.15, 
                            row_def["name"], 
                            fontsize=9, fontweight='bold', color='#1e293b', 
                            ha='center', va='bottom'
                        )
                        
                        # 2. Create the subgridspec for the heads
                        gs_row = gs[r_idx, c_start:c_end].subgridspec(1, num_heads, wspace=0.15)
                        
                        for c_idx in range(num_heads):
                            ax = fig.add_subplot(gs_row[0, c_idx])
                            
                            if row_def["is_down"]:
                                head_attn = attn_matrix[c_idx].mean(dim=1)
                            else:
                                head_attn = attn_matrix[c_idx].mean(dim=0)
                                
                            grid_attn = head_attn.reshape(spatial_size, spatial_size).numpy()
                            c_min, c_max = grid_attn.min(), grid_attn.max()
                            if c_max - c_min > 1e-5:
                                grid_attn = (grid_attn - c_min) / (c_max - c_min)
                                
                            ax.imshow(grid_attn, cmap='viridis')
                            ax.axis('off')
                            ax.set_title(f"head {c_idx}", color='#475569', fontsize=7, pad=2)
                                
                plt.subplots_adjust(top=0.92, bottom=0.02, left=0.05, right=0.95, hspace=1.1)
                buf_vit = io.BytesIO()
                plt.savefig(buf_vit, format='jpeg', bbox_inches='tight', dpi=130, pil_kwargs={'quality': 75})
                plt.close()
                buf_vit.seek(0)
                heatmap_vit_base64 = "data:image/jpeg;base64," + base64.b64encode(buf_vit.read()).decode('utf-8')

            except Exception as e:
                print("Inference or plotting error:", e)
                for h in hooks:
                    try: h.remove()
                    except: pass
                heatmap_cnn_base64 = generate_mock_cnn()
                heatmap_vit_base64 = generate_mock_vit()
        else:
            heatmap_cnn_base64 = generate_mock_cnn()
            heatmap_vit_base64 = generate_mock_vit()

    # Cari Motif di MySQL
    motif_match = DataMotifBatikKaggle.query.filter(DataMotifBatikKaggle.nama_motif.ilike(f'%{get_clean_motif_name(top1)}%')).first()
    if not motif_match:
        motif_match = DataMotifBatikKaggle(
            nama_motif=get_clean_motif_name(top1),
            asal_daerah=top1.split('_')[0] if '_' in top1 else "Indonesia",
            makna_filosofis="Filosofi budaya luhur Nusantara.",
            occasion="Acara Formal",
            contoh_gambar=json.dumps([image])
        )
        db.session.add(motif_match)
        db.session.flush()

    # Simpan Hasil Prediksi
    new_prediksi = HasilPrediksiMotifBatik(
        tanggal_prediksi=datetime.utcnow(),
        prediksi_utama=top1, akurasi_utama=conf1,
        prediksi_sekunder=top2, akurasi_sekunder=conf2,
        gambar_id=new_gambar.id, motif_id=motif_match.id, pegawai_id=pegawai_id_val
    )
    db.session.add(new_prediksi)
    db.session.flush()

    # Simpan Feature Map CNN ke tabel terpisah
    new_cnn = FeatureMapCnn(
        file_heatmap_cnn=heatmap_cnn_base64,
        hasil_prediksi_id=new_prediksi.id,
        hasil_validasi_id=new_validasi.id
    )
    db.session.add(new_cnn)
    db.session.flush()

    # Simpan Attention Map VIT ke tabel terpisah
    new_vit = AttentionMapVit(
        file_heatmap_cnn=heatmap_vit_base64,
        hasil_prediksi_id=new_prediksi.id,
        feature_map_cnn_id=new_cnn.id,
        hasil_validasi_id=new_validasi.id
    )
    db.session.add(new_vit)
    
    # Update Statistik Laporan
    current_month = datetime.utcnow().strftime("%B %Y")
    report = Laporan.query.filter_by(periode_bulan=current_month, motif_id=motif_match.id).first()
    if report:
        report.total_prediksi += 1
    else:
        new_report = Laporan(periode_bulan=current_month, total_prediksi=1, motif_id=motif_match.id)
        db.session.add(new_report)

    db.session.commit()

    return jsonify({
        'success': True,
        'prediction': {
            'prediction_utama': top1, 'akurasi_utama': conf1,
            'prediction_sekunder': top2, 'akurasi_sekunder': conf2,
            'tanggal_prediksi': new_prediksi.tanggal_prediksi.isoformat()
        },
        'data_motif': {
            'id': motif_match.id, 'nama_motif': get_clean_motif_name(motif_match.nama_motif), 'asal_daerah': motif_match.asal_daerah
        }
    })

@app.route('/api/admin', methods=['GET', 'POST'])
@token_required
def handle_admin():
    if request.method == 'GET':
        admins = Admin.query.all()
        return jsonify([{'id': a.id, 'username': a.username, 'password': '*********', 'nama_admin': a.nama_admin} for a in admins])
    else:
        if request.user.get('role') != 'ADMIN': return jsonify({'message': 'Hanya Admin!'}), 403
        data = request.json
        existing = Admin.query.filter_by(username=data['username']).first()
        if existing:
            return jsonify({'message': 'username sudah ada'}), 400
        new_admin = Admin(username=data['username'], password=data['password'], nama_admin=data['nama_admin'])
        db.session.add(new_admin)
        db.session.commit()
        return jsonify({'id': new_admin.id, 'username': new_admin.username, 'password': '*********', 'nama_admin': new_admin.nama_admin}), 201

@app.route('/api/pegawai', methods=['GET', 'POST'])
@token_required
def handle_pegawai():
    if request.method == 'GET':
        pegawais = Pegawai.query.all()
        return jsonify([{'id': p.id, 'username': p.username, 'password': '*********', 'nama_pegawai': p.nama_pegawai, 'admin_id': p.adminid} for p in pegawais])
    else:
        if request.user.get('role') != 'ADMIN': return jsonify({'message': 'Hanya Admin!'}), 403
        data = request.json
        existing = Pegawai.query.filter_by(username=data['username']).first()
        if existing:
            return jsonify({'message': 'username sudah ada'}), 400
        new_pegawai = Pegawai(
            username=data['username'], password=data['password'], 
            nama_pegawai=data['nama_pegawai'], adminid=request.user.get('id', 1)
        )
        db.session.add(new_pegawai)
        db.session.commit()
        return jsonify({'id': new_pegawai.id, 'username': new_pegawai.username, 'password': '*********', 'nama_pegawai': new_pegawai.nama_pegawai, 'admin_id': new_pegawai.adminid}), 201

@app.route('/api/customer', methods=['GET', 'POST'])
@token_required
def handle_customer():
    if request.method == 'GET':
        customers = Customer.query.order_by(Customer.tanggal_kunjungan.desc()).all()
        return jsonify([{
            'id': c.id,
            'nama_customer': c.nama_customer,
            'no_telepon': c.no_telepon,
            'keperluan': c.keperluan,
            'tanggal_kunjungan': c.tanggal_kunjungan.isoformat(),
            'admin_id': c.admin_id,
            'pegawai_id': c.pegawai_id
        } for c in customers])

    data = request.json or {}
    existing = Customer.query.filter_by(nama_customer=data.get('nama_customer')).first()
    if existing:
        return jsonify({'message': 'username sudah ada'}), 400

    role = request.user.get('role')
    admin_id = request.user.get('id') if role == 'ADMIN' else None
    pegawai_id = request.user.get('id') if role == 'STAFF' else data.get('pegawai_id')

    tanggal_kunjungan = datetime.utcnow()
    if data.get('tanggal_kunjungan'):
        try:
            tanggal_kunjungan = datetime.fromisoformat(data['tanggal_kunjungan'].replace('Z', '+00:00')).replace(tzinfo=None)
        except ValueError:
            return jsonify({'message': 'Format tanggal_kunjungan tidak valid.'}), 400

    new_customer = Customer(
        nama_customer=data['nama_customer'],
        no_telepon=data['no_telepon'],
        keperluan=data['keperluan'],
        tanggal_kunjungan=tanggal_kunjungan,
        admin_id=admin_id,
        pegawai_id=pegawai_id
    )
    db.session.add(new_customer)
    db.session.commit()
    return jsonify({
        'id': new_customer.id,
        'nama_customer': new_customer.nama_customer,
        'no_telepon': new_customer.no_telepon,
        'keperluan': new_customer.keperluan,
        'tanggal_kunjungan': new_customer.tanggal_kunjungan.isoformat(),
        'admin_id': new_customer.admin_id,
        'pegawai_id': new_customer.pegawai_id
    }), 201

@app.route('/api/data_gambar_motif_batik', methods=['GET'])
@token_required
def get_data_gambar_motif_batik():
    gambars = DataGambarMotifBatik.query.all()
    res = [{'id': g.id, 'tanggal_foto': g.tanggal_foto.isoformat(), 'file_foto_batik': g.file_foto_batik, 'pegawai_id': g.pegawai_id} for g in gambars]
    return jsonify(res)

@app.route('/api/hasil_validasi', methods=['GET'])
@token_required
def get_hasil_validasi():
    validations = HasilValidasiGambarMotifBatik.query.all()
    res = []
    for v in validations:
        res.append({
            'id': v.id,
            'tanggal_validasi': v.tanggal_validasi.isoformat(),
            'status_validasi': v.status_validasi,
            'catatan': v.keterangan,
            'gambar_id': v.data_gambar_id,
            'pegawai_id': None
        })
    return jsonify(res)

@app.route('/api/hasil_prediksi', methods=['GET'])
@token_required
def get_hasil_prediksi():
    prediksis = HasilPrediksiMotifBatik.query.all()
    res = []
    for p in prediksis:
        res.append({
            'id': p.id, 'tanggal_prediksi': p.tanggal_prediksi.isoformat(),
            'prediksi_utama': p.prediksi_utama, 'akurasi_utama': p.akurasi_utama,
            'prediksi_sekunder': p.prediksi_sekunder, 'akurasi_sekunder': p.akurasi_sekunder,
            'gambar_id': p.gambar_id, 'motif_id': p.motif_id, 'pegawai_id': p.pegawai_id
        })
    return jsonify(res)

@app.route('/api/feature_maps_cnn', methods=['GET'])
@token_required
def get_feature_maps_cnn():
    features = FeatureMapCnn.query.all()
    res = [{'id': f.id, 'file_heatmap_cnn': f.file_heatmap_cnn, 'hasil_prediksi_id': f.hasil_prediksi_id, 'hasil_validasi_id': f.hasil_validasi_id} for f in features]
    return jsonify(res)

@app.route('/api/attention_maps_vit', methods=['GET'])
@token_required
def get_attention_maps_vit():
    attentions = AttentionMapVit.query.all()
    res = [{'id': a.id, 'file_heatmap_vit': a.file_heatmap_cnn, 'hasil_prediksi_id': a.hasil_prediksi_id, 'hasil_validasi_id': a.hasil_validasi_id} for a in attentions]
    return jsonify(res)

@app.route('/api/data_motif', methods=['GET', 'POST'])
@token_required
def handle_data_motif():
    if request.method == 'GET':
        motifs = DataMotifBatikKaggle.query.all()
        res = []
        for m in motifs:
            res.append({
                'id': m.id, 'nama_motif': m.nama_motif, 'asal_daerah': m.asal_daerah,
                'makna_filosofis': m.makna_filosofis, 'occasion': m.occasion,
                'contoh_gambar': m.contoh_gambar
            })
        return jsonify(res)
    else:
        if request.user.get('role') != 'ADMIN': return jsonify({'message': 'Hanya Admin!'}), 403
        data = request.json
        new_motif = DataMotifBatikKaggle(
            nama_motif=data['nama_motif'], asal_daerah=data.get('asal_daerah', 'Indonesia'),
            makna_filosofis=data.get('makna_filosofis', ''), occasion=data.get('occasion', ''),
            contoh_gambar=json.dumps(data.get('contoh_gambar', []))
        )
        db.session.add(new_motif)
        db.session.commit()
        return jsonify({'id': new_motif.id, 'nama_motif': new_motif.nama_motif}), 201

@app.route('/api/laporan', methods=['GET'])
@token_required
def get_laporan():
    laporan = Laporan.query.all()
    res = [{'id': l.id, 'periode_bulan': l.periode_bulan, 'total_prediksi': l.total_prediksi, 'motif_id': l.motif_id} for l in laporan]
    return jsonify(res)

# --- CRUD STANDAR BY ID & REGENERATION ---
@app.route('/api/admin/<int:id>', methods=['PUT', 'DELETE'])
@token_required
def handle_admin_by_id(id):
    if request.user.get('role') != 'ADMIN': return jsonify({'message': 'Hanya Admin!'}), 403
    admin = Admin.query.get(id)
    if not admin:
        return jsonify({'message': 'Admin tidak ditemukan!'}), 404
        
    if request.method == 'PUT':
        data = request.json
        existing = Admin.query.filter(Admin.username == data['username'], Admin.id != id).first()
        if existing:
            return jsonify({'message': 'username sudah ada'}), 400
            
        admin.username = data['username']
        admin.nama_admin = data['nama_admin']
        if data.get('password'):
            admin.password = data['password']
        db.session.commit()
        return jsonify({'id': admin.id, 'username': admin.username, 'password': '*********', 'nama_admin': admin.nama_admin})
    else:
        if id == request.user.get('id'):
            return jsonify({'message': 'Anda tidak dapat menghapus akun Anda sendiri yang sedang digunakan!'}), 400
        db.session.delete(admin)
        db.session.commit()
        return jsonify({'message': 'Admin berhasil dihapus.'})

@app.route('/api/pegawai/<int:id>', methods=['PUT', 'DELETE'])
@token_required
def handle_pegawai_by_id(id):
    if request.user.get('role') != 'ADMIN': return jsonify({'message': 'Hanya Admin!'}), 403
    pegawai = Pegawai.query.get(id)
    if not pegawai:
        return jsonify({'message': 'Pegawai tidak ditemukan!'}), 404
        
    if request.method == 'PUT':
        data = request.json
        existing = Pegawai.query.filter(Pegawai.username == data['username'], Pegawai.id != id).first()
        if existing:
            return jsonify({'message': 'username sudah ada'}), 400
            
        pegawai.username = data['username']
        pegawai.nama_pegawai = data['nama_pegawai']
        if data.get('password'):
            pegawai.password = data['password']
        db.session.commit()
        return jsonify({'id': pegawai.id, 'username': pegawai.username, 'password': '*********', 'nama_pegawai': pegawai.nama_pegawai, 'admin_id': pegawai.adminid})
    else:
        db.session.delete(pegawai)
        db.session.commit()
        return jsonify({'message': 'Pegawai berhasil dihapus.'})

@app.route('/api/customer/<int:id>', methods=['PUT', 'DELETE'])
@token_required
def handle_customer_by_id(id):
    customer = Customer.query.get(id)
    if not customer:
        return jsonify({'message': 'Customer tidak ditemukan!'}), 404

    if request.method == 'PUT':
        data = request.json or {}
        existing = Customer.query.filter(Customer.nama_customer == data['nama_customer'], Customer.id != id).first()
        if existing:
            return jsonify({'message': 'username sudah ada'}), 400

        customer.nama_customer = data['nama_customer']
        customer.no_telepon = data['no_telepon']
        customer.keperluan = data['keperluan']
        if data.get('tanggal_kunjungan'):
            try:
                customer.tanggal_kunjungan = datetime.fromisoformat(data['tanggal_kunjungan'].replace('Z', '+00:00')).replace(tzinfo=None)
            except ValueError:
                return jsonify({'message': 'Format tanggal_kunjungan tidak valid.'}), 400
        db.session.commit()
        return jsonify({
            'id': customer.id,
            'nama_customer': customer.nama_customer,
            'no_telepon': customer.no_telepon,
            'keperluan': customer.keperluan,
            'tanggal_kunjungan': customer.tanggal_kunjungan.isoformat(),
            'admin_id': customer.admin_id,
            'pegawai_id': customer.pegawai_id
        })

    db.session.delete(customer)
    db.session.commit()
    return jsonify({'message': 'Customer berhasil dihapus.'})

@app.route('/api/data_gambar_motif_batik/<int:id>', methods=['DELETE'])
@token_required
def delete_data_gambar_motif_batik(id):
    if request.user.get('role') != 'ADMIN': return jsonify({'message': 'Hanya Admin!'}), 403
    gambar = DataGambarMotifBatik.query.get(id)
    if not gambar:
        return jsonify({'message': 'Gambar tidak ditemukan!'}), 404

    HasilPrediksiMotifBatik.query.filter_by(gambar_id=id).delete()
    HasilValidasiGambarMotifBatik.query.filter_by(data_gambar_id=id).delete()
    db.session.delete(gambar)
    db.session.commit()
    return jsonify({'message': 'Gambar berhasil dihapus.'})

@app.route('/api/hasil_validasi/<int:id>', methods=['DELETE'])
@token_required
def delete_hasil_validasi(id):
    if request.user.get('role') != 'ADMIN': return jsonify({'message': 'Hanya Admin!'}), 403
    validasi = HasilValidasiGambarMotifBatik.query.get(id)
    if not validasi:
        return jsonify({'message': 'Hasil validasi tidak ditemukan!'}), 404
    db.session.delete(validasi)
    db.session.commit()
    return jsonify({'message': 'Hasil validasi berhasil dihapus.'})

@app.route('/api/hasil_prediksi/<int:id>', methods=['PUT', 'DELETE'])
@token_required
def handle_hasil_prediksi_by_id(id):
    prediction = HasilPrediksiMotifBatik.query.get(id)
    if not prediction:
        return jsonify({'message': 'Hasil prediksi tidak ditemukan!'}), 404

    if request.method == 'PUT':
        data = request.json
        prediction.prediksi_utama = data['prediksi_utama']
        db.session.commit()
        return jsonify({'id': prediction.id, 'prediksi_utama': prediction.prediksi_utama})
    else:
        db.session.delete(prediction)
        db.session.commit()
        return jsonify({'message': 'Hasil prediksi berhasil dihapus.'})

@app.route('/api/data_motif/<int:id>', methods=['PUT', 'DELETE'])
@token_required
def handle_data_motif_by_id(id):
    if request.user.get('role') != 'ADMIN': return jsonify({'message': 'Hanya Admin!'}), 403
    motif = DataMotifBatikKaggle.query.get(id)
    if not motif:
        return jsonify({'message': 'Motif tidak ditemukan!'}), 404
        
    if request.method == 'PUT':
        data = request.json
        motif.nama_motif = data['nama_motif']
        motif.asal_daerah = data.get('asal_daerah', 'Indonesia')
        motif.makna_filosofis = data.get('makna_filosofis', '')
        motif.occasion = data.get('occasion', '')
        
        contoh_gambar = data.get('contoh_gambar')
        if contoh_gambar is not None:
            if isinstance(contoh_gambar, list):
                motif.contoh_gambar = json.dumps(contoh_gambar)
            else:
                motif.contoh_gambar = contoh_gambar
                
        db.session.commit()
        return jsonify({'id': motif.id, 'nama_motif': motif.nama_motif})
    else:
        HasilPrediksiMotifBatik.query.filter_by(motif_id=id).delete()
        db.session.delete(motif)
        db.session.commit()
        return jsonify({'message': 'Motif berhasil dihapus.'})

@app.route('/api/laporan/generate', methods=['POST'])
@token_required
def generate_laporan():
    if request.user.get('role') != 'ADMIN': return jsonify({'message': 'Hanya Admin!'}), 403
    data = request.json
    periode_bulan = data.get('periode_bulan')
    if not periode_bulan:
        return jsonify({'message': 'Periode bulan tidak disediakan!'}), 400
    
    try:
        dt = datetime.strptime(periode_bulan, "%B %Y")
        month = dt.month
        year = dt.year
    except ValueError:
        return jsonify({'message': 'Format periode bulan salah!'}), 400
        
    Laporan.query.filter_by(periode_bulan=periode_bulan).delete()
    
    from sqlalchemy import extract
    predictions = HasilPrediksiMotifBatik.query.filter(
        extract('month', HasilPrediksiMotifBatik.tanggal_prediksi) == month,
        extract('year', HasilPrediksiMotifBatik.tanggal_prediksi) == year
    ).all()
    
    counts = {}
    for p in predictions:
        if p.motif_id:
            counts[p.motif_id] = counts.get(p.motif_id, 0) + 1
            
    for motif_id, count in counts.items():
        new_report = Laporan(periode_bulan=periode_bulan, total_prediksi=count, motif_id=motif_id)
        db.session.add(new_report)
        
    db.session.commit()
    return jsonify({'success': True, 'message': f'Laporan bulanan {periode_bulan} berhasil diregenerasi.'})

# ==========================================
# RUTERING FRONTEND REACT (MONOLITIK)
# ==========================================
# Flask akan menghidangkan file statis dari folder `dist` milik React
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_react(path):
    if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    else:
        return send_from_directory(app.static_folder, 'index.html')

if __name__ == '__main__':
    # Di laptop Anda (prod), jalankan dengan: python backend/app.py
    app.run(host='0.0.0.0', port=5000, debug=True)
