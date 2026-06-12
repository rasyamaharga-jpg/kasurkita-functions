// Vercel Function - Cari Area Biteship
const rateLimitMap = new Map();

function isRateLimited(ip) {
  const now = Date.now(), window = 60000, max = 20;
  if (!rateLimitMap.has(ip)) { rateLimitMap.set(ip, { count: 1, start: now }); return false; }
  const d = rateLimitMap.get(ip);
  if (now - d.start > window) { rateLimitMap.set(ip, { count: 1, start: now }); return false; }
  if (d.count >= max) return true;
  d.count++; return false;
}

function sanitize(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[<>'"`;]/g, '').trim().slice(0, 100);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ status: 'error', message: 'Method not allowed' });

  const ip = req.headers['x-forwarded-for']?.split(',')[0] || 'unknown';
  if (isRateLimited(ip)) return res.status(429).json({ status: 'error', message: 'Terlalu banyak request' });

  const keyword = sanitize(req.query.keyword || '');
  if (!keyword || keyword.length < 3) return res.status(400).json({ status: 'error', message: 'Keyword minimal 3 karakter' });

  if (!process.env.BITESHIP_API_KEY) return res.status(500).json({ status: 'error', message: 'Konfigurasi server bermasalah' });

  try {
    const response = await fetch(
      `https://api.biteship.com/v1/maps/areas?countries=ID&input=${encodeURIComponent(keyword)}&type=single`,
      { headers: { 'Authorization': process.env.BITESHIP_API_KEY, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(8000) }
    );
    if (!response.ok) return res.status(502).json({ status: 'error', message: 'Layanan pengiriman sedang gangguan' });
    const data = await response.json();
    if (!data.success) return res.status(400).json({ status: 'error', message: 'Area tidak ditemukan' });
    const areas = (data.areas || []).slice(0, 5).map(a => ({
      id: a.id,
      name: a.name,
      administrative_division_level_1_name: a.administrative_division_level_1_name,
      administrative_division_level_2_name: a.administrative_division_level_2_name
    }));
    res.status(200).json({ status: 'success', areas });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: 'Terjadi kesalahan' });
  }
}
