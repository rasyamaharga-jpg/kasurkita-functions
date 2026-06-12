// api/cek-ongkir.js
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ status: 'error', message: 'Method not allowed' });

  const destId = req.query.destinationAreaId;
  const weight = parseInt(req.query.weight);
  const originId = req.query.originAreaId || process.env.ORIGIN_AREA_ID;

  if (!destId || !/^[a-zA-Z0-9_-]+$/.test(destId) || destId.length > 50) {
    return res.status(400).json({ status: 'error', message: 'destinationAreaId tidak valid' });
  }
  if (isNaN(weight) || weight < 100 || weight > 50000) {
    return res.status(400).json({ status: 'error', message: 'Berat tidak valid (100-50000 gram)' });
  }
  if (!originId) {
    return res.status(400).json({ status: 'error', message: 'ORIGIN_AREA_ID tidak diset. Tambahkan di environment variables Vercel atau kirim parameter originAreaId.' });
  }

  const apiKey = process.env.BITESHIP_API_KEY;
  if (!apiKey) return res.status(500).json({ status: 'error', message: 'BITESHIP_API_KEY tidak diset' });

  try {
    // Buat payload dengan postal code 0 (fallback untuk mengatasi error "invalid postal code")
    const payload = {
      origin_area_id: originId,
      destination_area_id: destId,
      couriers: 'jnt,wahana,idexpress',
      items: [{ name: 'Sprei KasurKita', value: 100000, weight, quantity: 1 }],
      origin_postal_code: 0,
      destination_postal_code: 0
    };

    const response = await fetch('https://api.biteship.com/v1/rates/couriers', {
      method: 'POST',
      headers: { Authorization: apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      console.error('[cek-ongkir] Biteship error:', data);
      // Jika error masih terkait postal code, beri tahu pengguna untuk menghubungi Biteship
      if (data.error && (data.error.includes('postal') || data.error.includes('invalid'))) {
        return res.status(400).json({
          status: 'error',
          message: 'Area ID yang digunakan tidak memiliki kode pos yang valid. Coba area ID lain atau hubungi support Biteship.',
          detail: data.error
        });
      }
      return res.status(400).json({ status: 'error', message: data.error || 'Tidak ada kurir tersedia' });
    }

    const couriers = data.pricing.map(c => ({
      courier_code: c.courier_code,
      courier_service_code: c.courier_service_code,
      courier_name: c.courier_name,
      courier_service_name: c.courier_service_name,
      price: c.price,
      duration: c.duration || '-'
    }));
    return res.status(200).json({ status: 'success', couriers });
  } catch (err) {
    console.error('[cek-ongkir]', err.message);
    return res.status(500).json({ status: 'error', message: err.message });
  }
}
