import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import handler from '../api/quote.js';
const root=process.cwd();
http.createServer(async(req,res)=>{
 if(req.url==='/api/quote'){res.status=s=>{res.statusCode=s;return res;};res.json=v=>res.end(JSON.stringify(v));return handler(req,res);}
 const url=new URL(req.url,'http://localhost');let name=url.pathname==='/'?'/index.html':url.pathname==='/quote'?'/quote.html':url.pathname;
 const file=path.resolve(root,'.'+name);if(!file.startsWith(root+'/')){res.writeHead(403).end();return;}
 try{const data=await readFile(file);res.setHeader('Content-Type',file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.js')?'text/javascript':file.endsWith('.jpg')?'image/jpeg':'application/octet-stream');res.end(data);}catch{res.writeHead(404).end();}
}).listen(18765,'127.0.0.1');
