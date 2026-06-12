// api/katalog.js - Ambil produk & motif dari Supabase
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ status: 'error', message: 'Method not allowed' });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(500).json({ status: 'error', message: 'Env tidak lengkap' });

  try {
    const [produkRes, motifRes] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/produk?aktif=eq.true&select=*`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }),
      fetch(`${SUPABASE_URL}/rest/v1/motif?aktif=eq.true&select=*`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } })
    ]);
    const produk = await produkRes.json();
    const motif = await motifRes.json();

    return res.status(200).json({
      status: 'success',
      produk: produk.map(p => ({ id: p.id_varian, nama: p.nama_produk, lebar: p.lebar, tinggiKasur: p.tinggi_kasur, harga: p.harga, berat: p.berat_gram, stok: p.stok })),
      motif: motif.map(m => ({ id: m.id_motif, nama: m.nama_motif, fotoUrl: m.foto_url }))
    });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
}
