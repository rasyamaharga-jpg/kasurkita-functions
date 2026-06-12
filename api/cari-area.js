// ================================================================
// KasurKita API - Cari Area Biteship
// Vercel Serverless Function
// ================================================================

// Rate limit sederhana pakai in-memory (per instance Vercel)
const rateLimitMap = new Map();

function isRateLimited(ip) {
  const now    = Date.now();
  const window = 60 * 1000; // 1 menit
  const max    = 20;        // max 20 request per menit per IP

  if (!rateLimitMap.has(ip)) {
    rateLimitMap.set(ip, { count: 1, start: now });
    return false;
  }

  const data = rateLimitMap.get(ip);
  if (now - data.start > window) {
    rateLimitMap.set(ip, { count: 1, start: now });
    return false;
  }

  if (data.count >= max) return true;
  data.count++;
  return false;
}

function sanitize(str) {
  if (typeof str !== 'string') return '';
  // Hapus karakter berbahaya, batasi panjang
  return str.replace(/[<>'"`;]/g, '').trim().slice(0, 100);
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ status: 'error', message: 'Method not allowed' });

  // Rate limit
  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress || 'unknown';
  if (isRateLimited(ip)) {
    return res.status(429).json({ status: 'error', message: 'Terlalu banyak request, coba lagi sebentar.' });
  }

  // Validasi input
  const keyword = sanitize(req.query.keyword || '');
  if (!keyword || keyword.length < 3) {
    return res.status(400).json({ status: 'error', message: 'Keyword minimal 3 karakter' });
  }

  // Pastikan API key ada
  if (!process.env.BITESHIP_API_KEY) {
    return res.status(500).json({ status: 'error', message: 'Konfigurasi server bermasalah' });
  }

  try {
    const response = await fetch(
      `https://api.biteship.com/v1/maps/areas?countries=ID&input=${encodeURIComponent(keyword)}&type=single`,
      {
        headers: {
          'Authorization': process.env.BITESHIP_API_KEY,
          'Content-Type' : 'application/json'
        },
        signal: AbortSignal.timeout(8000) // timeout 8 detik
      }
    );

    if (!response.ok) {
      return res.status(502).json({ status: 'error', message: 'Layanan pengiriman sedang gangguan, coba lagi.' });
    }

    const data = await response.json();
    if (!data.success) {
      return res.status(400).json({ status: 'error', message: 'Area tidak ditemukan' });
    }

    // Hanya return field yang diperlukan (jangan bocorkan data berlebih)
    const areas = (data.areas || []).slice(0, 5).map(a => ({
      id  : a.id,
      name: a.name,
      administrative_division_level_1_name: a.administrative_division_level_1_name,
      administrative_division_level_2_name: a.administrative_division_level_2_name,
    }));

    return res.status(200).json({ status: 'success', areas });

  } catch (err) {
    // Jangan bocorkan detail error ke client
    console.error('[cari-area] Error:', err.message);
    if (err.name === 'TimeoutError') {
      return res.status(504).json({ status: 'error', message: 'Request timeout, coba lagi.' });
    }
    return res.status(500).json({ status: 'error', message: 'Terjadi kesalahan, coba lagi.' });
  }
}
