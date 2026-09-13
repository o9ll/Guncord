/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 o9
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "fs";
import http from "http";
import https from "https";
import path from "path";
import os from "os";

async function main() {
    const rawVersion = process.argv[2] || "1.27.2";
    const version = rawVersion.replace(/^v/i, "");
    const tag = `v${version}`;
    const notes = process.argv[4] || tag;

    const githubUrl = "https://api.github.com";
    const repo = "o9ll/Guncord";

    // Read token from project root or user home directory
    let tokenFile = path.join(process.cwd(), ".github_token");
    if (!fs.existsSync(tokenFile)) {
        tokenFile = path.join(os.homedir(), ".github_token");
    }
    if (!fs.existsSync(tokenFile)) {
        console.error(`\n [ERROR] Token file not found.`);
        console.error(` Create a .github_token file with your token.`);
        process.exit(1);
    }
    const token = fs.readFileSync(tokenFile, "utf8").trim().replace(/[\r\n\s]+/g, "");
    if (!token) {
        console.error(`\n [ERROR] Empty GitHub token in ${tokenFile}`);
        process.exit(1);
    }

    // Check local SSH tunnel (port 3000) for 0 Cloudflare limit
    let baseUrl = "http://127.0.0.1:3000";
    try {
        await new Promise((res, rej) => {
            const req = http.get("http://127.0.0.1:3000", { timeout: 2000 }, r => {
                if (r.statusCode === 200) res(true); else rej();
            });
            req.on("error", rej);
            req.on("timeout", () => { req.destroy(); rej(); });
        });
        console.log(`  [SSH Tunnel Connected] Using ${baseUrl} (0 limite Cloudflare)`);
    } catch {
        baseUrl = githubUrl;
        console.log(`  [Direct Cloudflare] Using ${baseUrl}`);
    }

    const client = baseUrl.startsWith("https") ? https : http;

    function reqPromise(options, bodyData) {
        return new Promise((resolve, reject) => {
            const req = client.request(options, res => {
                let chunks = [];
                res.on("data", d => chunks.push(d));
                res.on("end", () => {
                    const buf = Buffer.concat(chunks);
                    resolve({ status: res.statusCode, data: buf.toString("utf8"), raw: buf });
                });
            });
            req.on("error", reject);
            if (bodyData) req.write(bodyData);
            req.end();
        });
    }

    // Detect valid auth header format (token vs Bearer)
    let authHeader = `token ${token}`;
    const testUserUrl = new URL(`${baseUrl}/user`);
    const testRes = await reqPromise({
        hostname: testUserUrl.hostname,
        port: testUserUrl.port || (testUserUrl.protocol === "https:" ? 443 : 80),
        path: testUserUrl.pathname,
        method: "GET",
        headers: { "Authorization": authHeader, "Accept": "application/json" }
    });

    if (testRes.status === 401) {
        const testBearer = await reqPromise({
            hostname: testUserUrl.hostname,
            port: testUserUrl.port || (testUserUrl.protocol === "https:" ? 443 : 80),
            path: testUserUrl.pathname,
            method: "GET",
            headers: { "Authorization": `Bearer ${token}`, "Accept": "application/json" }
        });
        if (testBearer.status === 200) {
            authHeader = `Bearer ${token}`;
        }
    }

    // 1. Check or Create Release
    console.log(`  Creating/Retrieving release ${tag}...`);
    const urlObj = new URL(`${baseUrl}/repos/${repo}/releases/tags/${tag}`);
    let releaseRes = await reqPromise({
        hostname: urlObj.hostname,
        port: urlObj.port || (urlObj.protocol === "https:" ? 443 : 80),
        path: urlObj.pathname,
        method: "GET",
        headers: { "Authorization": authHeader, "Accept": "application/json" }
    });

    let release = null;
    if (releaseRes.status === 200) {
        release = JSON.parse(releaseRes.data);
    } else {
        const createUrl = new URL(`${baseUrl}/repos/${repo}/releases`);
        const payload = JSON.stringify({
            tag_name: tag,
            name: tag,
            body: notes,
            draft: false,
            prerelease: false
        });
        const createRes = await reqPromise({
            hostname: createUrl.hostname,
            port: createUrl.port || (createUrl.protocol === "https:" ? 443 : 80),
            path: createUrl.pathname,
            method: "POST",
            headers: {
                "Authorization": authHeader,
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(payload)
            }
        }, payload);

        if (createRes.status === 201 || createRes.status === 200) {
            release = JSON.parse(createRes.data);
        } else {
            throw new Error(`Failed to create release: ${createRes.status} ${createRes.data}\n\n Tip: Check your GitHub token in ${tokenFile} (GitHub Settings -> Developer settings -> Personal access tokens -> Generate new token with 'repo' scope).`);
        }
    }

    // 1b. Ensure multiplatform GUI installers exist for Linux & macOS
    console.log("  Verification/Download of Linux and macOS installers...");
    const platformBinaries = [
        { remote: "Equilotl", local: "Guncord-Linux" },
        { remote: "Equilotl-x11", local: "Guncord-Linux-x11" },
        { remote: "Equilotl-wayland", local: "Guncord-Linux-wayland" },
        { remote: "Equilotl-darwin-arm64.zip", local: "Guncord-darwin-arm64.zip" },
        { remote: "Equilotl-darwin-x64.zip", local: "Guncord-darwin-x64.zip" }
    ];
    const installerBaseUrl = "https://github.com/Equicord/Equilotl/releases/latest/download/";
    const installerOutDir = path.join("release", "installer");
    if (!fs.existsSync(installerOutDir)) fs.mkdirSync(installerOutDir, { recursive: true });

    for (const b of platformBinaries) {
        const dest = path.join(installerOutDir, b.local);
        if (fs.existsSync(dest) && fs.statSync(dest).size > 100000) {
            continue;
        }
        try {
            console.log(`    -> Downloading ${b.local}...`);
            const res = await fetch(installerBaseUrl + b.remote, {
                headers: { "User-Agent": "Guncord (https://github.com/o9ll/Guncord)" }
            });
            if (res.ok) {
                const buf = Buffer.from(await res.arrayBuffer());
                fs.writeFileSync(dest, buf);
                console.log(`       OK : ${b.local} (${(buf.length / (1024 * 1024)).toFixed(1)} MB)`);
            }
        } catch (e) {
            console.warn(`    [Warning] Failed to download ${b.remote}:`, e.message);
        }
    }

    const releaseId = release.id;
    console.log(`  Release ID: ${releaseId} (Name: ${release.name}, Tag: ${release.tag_name})`);

    // 2. Assets to upload
    const filesToUpload = [
        { name: "Guncord-Installer.exe", path: path.join("release", "installer", "Guncord-Installer.exe"), type: "application/octet-stream" },
        { name: "Guncord-Linux", path: path.join("release", "installer", "Guncord-Linux"), type: "application/octet-stream" },
        { name: "Guncord-Linux-x11", path: path.join("release", "installer", "Guncord-Linux-x11"), type: "application/octet-stream" },
        { name: "Guncord-Linux-wayland", path: path.join("release", "installer", "Guncord-Linux-wayland"), type: "application/octet-stream" },
        { name: "Guncord-darwin-arm64.zip", path: path.join("release", "installer", "Guncord-darwin-arm64.zip"), type: "application/zip" },
        { name: "Guncord-darwin-x64.zip", path: path.join("release", "installer", "Guncord-darwin-x64.zip"), type: "application/zip" },
        { name: "desktop.asar", path: path.join("dist", "desktop.asar"), type: "application/octet-stream" },
        { name: "guncordDesktop.asar", path: path.join("dist", "desktop.asar"), type: "application/octet-stream" },
        { name: "install.sh", path: path.join("install.sh"), type: "text/x-shellscript" },
        { name: "install.ps1", path: path.join("install.ps1"), type: "text/plain" },
        { name: "extension-chrome.zip", path: path.join("dist", "extension-chrome.zip"), type: "application/zip" },
        { name: "extension-firefox.zip", path: path.join("dist", "extension-firefox.zip"), type: "application/zip" },
        { name: "guncord-dist.zip", path: path.join("release", "installer", "guncord-dist.zip"), type: "application/zip" },
        { name: "version.json", path: path.join("release", "installer", "version.json"), type: "application/json" }
    ];

    // Delete existing old assets with identical names
    if (Array.isArray(release.assets)) {
        for (const asset of release.assets) {
            if (filesToUpload.some(f => f.name === asset.name)) {
                console.log(`  Deleting old asset: ${asset.name}`);
                const delUrl = new URL(`${baseUrl}/repos/${repo}/releases/${releaseId}/assets/${asset.id}`);
                await reqPromise({
                    hostname: delUrl.hostname,
                    port: delUrl.port || (delUrl.protocol === "https:" ? 443 : 80),
                    path: delUrl.pathname,
                    method: "DELETE",
                    headers: { "Authorization": authHeader }
                });
            }
        }
    }

    // 3. Upload each asset
    for (const f of filesToUpload) {
        if (!fs.existsSync(f.path)) {
            console.warn(`  [Ignored] File not found: ${f.path}`);
            continue;
        }

        const size = fs.statSync(f.path).size;
        const sizeMb = (size / (1024 * 1024)).toFixed(1);
        console.log(`  -> Uploading ${f.name} (${sizeMb} MB)...`);

        const uploadUrl = new URL(`${baseUrl.replace("api.github.com", "uploads.github.com")}/repos/${repo}/releases/${releaseId}/assets?name=${encodeURIComponent(f.name)}`);

        await new Promise((res, rej) => {
            const fileStream = fs.createReadStream(f.path);
            const req = client.request({
                hostname: uploadUrl.hostname,
                port: uploadUrl.port || (uploadUrl.protocol === "https:" ? 443 : 80),
                path: uploadUrl.pathname + uploadUrl.search,
                method: "POST",
                headers: {
                    "Authorization": authHeader,
                    "Content-Type": f.type,
                    "Content-Length": size
                }
            }, r => {
                if (r.statusCode >= 200 && r.statusCode < 300) {
                    console.log(`     OK: ${f.name}`);
                    res();
                } else {
                    let body = "";
                    r.on("data", d => body += d);
                    r.on("end", () => rej(new Error(`Upload error ${r.statusCode}: ${body}`)));
                }
            });
            req.on("error", rej);
            fileStream.pipe(req);
        });
    }

    console.log(`\n  All ${filesToUpload.length} assets have been successfully published!`);
}

main().catch(err => {
    console.error("\n  [ERROR]", err);
    process.exit(1);
});
