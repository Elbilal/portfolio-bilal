import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
const root = process.cwd()+'/';
const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  console.log(path, join(root, path.endsWith('/') ? path + 'index.html' : path));
  try { const body = await readFile(join(root, path.endsWith('/') ? path + 'index.html' : path)); res.writeHead(200).end(body);} catch(e) { console.log(e.message); res.writeHead(404).end(); }
}).listen(5199);
