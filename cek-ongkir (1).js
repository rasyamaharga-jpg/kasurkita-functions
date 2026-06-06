// Netlify Function - Cek Ongkir Biteship
const rateLimitMap = new Map();

function isRateLimited(ip) {
  const now = Date.now(), window = 60000, max = 15;
  if (!rateLimitMap.has(ip)) { rateLimitMap.set(ip, { count: 1, start: now }); return false; }
  const d = rateLimitMap.get(ip);
  if (now - d.start > window) { rateLimitMap.set(ip, { count: 1, start: now }); return false; }
  if (d.count >= max) return true;
  d.count++; return false;
}

exports.handler = async function(event, context) {
  const headers = {
    'Access-Control-Allow-Origin' : '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'X-Content-Type-Options'      : 'nosniff'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'GET') return { statusCode: 405, headers, body: JSON.stringify({ status: 'error', message: 'Method not allowed' }) };

  const ip = event.headers['x-forwarded-for']?.split(',')[0] || 'unknown';
  if (isRateLimited(ip)) return { statusCode: 429, headers, body: JSON.stringify({ status: 'error', message: 'Terlalu banyak request.' }) };

  const { destinationAreaId, weight } = event.queryStringParameters || {};

  if (!destinationAreaId || !/^[a-zA-Z0-9_-]+$/.test(destinationAreaId) || destinationAreaId.length > 50) {
    return { statusCode: 400, headers, body: JSON.stringify({ status: 'error', message: 'destinationAreaId tidak valid' }) };
  }

  const weightNum = parseInt(weight);
  if (isNaN(weightNum) || weightNum < 100 || weightNum > 50000) {
    return { statusCode: 400, headers, body: JSON.stringify({ status: 'error', message: 'Berat tidak valid' }) };
  }

  if (!process.env.BITESHIP_API_KEY || !process.env.ORIGIN_AREA_ID) {
    return { statusCode: 500, headers, body: JSON.stringify({ status: 'error', message: 'Konfigurasi server bermasalah' }) };
  }

  try {
    const response = await fetch('https://api.biteship.com/v1/rates/couriers', {
      method : 'POST',
      headers: { 'Authorization': process.env.BITESHIP_API_KEY, 'Content-Type': 'application/json' },
      body   : JSON.stringify({
        origin_area_id     : process.env.ORIGIN_AREA_ID,
        destination_area_id: destinationAreaId,
        couriers           : 'jnt,wahana,idexpress',
        items: [{ name: 'Sprei KasurKita', value: 100000, weight: weightNum, quantity: 1 }]
      })
    });

    if (!response.ok) return { statusCode: 502, headers, body: JSON.stringify({ status: 'error', message: 'Layanan pengiriman sedang gangguan.' }) };

    const data = await response.json();
    if (!data.success) return { statusCode: 400, headers, body: JSON.stringify({ status: 'error', message: 'Tidak ada kurir tersedia' }) };

    const couriers = (data.pricing || []).map(c => ({
      courier_code        : c.courier_code,
      courier_service_code: c.courier_service_code,
      courier_name        : c.courier_name,
      courier_service_name: c.courier_service_name,
      price               : c.price,
      duration            : c.duration || '-'
    }));

    return { statusCode: 200, headers, body: JSON.stringify({ status: 'success', couriers }) };

  } catch (err) {
    console.error('[cek-ongkir]', err.message);
    return { statusCode: 500, headers, body: JSON.stringify({ status: 'error', message: 'Terjadi kesalahan, coba lagi.' }) };
  }
};
