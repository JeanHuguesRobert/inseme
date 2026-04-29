import fs from "fs";
import path from "path";

const knownShells = [
  { name: "Command Prompt", paths: ["C:\\Windows\\System32\\cmd.exe"] },
  { name: "PowerShell", paths: ["C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe"] },
  {
    name: "PowerShell Core",
    paths: [
      "C:\\Program Files\\PowerShell\\7\\pwsh.exe",
      "C:\\Program Files (x86)\\PowerShell\\7\\pwsh.exe",
    ],
  },
  { name: "WSL", paths: ["C:\\Windows\\System32\\wsl.exe"] },
  {
    name: "Git Bash",
    paths: ["C:\\Program Files\\Git\\bin\\bash.exe", "C:\\Program Files (x86)\\Git\\bin\\bash.exe"],
  },
  { name: "Cygwin", paths: ["C:\\cygwin64\\bin\\bash.exe", "C:\\cygwin\\bin\\bash.exe"] },
  { name: "MSYS2", paths: ["C:\\msys64\\usr\\bin\\bash.exe"] },
];

// Executables à chercher dans le PATH
const shellExecutables = ["cmd.exe", "powershell.exe", "pwsh.exe", "bash.exe", "sh.exe"];

// CLI IA courants (Anthropic Claude, OpenAI, Mistral, LocalAI…)
const aiCLIExecutables = [
  "claude.exe",
  "anthropic.exe",
  "openai.exe",
  "localai.exe",
  "mistral.exe",
];

const findShells = () => {
  const found = [];

  // 1. Chercher dans les chemins connus
  knownShells.forEach((shell) => {
    shell.paths.forEach((p) => {
      if (fs.existsSync(p)) {
        found.push({ name: shell.name, path: p });
      }
    });
  });

  // 2. Chercher dans le PATH pour shells et CLI IA
  const pathDirs = process.env.PATH.split(";").filter(Boolean);

  pathDirs.forEach((dir) => {
    // Shells classiques
    shellExecutables.forEach((exe) => {
      try {
        const full = path.join(dir, exe);
        if (
          fs.existsSync(full) &&
          !found.some((s) => s.path.toLowerCase() === full.toLowerCase())
        ) {
          let name = exe;
          if (exe === "bash.exe" || exe === "sh.exe") name = "Bash (from PATH)";
          found.push({ name, path: full });
        }
      } catch {}
    });

    // CLI IA
    aiCLIExecutables.forEach((exe) => {
      try {
        const full = path.join(dir, exe);
        if (
          fs.existsSync(full) &&
          !found.some((s) => s.path.toLowerCase() === full.toLowerCase())
        ) {
          found.push({ name: `AI CLI (${exe.replace(".exe", "")})`, path: full });
        }
      } catch {}
    });
  });

  return found;
};

const shells = findShells();
console.log("Shells et CLI IA trouvés sur cette machine :");
shells.forEach((s) => console.log(`${s.name} -> ${s.path}`));
