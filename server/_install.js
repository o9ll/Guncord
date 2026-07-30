// Temporary script to install discord-video-stream and list its files
// Run: node _install.js
const { execSync } = require("child_process");
try {
    execSync("npm install @dank074/discord-video-stream@latest --no-save", { stdio: "inherit", cwd: __dirname });
} catch(e) {}
