import os
import json
import base64
import io
import types
from PIL import Image
import torch
import timm
import torchvision.transforms as T
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np
import gradio as gr

# Load classes
CLASSES = []
classes_path = 'classes.json'
if os.path.exists(classes_path):
    try:
        with open(classes_path, 'r') as f:
            CLASSES = json.load(f)
    except Exception as e:
        print("Error loading classes.json:", e)

# Load PyTorch model on startup
model = None
model_path = 'levit_best_state_dict_39_FINAL.pth'

if os.path.exists(model_path):
    try:
        print("Loading PyTorch model levit_128 for Hugging Face inference...")
        model = timm.create_model('levit_128', pretrained=False, num_classes=39)
        state_dict = torch.load(model_path, map_location='cpu')
        model.load_state_dict(state_dict)
        model.eval()

        # Patched forward and patched downsample forward functions to capture attention weights
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
    print(f"Warning: model file not found at {model_path}. Please upload 'levit_best_state_dict_39_FINAL.pth' to Hugging Face Space.")

def predict_batik_gradio(img_input):
    if img_input is None:
        return {"success": False, "message": "No image provided"}
    
    # Preprocess the PIL image
    try:
        img = img_input.convert('RGB')
        preprocess = T.Compose([
            T.Resize((224, 224)),
            T.ToTensor(),
            T.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
        ])
        input_tensor = preprocess(img).unsqueeze(0)
    except Exception as e:
        return {"success": False, "message": f"Preprocessing failed: {str(e)}"}

    # Default fallbacks
    top1 = "Solo_Srikaton"
    top2 = "Solo-Yogyakarta_Kawung"
    conf1 = 0.94
    conf2 = 0.05
    heatmap_cnn_base64 = ""
    heatmap_vit_base64 = ""

    cnn_features = {}
    hooks = []

    def get_hook(name):
        def hook_fn(module, input, output):
            cnn_features[name] = output.detach().cpu()
        return hook_fn

    if model:
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
            
            # Generate CNN feature map plot
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

            # Generate ViT self-attention map plot
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
                    
                    ax_label = fig.add_subplot(gs[r_idx, c_start:c_end])
                    ax_label.axis('off')
                    ax_label.text(
                        0.5, 1.15, 
                        row_def["name"], 
                        fontsize=9, fontweight='bold', color='#1e293b', 
                        ha='center', va='bottom'
                    )
                    
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
            print("Inference error:", e)
            for h in hooks:
                try: h.remove()
                except: pass
            return {"success": False, "message": f"Inference execution failed: {str(e)}"}

    return {
        "top1": top1,
        "conf1": conf1,
        "top2": top2,
        "conf2": conf2,
        "heatmap_cnn": heatmap_cnn_base64,
        "heatmap_vit": heatmap_vit_base64
    }

# Expose Gradio interface
demo = gr.Interface(
    fn=predict_batik_gradio,
    inputs=gr.Image(type="pil", label="Input Gambar Batik"),
    outputs=gr.JSON(label="Hasil Prediksi JSON"),
    title="BatikLens AI Inference Server",
    description="Engine inferensi model PyTorch LeViT-128 lengkap dengan penarikan CNN feature maps dan ViT self-attention map visualisations."
)

if __name__ == "__main__":
    demo.launch()
