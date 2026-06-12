// Netlify Function - Ambil Katalog (Produk + Motif) dari Supabase (format baru)
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

export default async (req, context) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('', {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ status: 'error', message: 'Method not allowed' }), { status: 405, headers });
  }

  try {
    const [resProduk, resMotif] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/produk?aktif=eq.true&select=id_varian,nama_produk,lebar,tinggi_kasur,harga,berat_gram,stok`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
      }),
      fetch(`${SUPABASE_URL}/rest/v1/motif?aktif=eq.true&select=id_motif,nama_motif,foto_url`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
      }),
    ]);

    const produk = await resProduk.json();
    const motif = await resMotif.json();

    const produkFormatted = produk.map((p) => ({
      id: p.id_varian,
      nama: p.nama_produk,
      lebar: p.lebar,
      tinggiKasur: p.tinggi_kasur,
      harga: p.harga,
      berat: p.berat_gram,
      stok: p.stok,
    }));

    const motifFormatted = motif.map((m) => ({
      id: m.id_motif,
      nama: m.nama_motif,
      fotoUrl: m.foto_url,
    }));

    return new Response(JSON.stringify({ status: 'success', produk: produkFormatted, motif: motifFormatted }), { status: 200, headers });
  } catch (err) {
    console.error('[katalog]', err.message);
    return new Response(JSON.stringify({ status: 'error', message: 'Gagal memuat katalog' }), { status: 500, headers });
  }
};

export const config = { path: '/.netlify/functions/katalog' };
