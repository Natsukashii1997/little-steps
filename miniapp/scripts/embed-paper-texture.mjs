#!/usr/bin/env node

import { readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDir, "../miniprogram");
const image = await readFile(resolve(root, "assets/ui/paper-tile.jpg"));
const value = `url("data:image/jpeg;base64,${image.toString("base64")}")`;

async function walk(folder) {
  const output = [];
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    const fullPath = resolve(folder, entry.name);
    if (entry.isDirectory()) output.push(...await walk(fullPath));
    else if (entry.isFile() && extname(entry.name) === ".wxss") output.push(fullPath);
  }
  return output;
}

for (const file of await walk(root)) {
  let source = await readFile(file, "utf8");
  source = source.replaceAll('url("/assets/ui/paper-tile.jpg")', "var(--paper-texture)");
  if (file === resolve(root, "app.wxss") && !source.includes("--paper-texture:")) {
    source = source.replace("page {", `page {\n  --paper-texture: ${value};`);
  }
  const componentRoots = [
    [resolve(root, "components/app-header/index.wxss"), ".header-shell {"],
    [resolve(root, "components/app-tabbar/index.wxss"), ".tabbar-shell {"],
    [resolve(root, "components/add-pill/index.wxss"), ".add-pill {"],
  ];
  for (const [componentFile, selector] of componentRoots) {
    if (file === componentFile && !source.includes("--paper-texture:")) {
      source = source.replace(selector, `${selector}\n  --paper-texture: ${value};`);
    }
  }
  await writeFile(file, source);
}

console.log("Paper texture embedded into WXSS as data URI.");
