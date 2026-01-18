import os
from huggingface_hub import hf_hub_download

# Résolution absolue du dossier /models à la racine du repo
# Ce script se trouve dans packages/models/scripts/download.py
# On remonte de 3 niveaux pour atteindre la racine
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
MODELS_DIR = os.path.join(BASE_DIR, 'models')

print(f"Target models directory: {MODELS_DIR}")

if not os.path.exists(MODELS_DIR):
    os.makedirs(MODELS_DIR, exist_ok=True)

hf_hub_download(
    repo_id='bartowski/Qwen2.5-Coder-1.5B-Instruct-GGUF',
    filename='Qwen2.5-Coder-1.5B-Instruct-Q4_K_M.gguf',
    local_dir=MODELS_DIR,
    local_dir_use_symlinks=False
)
