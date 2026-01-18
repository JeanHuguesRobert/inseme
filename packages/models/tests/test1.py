from kokoro import KPipeline
import soundfile as sf
import torch

# Initialisation du pipeline pour le français avec repo_id explicite
pipeline = KPipeline(lang_code='f', repo_id='hexgrad/Kokoro-82M') 

text = "Bonjour, ceci est un test de synthèse vocale en français avec Kokoro 82M."
# Voix possibles : 'af_bella' (US), 'ff_siwis' (FR?)
voice = 'af_bella' 

generator = pipeline(text, voice=voice, speed=1.0, split_pattern=r'\n+')

for i, (gs, ps, audio) in enumerate(generator):
    print(f"Segment {i}: {gs}")
    sf.write(f"test_fr_{i}.wav", audio, 24000)
    print(f"Fichier test_fr_{i}.wav généré.")
