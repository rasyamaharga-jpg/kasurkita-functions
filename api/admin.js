// api/admin.js (versi minimal untuk testing)
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ status: 'error', message: 'Method not allowed' });

  // Ambil body (Vercel otomatis parse jika ada header Content-Type: application/json)
  let body = req.body;
  if (!body || typeof body !== 'object') {
    // Fallback: coba parse string
    try {
      body = JSON.parse(req.body);
    } catch (e) {
      return res.status(400).json({ status: 'error', message: 'Body tidak valid JSON. Pastikan Content-Type: application/json' });
    }
  }

  const { adminPass, action } = body;
  if (adminPass !== process.env.ADMIN_PASS) {
    await new Promise(r => setTimeout(r, 1000));
    return res.status(403).json({ status: 'error', message: 'Akses ditolak' });
  }

  // Hanya support action verifyLogin untuk testing
  if (action === 'verifyLogin') {
    return res.status(200).json({ status: 'success' });
  }

  return res.status(400).json({ status: 'error', message: 'Action tidak dikenal untuk testing' });
}
