import { readFile, readdir, access } from "node:fs/promises";
import { resolve, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const root = fileURLToPath(new URL("../apps/web/", import.meta.url));
let modules = 0;
let references = 0;
async function inspect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) { await inspect(path); continue; }
    if (![".js", ".mjs", ".html", ".css"].includes(extname(path))) continue;
    const content = await readFile(path, "utf8");
    if ([".js", ".mjs"].includes(extname(path))) {
      execFileSync(process.execPath, ["--check", path], { stdio: "pipe" });
      modules += 1;
    }
    const patterns = [
      /(?:import|export)\s+(?:[^"'`;]*?\s+from\s*)?["']([^"']+)["']/g,
      /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
      /(?:src|href)=["']([^"']+)["']/g,
      /url\(["']?([^\s"')]+)["']?\)/g,
    ];
    for (const pattern of patterns) {
      for (const match of content.matchAll(pattern)) {
        if (!match[1].startsWith(".")) continue;
        await access(resolve(dirname(path), match[1].split(/[?#]/)[0]));
        references += 1;
      }
    }
  }
}
await inspect(root);
console.log(`ARC 检查通过：${modules} 个模块语法，${references} 个本地资源/导入引用。`);
