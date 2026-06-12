// api/cari-area.js - Cari area ID dari Biteship
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ status: 'error', message: 'Method not allowed' });

  const keyword = req.query.keyword?.trim().slice(0,100);
  if (!keyword || keyword.length < 3) return res.status(400).json({ status: 'error', message: 'Keyword minimal 3 karakter' });

  const apiKey = process.env.BITESHIP_API_KEY;
  if (!apiKey) return res.status(500).json({ status: 'error', message: 'Konfigurasi server bermasalah' });

  try {
    const response = await fetch(`https://api.biteship.com/v1/maps/areas?countries=ID&input=${encodeURIComponent(keyword)}&type=single`, { headers: { Authorization: apiKey, 'Content-Type': 'application/json' } });
    const data = await response.json();
    if (!data.success) return res.status(400).json({ status: 'error', message: 'Area tidak ditemukan' });
    const areas = (data.areas || []).slice(0,5).map(a => ({ id: a.id, name: a.name, administrative_division_level_1_name: a.administrative_division_level_1_name, administrative_division_level_2_name: a.administrative_division_level_2_name }));
    return res.status(200).json({ status: 'success', areas });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
}
