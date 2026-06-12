// Netlify Function - Ambil Katalog (Produk + Motif) dari Supabase
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

exports.handler = async function(event) {
  const headers = {
    'Access-Control-Allow-Origin' : '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'GET') return { statusCode: 405, headers, body: JSON.stringify({ status: 'error', message: 'Method not allowed' }) };

  try {
    const [resProduk, resMotif] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/produk?aktif=eq.true&select=id_varian,nama_produk,lebar,tinggi_kasur,harga,berat_gram,stok`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      }),
      fetch(`${SUPABASE_URL}/rest/v1/motif?aktif=eq.true&select=id_motif,nama_motif,foto_url`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      })
    ]);

    const produk = await resProduk.json();
    const motif  = await resMotif.json();

    // Format sesuai yang diharapkan HTML
    const produkFormatted = produk.map(p => ({
      id         : p.id_varian,
      nama       : p.nama_produk,
      lebar      : p.lebar,
      tinggiKasur: p.tinggi_kasur,
      harga      : p.harga,
      berat      : p.berat_gram,
      stok       : p.stok
    }));

    const motifFormatted = motif.map(m => ({
      id     : m.id_motif,
      nama   : m.nama_motif,
      fotoUrl: m.foto_url
    }));

    return { statusCode: 200, headers, body: JSON.stringify({ status: 'success', produk: produkFormatted, motif: motifFormatted }) };

  } catch (err) {
    console.error('[katalog]', err.message);
    return { statusCode: 500, headers, body: JSON.stringify({ status: 'error', message: 'Gagal memuat katalog' }) };
  }
};
