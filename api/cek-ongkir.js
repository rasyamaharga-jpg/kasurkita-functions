// Vercel Function - Cek Ongkir
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ status: 'error', message: 'Method not allowed' });

  const { destinationAreaId, weight } = req.query;
  if (!destinationAreaId || !/^[a-zA-Z0-9_-]+$/.test(destinationAreaId) || destinationAreaId.length > 50) {
    return res.status(400).json({ status: 'error', message: 'destinationAreaId tidak valid' });
  }
  const weightNum = parseInt(weight);
  if (isNaN(weightNum) || weightNum < 100 || weightNum > 50000) {
    return res.status(400).json({ status: 'error', message: 'Berat tidak valid' });
  }
  if (!process.env.BITESHIP_API_KEY || !process.env.ORIGIN_AREA_ID) {
    return res.status(500).json({ status: 'error', message: 'Konfigurasi server bermasalah' });
  }

  try {
    const response = await fetch('https://api.biteship.com/v1/rates/couriers', {
      method: 'POST',
      headers: { 'Authorization': process.env.BITESHIP_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        origin_area_id: process.env.ORIGIN_AREA_ID,
        destination_area_id: destinationAreaId,
        couriers: 'jnt,wahana,idexpress',
        items: [{ name: 'Sprei KasurKita', value: 100000, weight: weightNum, quantity: 1 }]
      }),
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) {
      const errText = await response.text();
      console.error('[cek-ongkir] HTTP', response.status, errText);
      return res.status(502).json({ status: 'error', message: 'Layanan pengiriman sedang gangguan', debug: errText });
    }
    const data = await response.json();
    if (!data.success) {
      return res.status(400).json({ status: 'error', message: 'Tidak ada kurir tersedia', debug: data });
    }
    const couriers = (data.pricing || []).map(c => ({
      courier_code: c.courier_code,
      courier_service_code: c.courier_service_code,
      courier_name: c.courier_name,
      courier_service_name: c.courier_service_name,
      price: c.price,
      duration: c.duration || '-'
    }));
    res.status(200).json({ status: 'success', couriers });
  } catch (err) {
    console.error('[cek-ongkir]', err.message);
    res.status(500).json({ status: 'error', message: err.name === 'TimeoutError' ? 'Request timeout' : 'Terjadi kesalahan' });
  }
}
