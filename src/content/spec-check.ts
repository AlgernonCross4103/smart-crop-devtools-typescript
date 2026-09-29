import { readFile } from "node:fs/promises";

const work = process.argv[process.argv.indexOf("--work") + 1] ?? process.cwd();
const required = ["README.md", "spec-meta.json", "src/smart-crop-service.ts", "src/smart-crop-service.test.ts"];
for (const file of required) await readFile(`${work}/${file}`);
console.log("spec-check passed");
