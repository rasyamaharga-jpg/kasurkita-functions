// Vercel Function - Katalog
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  if (req.method !== 'GET') {
    return res.status(405).json({ status: 'error', message: 'Method not allowed' });
  }

  try {
    const [resProduk, resMotif] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/produk?aktif=eq.true&select=id_varian,nama_produk,lebar,tinggi_kasur,harga,berat_gram,stok`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
      }),
      fetch(`${SUPABASE_URL}/rest/v1/motif?aktif=eq.true&select=id_motif,nama_motif,foto_url`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
      })
    ]);

    const produk = await resProduk.json();
    const motif = await resMotif.json();

    const produkFormatted = produk.map(p => ({
      id: p.id_varian,
      nama: p.nama_produk,
      lebar: p.lebar,
      tinggiKasur: p.tinggi_kasur,
      harga: p.harga,
      berat: p.berat_gram,
      stok: p.stok
    }));

    const motifFormatted = motif.map(m => ({
      id: m.id_motif,
      nama: m.nama_motif,
      fotoUrl: m.foto_url
    }));

    res.status(200).json({ status: 'success', produk: produkFormatted, motif: motifFormatted });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: 'Gagal memuat katalog' });
  }
}
