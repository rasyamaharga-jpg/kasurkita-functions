// Netlify Function - Buat Pesanan Baru
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
const GAS_URL      = process.env.GAS_URL; // untuk sync ke Sheets

function generateOrderId() {
  const now    = new Date();
  const tgl    = now.toISOString().slice(0,10).replace(/-/g,'');
  const random = Math.floor(Math.random() * 9000) + 1000;
  return `ORD-${tgl}-${random}`;
}

exports.handler = async function(event) {
  const headers = {
    'Access-Control-Allow-Origin' : '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ status: 'error', message: 'Method not allowed' }) };

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ status: 'error', message: 'Body tidak valid' }) }; }

  const { idVarian, idMotif, namaPembeli, noWhatsApp, alamat, kotaTujuan, jumlahBeli } = body;

  if (!idVarian || !idMotif || !namaPembeli || !noWhatsApp || !alamat || !kotaTujuan || !jumlahBeli) {
    return { statusCode: 400, headers, body: JSON.stringify({ status: 'error', message: 'Data tidak lengkap' }) };
  }

  try {
    // Cek stok & harga dari Supabase
    const resProduk = await fetch(
      `${SUPABASE_URL}/rest/v1/produk?id_varian=eq.${idVarian}&aktif=eq.true&select=harga,stok,berat_gram`,
      { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
    );
    const produkArr = await resProduk.json();
    if (!produkArr.length) return { statusCode: 400, headers, body: JSON.stringify({ status: 'error', message: `Varian '${idVarian}' tidak ditemukan` }) };

    const produk = produkArr[0];
    const jumlah = parseInt(jumlahBeli);
    if (produk.stok < jumlah) return { statusCode: 400, headers, body: JSON.stringify({ status: 'error', message: `Stok hanya ${produk.stok} pcs` }) };

    const totalHarga = produk.harga * jumlah;
    const idPesanan  = generateOrderId();

    // Simpan pesanan ke Supabase
    const resSimpan = await fetch(`${SUPABASE_URL}/rest/v1/pesanan`, {
      method : 'POST',
      headers: {
        'apikey'      : SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer'      : 'return=minimal'
      },
      body: JSON.stringify({
        id_pesanan  : idPesanan,
        nama_pembeli: namaPembeli,
        no_whatsapp : noWhatsApp,
        id_varian   : idVarian,
        id_motif    : idMotif,
        jumlah_beli : jumlah,
        total_harga : totalHarga,
        alamat,
        kota_tujuan : kotaTujuan,
        status      : 'Menunggu Pembayaran'
      })
    });

    if (!resSimpan.ok) throw new Error('Gagal simpan pesanan');

    // Kurangi stok
    await fetch(`${SUPABASE_URL}/rest/v1/produk?id_varian=eq.${idVarian}`, {
      method : 'PATCH',
      headers: {
        'apikey'      : SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ stok: produk.stok - jumlah })
    });

    // Sync ke Google Sheets (fire and forget)
    if (GAS_URL) {
      fetch(GAS_URL, {
        method : 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body   : JSON.stringify({
          action      : 'syncPesanan',
          idPesanan, namaPembeli, noWhatsApp,
          idVarian, idMotif, jumlahBeli: jumlah,
          totalHarga, alamat, kotaTujuan
        })
      }).catch(e => console.error('Sync GAS gagal:', e.message));
    }

    return { statusCode: 200, headers, body: JSON.stringify({ status: 'success', idPesanan, totalHarga }) };

  } catch (err) {
    console.error('[pesan]', err.message);
    return { statusCode: 500, headers, body: JSON.stringify({ status: 'error', message: 'Gagal memproses pesanan' }) };
  }
};
