import fs from "node:fs";
import crypto from "node:crypto";
import {spawnSync} from "node:child_process";
const idx=Number(process.env.CHUNK_INDEX);
if(!Number.isInteger(idx)||idx<0||idx>15)throw Error("invalid_chunk_index");
const out=process.env.OUTPUT_DIR||"gatel-output";
fs.mkdirSync(out,{recursive:true});
const base="https://vodsenat.akamaized.net/senat/2026/10/encoder7_20261013081627_ps928010_pd5129990.smil/chunklist_b749000.m3u8";
const status={schema:"gatel.asr-chunk-status/v1",chunk_index:idx,source:base,model:"faster-whisper/base",status:"started"};
async function fetchBytes(url){
  for(let attempt=0;attempt<3;attempt++){
    try{const r=await fetch(url,{signal:AbortSignal.timeout(20000)});
      if(!r.ok)throw Error("http_"+r.status);
      return Buffer.from(await r.arrayBuffer());
    }catch(e){if(attempt===2)throw Error("download_"+url.slice(-80)+":"+e.message);}
  }
}
(async()=>{
 try {
  const playlist=(await fetchBytes(base)).toString("utf8");
  const lines=playlist.split(/\r?\n/);
  const names=lines.filter(line=>line&&!line.startsWith("#"));
  const durations=lines.filter(line=>line.startsWith("#EXTINF:")).map(line=>Number(line.slice(8).split(",")[0]));
  if(names.length!==durations.length||names.length<idx*32)throw Error("invalid_playlist");
  const start=idx*32,end=Math.min(start+32,names.length);
  status.start_seconds=durations.slice(0,start).reduce((a,b)=>a+b,0);
  status.duration_seconds=durations.slice(start,end).reduce((a,b)=>a+b,0);
  status.media_segments=end-start;
  const payload=[];
  for(let i=start;i<end;i++)payload.push(await fetchBytes(new URL(names[i],base).href));
  const buf=Buffer.concat(payload);
  status.media_sha256=crypto.createHash("sha256").update(buf).digest("hex");
  status.media_bytes=buf.length;
  fs.writeFileSync("/tmp/gatel-asr-input.ts",buf);
  const install=spawnSync("python3",["-m","pip","install","-q","--disable-pip-version-check","--target","/tmp/gatel-asr","faster-whisper","imageio-ffmpeg"],{timeout:120000,encoding:"utf8"});
  if(install.status!==0)throw Error("dependency_install:"+String(install.stderr).slice(-400));
  const script=`import sys,subprocess,json,wave
sys.path.insert(0,"/tmp/gatel-asr")
import numpy as np,imageio_ffmpeg
from faster_whisper import WhisperModel
p=subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(),"-y","-f","mpegts","-i","/tmp/gatel-asr-input.ts","-vn","-ar","16000","-ac","1","-c:a","pcm_s16le","/tmp/gatel-asr-input.wav"],capture_output=True,text=True,timeout=45)
if p.returncode:raise RuntimeError("ffmpeg:"+p.stderr[-500:])
with wave.open("/tmp/gatel-asr-input.wav","rb") as w:
 audio=np.frombuffer(w.readframes(w.getnframes()),np.int16).astype(np.float32)/32768.
model=WhisperModel("base",device="cpu",compute_type="int8")
segments,info=model.transcribe(audio,language="fr",beam_size=3,condition_on_previous_text=False)
rows=[{"start":round(s.start,2),"end":round(s.end,2),"text":s.text} for s in segments]
with open(sys.argv[1],"w") as f:json.dump({"schema":"gatel.asr-chunk/v1","model":"faster-whisper/base","chunk_index":int(sys.argv[2]),"time_offset":float(sys.argv[3]),"segments":rows},f,ensure_ascii=False,indent=2)
`;
  const p=spawnSync("python3",["-c",script,`${out}/transcript-${String(idx).padStart(2,"0")}.json`,String(idx),String(status.start_seconds)],{timeout:205000,encoding:"utf8"});
  if(p.status!==0)throw Error("asr_exit_"+p.status+":"+String(p.stderr||p.error?.message).slice(-850));
  status.status="transcribed";
 }catch(e){status.status="failed";status.error=String(e.message||e).slice(0,1000);}
 fs.writeFileSync(`${out}/status-${String(idx).padStart(2,"0")}.json`,JSON.stringify(status,null,2));
 console.log(JSON.stringify({chunk:idx,status:status.status,start:status.start_seconds,error:status.error||null}));
})();
