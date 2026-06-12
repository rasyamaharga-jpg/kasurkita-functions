// ================================================================
// KasurKita API - Cek Ongkir Biteship
// Vercel Serverless Function
// ================================================================

const rateLimitMap = new Map();

function isRateLimited(ip) {
  const now    = Date.now();
  const window = 60 * 1000;
  const max    = 15; // max 15 cek ongkir per menit per IP

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

export default async function handler(req, res) {
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
  const { destinationAreaId, weight } = req.query;

  if (!destinationAreaId || typeof destinationAreaId !== 'string' || destinationAreaId.length > 50) {
    return res.status(400).json({ status: 'error', message: 'destinationAreaId tidak valid' });
  }
  // Hanya izinkan karakter alphanumeric dan strip
  if (!/^[a-zA-Z0-9_-]+$/.test(destinationAreaId)) {
    return res.status(400).json({ status: 'error', message: 'destinationAreaId mengandung karakter tidak valid' });
  }

  const weightNum = parseInt(weight);
  if (isNaN(weightNum) || weightNum < 100 || weightNum > 50000) {
    return res.status(400).json({ status: 'error', message: 'Berat tidak valid (100-50000 gram)' });
  }

  if (!process.env.BITESHIP_API_KEY || !process.env.ORIGIN_AREA_ID) {
    return res.status(500).json({ status: 'error', message: 'Konfigurasi server bermasalah' });
  }

  try {
    const response = await fetch('https://api.biteship.com/v1/rates/couriers', {
      method : 'POST',
      headers: {
        'Authorization': process.env.BITESHIP_API_KEY,
        'Content-Type' : 'application/json'
      },
      body  : JSON.stringify({
        origin_area_id     : process.env.ORIGIN_AREA_ID,
        destination_area_id: destinationAreaId,
        couriers           : 'jnt,wahana,idexpress',
        items: [{
          name    : 'Sprei KasurKita',
          value   : 100000,
          weight  : weightNum,
          quantity: 1
        }]
      }),
      signal: AbortSignal.timeout(8000)
    });

    if (!response.ok) {
      return res.status(502).json({ status: 'error', message: 'Layanan pengiriman sedang gangguan.' });
    }

    const data = await response.json();
    if (!data.success) {
      return res.status(400).json({ status: 'error', message: 'Tidak ada kurir tersedia untuk area ini' });
    }

    // Filter hanya field yang diperlukan
    const couriers = (data.pricing || []).map(c => ({
      courier_code        : c.courier_code,
      courier_service_code: c.courier_service_code,
      courier_name        : c.courier_name,
      courier_service_name: c.courier_service_name,
      price               : c.price,
      duration            : c.duration || '-'
    }));

    return res.status(200).json({ status: 'success', couriers });

  } catch (err) {
    console.error('[cek-ongkir] Error:', err.message);
    if (err.name === 'TimeoutError') {
      return res.status(504).json({ status: 'error', message: 'Request timeout, coba lagi.' });
    }
    return res.status(500).json({ status: 'error', message: 'Terjadi kesalahan, coba lagi.' });
  }
}
