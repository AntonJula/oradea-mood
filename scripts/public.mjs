import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

const port = Number(process.env.PORT ?? 3000);
const candidates = [
  process.env.CLOUDFLARED,
  'C:/Program Files (x86)/cloudflared/cloudflared.exe',
  'C:/Program Files/cloudflared/cloudflared.exe',
].filter(Boolean);
const binary = candidates.find((p) => existsSync(p)) ?? 'cloudflared';

console.log('Pornesc tunelul HTTPS (cloudflared)…');
const tunnel = spawn(binary, ['tunnel', '--no-autoupdate', '--url', 'http://127.0.0.1:' + port], { stdio: ['ignore', 'pipe', 'pipe'] });

tunnel.on('error', (error) => {
  console.error('Nu am putut porni cloudflared: ' + error.message);
  console.error('Instalează-l cu: winget install --id Cloudflare.cloudflared');
  process.exit(1);
});

const url = await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('Tunelul nu a răspuns în 30 de secunde.')), 30_000);
  const scan = (chunk) => {
    const match = chunk.toString().match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
    if (match) {
      clearTimeout(timer);
      resolve(match[0]);
    }
  };
  tunnel.stdout.on('data', scan);
  tunnel.stderr.on('data', scan);
  tunnel.on('exit', (code) => reject(new Error('cloudflared s-a oprit (cod ' + code + ').')));
}).catch((error) => {
  console.error(error.message);
  tunnel.kill();
  process.exit(1);
});

process.env.PUBLIC_BASE_URL = url;
process.env.HOST = '127.0.0.1';
process.env.TRUST_PROXY_ADDRESS = '127.0.0.1';
process.env.TRUST_PROXY_HEADER = 'cf-connecting-ip';

const stop = () => {
  tunnel.kill();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

const { startServer } = await import('../server.mjs');
await startServer();
console.log('');
console.log('Adresă publică: ' + url);
console.log('Oricine scanează QR-ul de pe ecranul TV intră, de pe Wi-Fi sau de pe date mobile.');
console.log('Adresa se schimbă la fiecare pornire. Oprești totul cu Ctrl+C.');
