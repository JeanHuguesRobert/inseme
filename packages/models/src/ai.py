#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
🏛️ KUDOCRACY SOVEREIGN CONTROLLER (AI & TTS)
"""

import os
import sys
import json
import signal
import subprocess
import argparse
import asyncio
import base64
import io
import time
import re
from typing import Optional, List, Dict
from pathlib import Path

import socket
import requests
from dotenv import load_dotenv

# --- Configuration & Registry ---
SOVEREIGN_MODELS = {
    "qwen-2.5-coder-1.5b": {
        "name": "Qwen 2.5 Coder 1.5B",
        "filename": "Qwen2.5-Coder-1.5B-Instruct-Q4_K_M.gguf",
        "ctx": 32768,
        "threads": 4
    },
    "llama-3.2-3b": {
        "name": "Llama 3.2 3B",
        "filename": "llama-3.2-3b-instruct.gguf",
        "ctx": 128000,
        "threads": 4
    }
}

DEFAULT_MODEL = "qwen-2.5-coder-1.5b"
DEFAULT_PORT = 8880
IS_WIN = sys.platform == "win32"

# --- Root Detection ---
def find_repo_root():
    curr = Path(__file__).resolve().parent
    for parent in [curr] + list(curr.parents):
        if (parent / ".git").exists():
            return parent
    return curr.parents[2]

REPO_ROOT = find_repo_root()
MODEL_DIR = REPO_ROOT / "models"

# --- Configuration & Registry ---
load_dotenv(REPO_ROOT / ".env")

# --- Service Registration ---
def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except:
        return "127.0.0.1"

def register_ai_service(port: int, status: str = "online"):
    supabase_url = os.getenv("SUPABASE_URL")
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    room_slug = os.getenv("BAR_ROOM_SLUG", "cyrnea")

    if not supabase_url or not service_key:
        print("⚠️ SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquants. Enregistrement ignoré.")
        return

    local_ip = get_local_ip()
    ai_url = f"http://{local_ip}:{port}"
    
    print(f"📡 Enregistrement du service AI ({status}) sur {ai_url} pour la room {room_slug}...")
    
    try:
        # 1. Récupérer les paramètres actuels de la room
        headers = {
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation"
        }
        
        url = f"{supabase_url}/rest/v1/inseme_rooms?slug=eq.{room_slug}&select=id,settings"
        resp = requests.get(url, headers=headers)
        
        if resp.status_code != 200 or not resp.json():
            print(f"❌ Room '{room_slug}' non trouvée ou erreur Supabase.")
            return

        room = resp.json()[0]
        settings = room.get("settings", {})
        
        # 2. Mettre à jour les settings
        settings["ai_server_url"] = ai_url if status == "online" else None
        settings["ai_server_status"] = status
        settings["ai_server_last_seen"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        
        update_url = f"{supabase_url}/rest/v1/inseme_rooms?id=eq.{room['id']}"
        update_resp = requests.patch(update_url, headers=headers, json={"settings": settings})
        
        if update_resp.status_code in [200, 204]:
            print(f"✅ Service AI enregistré avec succès dans Supabase.")
        else:
            print(f"❌ Échec de l'enregistrement Supabase: {update_resp.status_code} {update_resp.text}")
            
    except Exception as e:
        print(f"❌ Erreur lors de l'enregistrement Supabase: {e}")

# --- Global State ---
llm = None
tts_pipelines = {}

# --- FastAPI App Definition ---
try:
    from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
    from fastapi.responses import StreamingResponse, JSONResponse
    from fastapi.middleware.cors import CORSMiddleware
    from pydantic import BaseModel
    import uvicorn
    import torch
    import numpy as np
    import soundfile as io_sf
    from kokoro import KPipeline
except ImportError as e:
    print(f"⚠️  Dépendance manquante : {e}")
    print("Installez-les avec: pip install fastapi uvicorn kokoro torch numpy soundfile")
    sys.exit(1)

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    register_ai_service(CURRENT_PORT, "online")
    print(f"✅ Sovereign AI Ready on port {CURRENT_PORT}")
    yield
    # Shutdown
    register_ai_service(CURRENT_PORT, "offline")

app = FastAPI(title="🏛️ Kudocracy Sovereign AI", description="Unified LLM + TTS Server", lifespan=lifespan)

# Global port for registration
CURRENT_PORT = DEFAULT_PORT

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class LLMRequest(BaseModel):
    prompt: str
    max_tokens: Optional[int] = 256
    stream: Optional[bool] = False
    temperature: Optional[float] = 0.7

class TTSRequest(BaseModel):
    input: str # OpenAI compatible
    model: Optional[str] = "kokoro"
    voice: Optional[str] = "ff_siwis"
    response_format: Optional[str] = "mp3"
    speed: Optional[float] = 1.0

# --- LLM Helpers ---
def load_llm(model_id: str, n_ctx: int = 2048, n_threads: int = 4):
    global llm
    try:
        from llama_cpp import Llama
        config = SOVEREIGN_MODELS.get(model_id, SOVEREIGN_MODELS[DEFAULT_MODEL])
        model_path = MODEL_DIR / config["filename"]
        
        if not model_path.exists():
            print(f"❌ Modèle introuvable : {model_path}")
            return False
            
        print(f"🤖 Chargement du LLM [{model_id}]...")
        llm = Llama(
            model_path=str(model_path),
            n_ctx=n_ctx or config.get("ctx", 2048),
            n_threads=n_threads or config.get("threads", 4),
            chat_format="chatml"
        )
        return True
    except ImportError:
        print("⚠️  llama-cpp-python manquant. Le mode LLM sera désactivé.")
        return False

# --- TTS Helpers ---
def get_tts_pipeline(lang_code: str = "f"):
    if lang_code not in tts_pipelines:
        print(f"🎙️ Chargement du pipeline TTS [{lang_code}]...")
        tts_pipelines[lang_code] = KPipeline(lang_code=lang_code, repo_id='hexgrad/Kokoro-82M')
    return tts_pipelines[lang_code]

def synthesize_kokoro_real(text: str, voice: str = "ff_siwis", speed: float = 1.0):
    """
    Synthèse réelle avec KPipeline.
    Retourne les bytes de l'audio au format WAV (ou MP3 si converti).
    Utilise un split par phrase pour une meilleure prosodie.
    """
    lang_code = "f" if (voice.startswith("f") or voice.startswith("hf_")) else "a"
    pipeline = get_tts_pipeline(lang_code)
    
    # Split par phrases pour améliorer la prosodie (au lieu de juste \n)
    generator = pipeline(text, voice=voice, speed=speed, split_pattern=r'[.!?\n]+')
    
    all_audio = []
    for gs, ps, audio in generator:
        if audio is not None:
            all_audio.append(audio)
    
    if not all_audio:
        return None
        
    combined_audio = np.concatenate(all_audio)
    
    # Convertir en bytes (WAV)
    byte_io = io.BytesIO()
    io_sf.write(byte_io, combined_audio, 24000, format='WAV')
    return byte_io.getvalue()

class VocalizeRequest(BaseModel):
    prompt: str
    max_tokens: Optional[int] = 256
    voice: Optional[str] = "ff_siwis"
    speed: Optional[float] = 1.0
    temperature: Optional[float] = 0.7

# --- Endpoints ---
@app.get("/health")
@app.get("/__health")
async def health():
    return {
        "status": "ok", 
        "llm": llm is not None, 
        "tts": len(tts_pipelines) > 0,
        "models": list(SOVEREIGN_MODELS.keys()),
        "uptime": int(time.time()),
        "version": "1.1.0"
    }

@app.get("/status")
@app.get("/__proxy_status")
async def status_endpoint():
    return {
        "status": "active",
        "mode": "sovereign-ai",
        "port": CURRENT_PORT,
        "llm_loaded": llm is not None,
        "tts_loaded": len(tts_pipelines) > 0,
        "features": {
            "vocalize": True,
            "llm": True,
            "tts": True
        }
    }

@app.get("/__exit")
@app.get("/stop")
async def stop_endpoint():
    print("🛑 Requête d'arrêt reçue...")
    # Delay exit to allow response to be sent
    async def delayed_exit():
        await asyncio.sleep(1)
        os.kill(os.getpid(), signal.SIGINT)
    
    asyncio.create_task(delayed_exit())
    return {"status": "stopping"}

@app.post("/v1/vocalize")
async def vocalize_endpoint(req: VocalizeRequest):
    """
    Combined LLM + TTS endpoint with sentence buffering for optimal prosody.
    Streams audio chunks as they are synthesized.
    """
    if not llm:
        raise HTTPException(status_code=503, detail="LLM non chargé")
    
    async def vocalize_generator():
        buffer = ""
        # Punctuation that usually ends a sentence and needs a pause for prosody
        # We split by these characters but keep them in the output
        sentence_endings = re.compile(r'([.!?\n]+)')
        
        voice = req.voice
        lang_code = "f" if (voice.startswith("f") or voice.startswith("hf_")) else "a"
        pipeline = get_tts_pipeline(lang_code)
        
        print(f"🎙️ Starting vocalization for prompt: {req.prompt[:50]}...")

        # 1. Stream tokens from LLM
        for chunk in llm.create_completion(
            req.prompt, 
            max_tokens=req.max_tokens, 
            stream=True, 
            temperature=req.temperature
        ):
            token = chunk['choices'][0]['text']
            buffer += token
            
            # 2. Look for sentence endings in the buffer
            # We use a while loop to handle multiple sentences in one chunk if necessary
            while True:
                parts = sentence_endings.split(buffer, 1)
                if len(parts) < 3:
                    break
                
                sentence = parts[0] + parts[1]
                buffer = parts[2]
                
                if sentence.strip():
                    print(f"🔊 Synthesizing sentence: {sentence.strip()}")
                    # 3. Synthesize the buffered sentence
                    generator = pipeline(sentence, voice=voice, speed=req.speed, split_pattern=r'\n+')
                    for gs, ps, audio in generator:
                        if audio is not None:
                            byte_io = io.BytesIO()
                            io_sf.write(byte_io, audio, 24000, format='WAV')
                            yield byte_io.getvalue()
        
        # 4. Handle remaining text in buffer
        if buffer.strip():
            print(f"🔊 Synthesizing final sentence: {buffer.strip()}")
            generator = pipeline(buffer, voice=voice, speed=req.speed, split_pattern=r'\n+')
            for gs, ps, audio in generator:
                if audio is not None:
                    byte_io = io.BytesIO()
                    io_sf.write(byte_io, audio, 24000, format='WAV')
                    yield byte_io.getvalue()

    return StreamingResponse(vocalize_generator(), media_type="audio/wav")

@app.post("/v1/llm")
async def llm_endpoint(req: LLMRequest):
    if not llm:
        raise HTTPException(status_code=503, detail="LLM non chargé ou llama-cpp-python manquant")
    
    if req.stream:
        def stream_generator():
            for chunk in llm.create_completion(req.prompt, max_tokens=req.max_tokens, stream=True, temperature=req.temperature):
                text = chunk['choices'][0]['text']
                yield text
        return StreamingResponse(stream_generator(), media_type="text/plain")
    else:
        output = llm.create_completion(req.prompt, max_tokens=req.max_tokens, temperature=req.temperature)
        return {"text": output['choices'][0]['text']}

@app.post("/v1/audio/speech")
@app.post("/v1/tts")
async def tts_endpoint(req: TTSRequest):
    # Support à la fois 'input' (OpenAI) et 'text' (Legacy)
    text = req.input
    
    audio_bytes = synthesize_kokoro_real(text, voice=req.voice, speed=req.speed)
    if not audio_bytes:
        raise HTTPException(status_code=500, detail="Erreur de synthèse")
    
    if req.response_format == "base64":
        b64 = base64.b64encode(audio_bytes).decode("utf-8")
        return {"audio_base64": b64}
    else:
        # On retourne du WAV par défaut si mp3 non implémenté
        media_type = "audio/wav" if req.response_format == "wav" else "audio/mpeg"
        return StreamingResponse(io.BytesIO(audio_bytes), media_type=media_type)

@app.websocket("/ws/tts")
async def ws_tts(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            req = json.loads(data)
            text = req.get("text", "")
            voice = req.get("voice", "ff_siwis")
            
            lang_code = "f" if (voice.startswith("f") or voice.startswith("hf_")) else "a"
            pipeline = get_tts_pipeline(lang_code)
            
            generator = pipeline(text, voice=voice, speed=1.0, split_pattern=r'\n+')
            for gs, ps, audio in generator:
                if audio is not None:
                    byte_io = io.BytesIO()
                    io_sf.write(byte_io, audio, 24000, format='WAV')
                    b64 = base64.b64encode(byte_io.getvalue()).decode("utf-8")
                    await websocket.send_json({
                        "type": "audio_chunk",
                        "text": gs,
                        "audio_base64": b64
                    })
    except WebSocketDisconnect:
        print("WebSocket TTS déconnecté")

# --- Management Commands ---
def get_pid_on_port(port):
    try:
        if IS_WIN:
            res = subprocess.check_output(f"netstat -ano | findstr :{port}", shell=True).decode()
            for line in res.strip().split('\n'):
                if f":{port}" in line and "LISTENING" in line:
                    return line.strip().split()[-1]
        else:
            return subprocess.check_output(["fuser", f"{port}/tcp"]).decode().strip()
    except:
        return None

def stop_service(port):
    pid = get_pid_on_port(port)
    if pid:
        print(f"🛑 Arrêt du processus {pid} sur le port {port}...")
        if IS_WIN:
            os.system(f"taskkill /F /PID {pid}")
        else:
            os.system(f"kill -9 {pid}")
        print("✅ Service arrêté.")
    else:
        print(f"ℹ️ Aucun service trouvé sur le port {port}.")

def check_status(port):
    import http.client
    try:
        conn = http.client.HTTPConnection("localhost", port, timeout=2)
        conn.request("GET", "/health")
        res = conn.getresponse()
        if res.status == 200:
            data = json.loads(res.read().decode())
            status = "ONLINE"
            llm_status = "READY" if data.get("llm") else "NOT LOADED"
            print(f"🟢 Sovereign AI is {status} (LLM: {llm_status}) on port {port}")
        else:
            print(f"🟠 Service on port {port} responded with status {res.status}")
    except:
        print(f"🔴 Sovereign AI is OFFLINE on port {port}")

# --- Main CLI ---
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="🏛️ KUDOCRACY SOVEREIGN CONTROLLER")
    subparsers = parser.add_subparsers(dest="command")
    
    # Command: start
    start_p = subparsers.add_parser("start", help="Démarrer le serveur unifié")
    start_p.add_argument("--model", default=DEFAULT_MODEL, choices=list(SOVEREIGN_MODELS.keys()))
    start_p.add_argument("--port", type=int, default=DEFAULT_PORT)
    start_p.add_argument("--threads", type=int, default=4)
    start_p.add_argument("--ctx", type=int, default=2048)
    start_p.add_argument("--no-llm", action="store_true", help="Démarrer sans charger le LLM")

    # Command: stop
    stop_p = subparsers.add_parser("stop", help="Arrêter le serveur")
    stop_p.add_argument("--port", type=int, default=DEFAULT_PORT)

    # Command: status
    status_p = subparsers.add_parser("status", help="Vérifier l'état du serveur")
    status_p.add_argument("--port", type=int, default=DEFAULT_PORT)

    args = parser.parse_args()

    if args.command == "start":
        # 1. Update Global Port for registration
        CURRENT_PORT = args.port

        # 2. Kill existing (only if not running under nodemon which handles its own lifecycle)
        # stop_service(args.port)
        
        # 3. Load LLM if needed
        if not args.no_llm:
            load_llm(args.model, n_ctx=args.ctx, n_threads=args.threads)
        
        # 4. Load TTS Pipeline by default for Sovereign mode
        print("🎙️ Pré-chargement du pipeline TTS par défaut (fr)...")
        get_tts_pipeline("f")
        
        # 5. Start Server
        print(f"🚀 Démarrage du serveur souverain sur http://localhost:{args.port} ...")
        uvicorn.run(app, host="0.0.0.0", port=args.port, log_level="info")

    elif args.command == "stop":
        stop_service(args.port)

    elif args.command == "status":
        check_status(args.port)
        
    else:
        parser.print_help()
