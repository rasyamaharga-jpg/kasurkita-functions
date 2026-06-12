// api/katalog.js
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ status: 'error', message: 'Method not allowed' });

  // Ambil URL dan bersihkan: hilangkan /rest/v1/ jika ada di akhir
  let supabaseUrl = process.env.SUPABASE_URL || '';
  supabaseUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, '');
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ status: 'error', message: 'Env tidak lengkap' });
  }

  try {
    // Panggil endpoint yang benar
    const produkRes = await fetch(`${supabaseUrl}/rest/v1/produk`, {
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
    });
    const produkData = await produkRes.json();
    if (!Array.isArray(produkData)) throw new Error(JSON.stringify(produkData));

    const motifRes = await fetch(`${supabaseUrl}/rest/v1/motif`, {
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
    });
    const motifData = await motifRes.json();
    if (!Array.isArray(motifData)) throw new Error(JSON.stringify(motifData));

    return res.status(200).json({
      status: 'success',
      produk: produkData.map(p => ({
        id: p.id_varian,
        nama: p.nama_produk,
        lebar: p.lebar,
        tinggiKasur: p.tinggi_kasur,
        harga: p.harga,
        berat: p.berat_gram,
        stok: p.stok
      })),
      motif: motifData.map(m => ({
        id: m.id_motif,
        nama: m.nama_motif,
        fotoUrl: m.foto_url
      }))
    });
  } catch (err) {
    console.error('[katalog]', err.message);
    return res.status(500).json({ status: 'error', message: err.message });
  }
}
