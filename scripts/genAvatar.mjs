import fs from "fs";
const buf = fs.readFileSync("C:\\Users\\o9\\Documents\\Githubb\\Guncord\\assets\\avatar.png");
const b64 = buf.toString("base64");
fs.writeFileSync("src/guncordplugins/guncordOfficialDM/avatarData.ts", `export const GUNCORD_AVATAR_BASE64 = "data:image/png;base64,${b64}";\n`);
console.log("Generated avatarData.ts successfully, length:", b64.length);