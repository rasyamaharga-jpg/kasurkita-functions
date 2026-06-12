// api/admin.js - Versi final yang menerima POST dan GET (untuk testing)
export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Jika method GET, beri petunjuk
  if (req.method === 'GET') {
    return res.status(200).json({ 
      message: 'Admin endpoint. Gunakan method POST dengan JSON body: { "adminPass": "...", "action": "verifyLogin" }' 
    });
  }
  
  // Hanya menerima POST untuk action
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Gunakan POST.' });
  }
  
  // Baca body (Vercel sudah parse jika header Content-Type JSON)
  let body = req.body;
  if (!body || typeof body !== 'object') {
    try {
      body = JSON.parse(req.body);
    } catch (e) {
      return res.status(400).json({ error: 'Body tidak valid JSON. Pastikan Content-Type: application/json', raw: req.body });
    }
  }
  
  const { adminPass, action } = body;
  
  // Verifikasi password
  if (!adminPass || adminPass !== process.env.ADMIN_PASS) {
    await new Promise(r => setTimeout(r, 1000));
    return res.status(403).json({ error: 'Akses ditolak' });
  }
  
  // Action yang didukung
  if (action === 'verifyLogin') {
    return res.status(200).json({ status: 'success' });
  }
  
  // Tambahkan action lain di sini jika perlu (getAllPesanan, dll)
  
  return res.status(400).json({ error: `Action '${action}' tidak dikenal` });
}
