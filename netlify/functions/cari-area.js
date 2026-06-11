// Netlify Function - Cari Area Biteship (Format Baru)
const rateLimitMap = new Map();

function isRateLimited(ip) {
  const now = Date.now(), window = 60000, max = 20;
  if (!rateLimitMap.has(ip)) {
    rateLimitMap.set(ip, { count: 1, start: now });
    return false;
  }
  const d = rateLimitMap.get(ip);
  if (now - d.start > window) {
    rateLimitMap.set(ip, { count: 1, start: now });
    return false;
  }
  if (d.count >= max) return true;
  d.count++;
  return false;
}

function sanitize(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[<>'"`;]/g, '').trim().slice(0, 100);
}

export default async (req, context) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('', {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
  }

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY'
  };

  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ status: 'error', message: 'Method not allowed' }), { status: 405, headers });
  }

  // Rate limiting berdasarkan IP
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
  if (isRateLimited(ip)) {
    return new Response(JSON.stringify({ status: 'error', message: 'Terlalu banyak request, coba lagi.' }), { status: 429, headers });
  }

  const url = new URL(req.url);
  const keyword = sanitize(url.searchParams.get('keyword') || '');
  if (!keyword || keyword.length < 3) {
    return new Response(JSON.stringify({ status: 'error', message: 'Keyword minimal 3 karakter' }), { status: 400, headers });
  }

  if (!process.env.BITESHIP_API_KEY) {
    return new Response(JSON.stringify({ status: 'error', message: 'Konfigurasi server bermasalah' }), { status: 500, headers });
  }

  try {
    const response = await fetch(
      `https://api.biteship.com/v1/maps/areas?countries=ID&input=${encodeURIComponent(keyword)}&type=single`,
      {
        headers: {
          'Authorization': process.env.BITESHIP_API_KEY,
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(8000)
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error('[cari-area] HTTP', response.status, errText);
      return new Response(JSON.stringify({ status: 'error', message: 'Layanan pengiriman sedang gangguan.' }), { status: 502, headers });
    }

    const data = await response.json();
    if (!data.success) {
      return new Response(JSON.stringify({ status: 'error', message: 'Area tidak ditemukan' }), { status: 400, headers });
    }

    const areas = (data.areas || []).slice(0, 5).map(a => ({
      id: a.id,
      name: a.name,
      administrative_division_level_1_name: a.administrative_division_level_1_name,
      administrative_division_level_2_name: a.administrative_division_level_2_name,
    }));

    return new Response(JSON.stringify({ status: 'success', areas }), { status: 200, headers });

  } catch (err) {
    console.error('[cari-area]', err.message);
    const errorMessage = err.name === 'TimeoutError' ? 'Request timeout.' : 'Terjadi kesalahan, coba lagi.';
    return new Response(JSON.stringify({ status: 'error', message: errorMessage }), { status: 500, headers });
  }
};

export const config = { path: '/.netlify/functions/cari-area' };
