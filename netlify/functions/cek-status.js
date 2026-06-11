// Netlify Function - Cek Status Pesanan
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

exports.handler = async function(event) {
  const headers = {
    'Access-Control-Allow-Origin' : '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  const idPesanan = event.queryStringParameters?.idPesanan;
  if (!idPesanan) return { statusCode: 400, headers, body: JSON.stringify({ status: 'error', message: 'idPesanan wajib diisi' }) };

  try {
    const res  = await fetch(
      `${SUPABASE_URL}/rest/v1/pesanan?id_pesanan=eq.${encodeURIComponent(idPesanan)}&select=*`,
      { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
    );
    const data = await res.json();

    if (!data.length) return { statusCode: 404, headers, body: JSON.stringify({ status: 'error', message: `Pesanan '${idPesanan}' tidak ditemukan` }) };

    const p = data[0];
    return { statusCode: 200, headers, body: JSON.stringify({
      status        : 'success',
      idPesanan     : p.id_pesanan,
      tanggal       : p.tanggal,
      nama          : p.nama_pembeli,
      idVarian      : p.id_varian,
      idMotif       : p.id_motif,
      jumlah        : p.jumlah_beli,
      totalHarga    : p.total_harga,
      kotaTujuan    : p.kota_tujuan,
      statusPesanan : p.status,
      noResi        : p.no_resi || '',
      kurir         : p.kurir || ''
    })};

  } catch (err) {
    console.error('[cek-status]', err.message);
    return { statusCode: 500, headers, body: JSON.stringify({ status: 'error', message: 'Gagal cek status' }) };
  }
};
