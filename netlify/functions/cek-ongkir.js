// Netlify Function - Cek Ongkir Biteship (Format Baru)
const rateLimitMap = new Map();

function isRateLimited(ip) {
  const now = Date.now(), window = 60000, max = 15;
  if (!rateLimitMap.has(ip)) { rateLimitMap.set(ip, { count: 1, start: now }); return false; }
  const d = rateLimitMap.get(ip);
  if (now - d.start > window) { rateLimitMap.set(ip, { count: 1, start: now }); return false; }
  if (d.count >= max) return true;
  d.count++; return false;
}

export default async (req, context) => {
  // CORS
  if (req.method === 'OPTIONS') {
    return new Response('', {
      status: 200,
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' }
    });
  }

  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };

  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ status: 'error', message: 'Method not allowed' }), { status: 405, headers });
  }

  const url    = new URL(req.url);
  const destId = url.searchParams.get('destinationAreaId');
  const weight = url.searchParams.get('weight');

  if (!destId || !/^[a-zA-Z0-9_-]+$/.test(destId) || destId.length > 50) {
    return new Response(JSON.stringify({ status: 'error', message: 'destinationAreaId tidak valid' }), { status: 400, headers });
  }

  const weightNum = parseInt(weight);
  if (isNaN(weightNum) || weightNum < 100 || weightNum > 50000) {
    return new Response(JSON.stringify({ status: 'error', message: 'Berat tidak valid' }), { status: 400, headers });
  }

  if (!process.env.BITESHIP_API_KEY || !process.env.ORIGIN_AREA_ID) {
    return new Response(JSON.stringify({ status: 'error', message: 'Konfigurasi server bermasalah' }), { status: 500, headers });
  }

  try {
    const res  = await fetch('https://api.biteship.com/v1/rates/couriers', {
      method : 'POST',
      headers: { 'Authorization': process.env.BITESHIP_API_KEY, 'Content-Type': 'application/json' },
      body   : JSON.stringify({
        origin_area_id     : process.env.ORIGIN_AREA_ID,
        destination_area_id: destId,
        couriers           : 'jnt,wahana,idexpress',
        items: [{ name: 'Sprei KasurKita', value: 100000, weight: weightNum, quantity: 1 }]
      }),
      signal: AbortSignal.timeout(8000)
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[cek-ongkir] HTTP', res.status, errText);
      return new Response(JSON.stringify({ status: 'error', message: 'Layanan pengiriman sedang gangguan.', debug: errText }), { status: 502, headers });
    }

    const data = await res.json();
    if (!data.success) {
      console.error('[cek-ongkir] Biteship error:', JSON.stringify(data));
      return new Response(JSON.stringify({ status: 'error', message: 'Tidak ada kurir tersedia', debug: data }), { status: 400, headers });
    }

    const couriers = (data.pricing || []).map(c => ({
      courier_code        : c.courier_code,
      courier_service_code: c.courier_service_code,
      courier_name        : c.courier_name,
      courier_service_name: c.courier_service_name,
      price               : c.price,
      duration            : c.duration || '-'
    }));

    return new Response(JSON.stringify({ status: 'success', couriers }), { status: 200, headers });

  } catch (err) {
    console.error('[cek-ongkir] Error:', err.message);
    return new Response(JSON.stringify({ status: 'error', message: err.name === 'TimeoutError' ? 'Request timeout.' : 'Terjadi kesalahan.' }), { status: 500, headers });
  }
};

export const config = { path: '/.netlify/functions/cek-ongkir' };
