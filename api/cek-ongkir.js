// api/cek-ongkir.js - Cek ongkir via Biteship
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ status: 'error', message: 'Method not allowed' });

  const destId = req.query.destinationAreaId;
  const weight = parseInt(req.query.weight);
  if (!destId || !/^[a-zA-Z0-9_-]+$/.test(destId) || destId.length > 50) return res.status(400).json({ status: 'error', message: 'destinationAreaId tidak valid' });
  if (isNaN(weight) || weight < 100 || weight > 50000) return res.status(400).json({ status: 'error', message: 'Berat tidak valid' });

  const apiKey = process.env.BITESHIP_API_KEY;
  const originId = process.env.ORIGIN_AREA_ID;
  if (!apiKey || !originId) return res.status(500).json({ status: 'error', message: 'Konfigurasi server bermasalah' });

  try {
    const response = await fetch('https://api.biteship.com/v1/rates/couriers', {
      method: 'POST',
      headers: { Authorization: apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ origin_area_id: originId, destination_area_id: destId, couriers: 'jnt,wahana,idexpress', items: [{ name: 'Sprei KasurKita', value: 100000, weight, quantity: 1 }] })
    });
    const data = await response.json();
    if (!data.success) return res.status(400).json({ status: 'error', message: 'Tidak ada kurir tersedia' });
    const couriers = data.pricing.map(c => ({ courier_code: c.courier_code, courier_service_code: c.courier_service_code, courier_name: c.courier_name, courier_service_name: c.courier_service_name, price: c.price, duration: c.duration || '-' }));
    return res.status(200).json({ status: 'success', couriers });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
}
