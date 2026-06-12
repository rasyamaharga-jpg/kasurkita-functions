// Netlify Function - Katalog Debug
export default async (req, context) => {
  if (req.method === 'OPTIONS') {
    return new Response('', { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
  }
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ status: 'error', message: 'Method not allowed' }), { status: 405, headers });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

  // Cek environment variables
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return new Response(JSON.stringify({
      status: 'error',
      message: 'Environment variables tidak lengkap',
      hasUrl: !!SUPABASE_URL,
      hasKey: !!SUPABASE_KEY
    }), { status: 500, headers });
  }

  try {
    const [resProduk, resMotif] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/produk?aktif=eq.true&select=*`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      }),
      fetch(`${SUPABASE_URL}/rest/v1/motif?aktif=eq.true&select=*`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      })
    ]);

    const produkData = await resProduk.json();
    const motifData = await resMotif.json();

    // Jika response bukan array, kemungkinan error dari Supabase
    if (!Array.isArray(produkData)) {
      return new Response(JSON.stringify({
        status: 'error',
        message: 'Gagal fetch produk',
        detail: produkData
      }), { status: 500, headers });
    }

    const produkFormatted = produkData.map(p => ({
      id: p.id_varian,
      nama: p.nama_produk,
      lebar: p.lebar,
      tinggiKasur: p.tinggi_kasur,
      harga: p.harga,
      berat: p.berat_gram,
      stok: p.stok
    }));

    const motifFormatted = motifData.map(m => ({
      id: m.id_motif,
      nama: m.nama_motif,
      fotoUrl: m.foto_url
    }));

    return new Response(JSON.stringify({
      status: 'success',
      produk: produkFormatted,
      motif: motifFormatted,
      debug: { produkCount: produkFormatted.length, motifCount: motifFormatted.length }
    }), { status: 200, headers });

  } catch (err) {
    console.error('[katalog]', err.message);
    return new Response(JSON.stringify({ status: 'error', message: err.message }), { status: 500, headers });
  }
};

export const config = { path: '/.netlify/functions/katalog' };
