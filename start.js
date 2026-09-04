/**
 * 《太陽之心：法老的試煉》
 * 本地 Web 伺服器啟動腳本 (start.js)
 * 
 * 用途：繞過瀏覽器本地開啟 (file://) 的 Canvas CORS 安全限制。
 * 啟動後會以 http://localhost:8080/ 執行遊戲，使人物圖片的色度去背 (Chroma Keying) 完美生效。
 */

import { exec } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = 8080;
const ROOT_DIR = path.dirname(fileURLToPath(import.meta.url));

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.json': 'application/json'
};

const server = http.createServer((req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, `http://localhost:${PORT}`).pathname);
  } catch {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('400 無效的網址');
    return;
  }

  const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const filePath = path.resolve(ROOT_DIR, relativePath);
  const isInsideProject = filePath === ROOT_DIR || filePath.startsWith(`${ROOT_DIR}${path.sep}`);
  if (!isInsideProject) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('403 禁止存取');
    return;
  }

  const extname = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[extname] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('404 找不到檔案');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('500 伺服器錯誤: ' + err.code);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
});

server.listen(PORT, () => {
  const url = `http://localhost:${PORT}/`;
  
  console.log(`\n==================================================`);
  console.log(` 🌞 《太陽之心：法老的試煉》 伺服器啟動成功！`);
  console.log(` 🔗 遊戲網址：\x1b[36m${url}\x1b[0m`);
  console.log(` 💡 本地伺服器開啟狀態下，角色圖片自動去背將完美生效！`);
  console.log(`==================================================\n`);

  // CI / smoke test 可設定 NO_OPEN=1，避免自動開啟瀏覽器。
  if (process.env.NO_OPEN !== '1') {
    try {
      if (process.platform === 'win32') {
        exec(`start ${url}`);
      } else if (process.platform === 'darwin') {
        exec(`open ${url}`);
      } else {
        exec(`xdg-open ${url}`);
      }
    } catch {
      console.log(`💡 請手動在瀏覽器中輸入：${url}`);
    }
  }
});
