// Netlify Function - Admin Panel (semua operasi admin)
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY; // pakai service key untuk admin
const ADMIN_PASS   = process.env.ADMIN_PASS;
const GAS_URL      = process.env.GAS_URL;

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

  // Verifikasi password
  if (!body.adminPass || body.adminPass !== ADMIN_PASS) {
    await new Promise(r => setTimeout(r, 1000));
    return { statusCode: 403, headers, body: JSON.stringify({ status: 'error', message: 'Akses ditolak' }) };
  }

  const { action } = body;

  try {

    // ===== VERIFY LOGIN =====
    if (action === 'verifyLogin') {
      return { statusCode: 200, headers, body: JSON.stringify({ status: 'success' }) };
    }

    // ===== GET ALL PESANAN =====
    if (action === 'getAllPesanan') {
      const res  = await fetch(
        `${SUPABASE_URL}/rest/v1/pesanan?select=*&order=tanggal.desc`,
        { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
      );
      const data = await res.json();
      const pesanan = data.map(p => ({
        idPesanan  : p.id_pesanan,
        tanggal    : p.tanggal,
        nama       : p.nama_pembeli,
        noWA       : p.no_whatsapp,
        idVarian   : p.id_varian,
        idMotif    : p.id_motif,
        jumlah     : p.jumlah_beli,
        totalHarga : p.total_harga,
        alamat     : p.alamat,
        kotaTujuan : p.kota_tujuan || '-',
        status     : p.status || 'Menunggu Pembayaran',
        noResi     : p.no_resi || '',
        kurir      : p.kurir || ''
      }));
      return { statusCode: 200, headers, body: JSON.stringify({ status: 'success', pesanan }) };
    }

    // ===== GET PRODUK ADMIN =====
    if (action === 'getProdukAdmin') {
      const res  = await fetch(
        `${SUPABASE_URL}/rest/v1/produk?select=*&order=lebar.asc,tinggi_kasur.asc`,
        { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
      );
      const data = await res.json();
      const produk = data.map(p => ({
        id    : p.id_varian,
        nama  : p.nama_produk,
        lebar : p.lebar,
        tinggi: p.tinggi_kasur,
        harga : p.harga,
        stok  : p.stok,
        aktif : p.aktif
      }));
      return { statusCode: 200, headers, body: JSON.stringify({ status: 'success', produk }) };
    }

    // ===== UPDATE STATUS =====
    if (action === 'updateStatus') {
      const { idPesanan, statusBaru } = body;
      const VALID = ['Menunggu Pembayaran','Pembayaran Dikonfirmasi','Diproses','Dikirim','Selesai'];
      if (!VALID.includes(statusBaru)) return { statusCode: 400, headers, body: JSON.stringify({ status: 'error', message: 'Status tidak valid' }) };

      await fetch(`${SUPABASE_URL}/rest/v1/pesanan?id_pesanan=eq.${idPesanan}`, {
        method : 'PATCH',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
        body   : JSON.stringify({ status: statusBaru })
      });

      // Sync ke Sheets
      if (GAS_URL) {
        fetch(GAS_URL, {
          method : 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body   : JSON.stringify({ action: 'syncUpdateStatus', idPesanan, statusBaru })
        }).catch(e => console.error('Sync GAS gagal:', e.message));
      }

      return { statusCode: 200, headers, body: JSON.stringify({ status: 'success', idPesanan, statusBaru }) };
    }

    // ===== UPDATE STOK =====
    if (action === 'updateStokAdmin') {
      const { idVarian, stokBaru } = body;
      await fetch(`${SUPABASE_URL}/rest/v1/produk?id_varian=eq.${idVarian}`, {
        method : 'PATCH',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
        body   : JSON.stringify({ stok: parseInt(stokBaru) })
      });
      return { statusCode: 200, headers, body: JSON.stringify({ status: 'success', idVarian, stokBaru }) };
    }

    // ===== SIMPAN RESI =====
    if (action === 'simpanResi') {
      const { idPesanan, noResi, kurir } = body;
      await fetch(`${SUPABASE_URL}/rest/v1/pesanan?id_pesanan=eq.${idPesanan}`, {
        method : 'PATCH',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
        body   : JSON.stringify({ no_resi: noResi, kurir, status: 'Dikirim' })
      });

      // Sync ke Sheets
      if (GAS_URL) {
        fetch(GAS_URL, {
          method : 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body   : JSON.stringify({ action: 'syncResi', idPesanan, noResi, kurir })
        }).catch(e => console.error('Sync GAS gagal:', e.message));
      }

      return { statusCode: 200, headers, body: JSON.stringify({ status: 'success', idPesanan, noResi, kurir }) };
    }

    return { statusCode: 400, headers, body: JSON.stringify({ status: 'error', message: 'Action tidak dikenal' }) };

  } catch (err) {
    console.error('[admin]', err.message);
    return { statusCode: 500, headers, body: JSON.stringify({ status: 'error', message: 'Terjadi kesalahan' }) };
  }
};
