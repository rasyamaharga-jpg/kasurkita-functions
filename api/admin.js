// api/admin.js (dengan manual body parsing)
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
const ADMIN_PASS = process.env.ADMIN_PASS;
const GAS_URL = process.env.GAS_URL;

const cleanUrl = SUPABASE_URL.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ status: 'error', message: 'Method not allowed' });

  // Baca raw body secara manual (untuk mengatasi masalah parsing)
  let rawBody = '';
  try {
    const buffers = [];
    for await (const chunk of req) buffers.push(chunk);
    rawBody = Buffer.concat(buffers).toString();
  } catch (err) {
    return res.status(400).json({ status: 'error', message: 'Gagal membaca body: ' + err.message });
  }

  let body;
  try {
    body = JSON.parse(rawBody);
  } catch (e) {
    return res.status(400).json({ status: 'error', message: 'Body tidak valid JSON: ' + e.message + ' - raw: ' + rawBody });
  }

  if (!body.adminPass || body.adminPass !== ADMIN_PASS) {
    await new Promise(r => setTimeout(r, 1000));
    return res.status(403).json({ status: 'error', message: 'Akses ditolak' });
  }

  const { action } = body;

  // ... sisanya sama seperti kode sebelumnya ...
}
