import { readFileSync } from "fs";

const content = readFileSync("src/guncordplugins/autoTranslateGuncord/index.ts", "utf8");
const matches = content.match(/"en":/g) || [];
console.log(`Total valid translated keys in autoTranslateGuncord: ${matches.length}`);

