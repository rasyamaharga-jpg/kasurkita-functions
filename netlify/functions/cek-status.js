// Netlify Function - Cek Status Pesanan (format baru)
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

export default async (req, context) => {
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

  const url = new URL(req.url);
  const idPesanan = url.searchParams.get('idPesanan');
  if (!idPesanan) {
    return new Response(JSON.stringify({ status: 'error', message: 'idPesanan wajib diisi' }), { status: 400, headers });
  }

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/pesanan?id_pesanan=eq.${encodeURIComponent(idPesanan)}&select=*`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    );
    const data = await res.json();

    if (!data.length) {
      return new Response(JSON.stringify({ status: 'error', message: `Pesanan '${idPesanan}' tidak ditemukan` }), { status: 404, headers });
    }

    const p = data[0];
    return new Response(
      JSON.stringify({
        status: 'success',
        idPesanan: p.id_pesanan,
        tanggal: p.tanggal,
        nama: p.nama_pembeli,
        idVarian: p.id_varian,
        idMotif: p.id_motif,
        jumlah: p.jumlah_beli,
        totalHarga: p.total_harga,
        kotaTujuan: p.kota_tujuan,
        statusPesanan: p.status,
        noResi: p.no_resi || '',
        kurir: p.kurir || '',
      }),
      { status: 200, headers }
    );
  } catch (err) {
    console.error('[cek-status]', err.message);
    return new Response(JSON.stringify({ status: 'error', message: 'Gagal cek status' }), { status: 500, headers });
  }
};

export const config = { path: '/.netlify/functions/cek-status' };
