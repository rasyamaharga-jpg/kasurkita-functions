// Netlify Function - Cari Area Biteship
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

exports.handler = async function(event, context) {
  const headers = {
    'Access-Control-Allow-Origin' : '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'X-Content-Type-Options'      : 'nosniff',
    'X-Frame-Options'             : 'DENY'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'GET') return { statusCode: 405, headers, body: JSON.stringify({ status: 'error', message: 'Method not allowed' }) };

  const ip = event.headers['x-forwarded-for']?.split(',')[0] || 'unknown';
  if (isRateLimited(ip)) return { statusCode: 429, headers, body: JSON.stringify({ status: 'error', message: 'Terlalu banyak request, coba lagi.' }) };

  const keyword = sanitize(event.queryStringParameters?.keyword || '');
  if (!keyword || keyword.length < 3) return { statusCode: 400, headers, body: JSON.stringify({ status: 'error', message: 'Keyword minimal 3 karakter' }) };

  if (!process.env.BITESHIP_API_KEY) return { statusCode: 500, headers, body: JSON.stringify({ status: 'error', message: 'Konfigurasi server bermasalah' }) };

  try {
    const response = await fetch(
      `https://api.biteship.com/v1/maps/areas?countries=ID&input=${encodeURIComponent(keyword)}&type=single`,
      { headers: { 'Authorization': process.env.BITESHIP_API_KEY, 'Content-Type': 'application/json' } }
    );

    if (!response.ok) return { statusCode: 502, headers, body: JSON.stringify({ status: 'error', message: 'Layanan pengiriman sedang gangguan.' }) };

    const data = await response.json();
    if (!data.success) return { statusCode: 400, headers, body: JSON.stringify({ status: 'error', message: 'Area tidak ditemukan' }) };

    const areas = (data.areas || []).slice(0, 5).map(a => ({
      id  : a.id,
      name: a.name,
      administrative_division_level_1_name: a.administrative_division_level_1_name,
      administrative_division_level_2_name: a.administrative_division_level_2_name,
    }));

    return { statusCode: 200, headers, body: JSON.stringify({ status: 'success', areas }) };

  } catch (err) {
    console.error('[cari-area]', err.message);
    return { statusCode: 500, headers, body: JSON.stringify({ status: 'error', message: 'Terjadi kesalahan, coba lagi.' }) };
  }
};
