// Netlify Function - Admin Panel (format baru)
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY; // service key untuk admin
const ADMIN_PASS = process.env.ADMIN_PASS;
const GAS_URL = process.env.GAS_URL;

export default async (req, context) => {
  if (req.method === 'OPTIONS') {
    return new Response('', {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ status: 'error', message: 'Method not allowed' }), { status: 405, headers });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ status: 'error', message: 'Body tidak valid' }), { status: 400, headers });
  }

  // Verifikasi password
  if (!body.adminPass || body.adminPass !== ADMIN_PASS) {
    await new Promise((r) => setTimeout(r, 1000));
    return new Response(JSON.stringify({ status: 'error', message: 'Akses ditolak' }), { status: 403, headers });
  }

  const { action } = body;

  try {
    // ===== VERIFY LOGIN =====
    if (action === 'verifyLogin') {
      return new Response(JSON.stringify({ status: 'success' }), { status: 200, headers });
    }

    // ===== GET ALL PESANAN =====
    if (action === 'getAllPesanan') {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/pesanan?select=*&order=tanggal.desc`,
        { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
      );
      const data = await res.json();
      const pesanan = data.map((p) => ({
        idPesanan: p.id_pesanan,
        tanggal: p.tanggal,
        nama: p.nama_pembeli,
        noWA: p.no_whatsapp,
        idVarian: p.id_varian,
        idMotif: p.id_motif,
        jumlah: p.jumlah_beli,
        totalHarga: p.total_harga,
        alamat: p.alamat,
        kotaTujuan: p.kota_tujuan || '-',
        status: p.status || 'Menunggu Pembayaran',
        noResi: p.no_resi || '',
        kurir: p.kurir || '',
      }));
      return new Response(JSON.stringify({ status: 'success', pesanan }), { status: 200, headers });
    }

    // ===== GET PRODUK ADMIN =====
    if (action === 'getProdukAdmin') {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/produk?select=*&order=lebar.asc,tinggi_kasur.asc`,
        { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
      );
      const data = await res.json();
      const produk = data.map((p) => ({
        id: p.id_varian,
        nama: p.nama_produk,
        lebar: p.lebar,
        tinggi: p.tinggi_kasur,
        harga: p.harga,
        stok: p.stok,
        aktif: p.aktif,
      }));
      return new Response(JSON.stringify({ status: 'success', produk }), { status: 200, headers });
    }

    // ===== UPDATE STATUS =====
    if (action === 'updateStatus') {
      const { idPesanan, statusBaru } = body;
      const VALID = ['Menunggu Pembayaran', 'Pembayaran Dikonfirmasi', 'Diproses', 'Dikirim', 'Selesai'];
      if (!VALID.includes(statusBaru)) {
        return new Response(JSON.stringify({ status: 'error', message: 'Status tidak valid' }), { status: 400, headers });
      }

      await fetch(`${SUPABASE_URL}/rest/v1/pesanan?id_pesanan=eq.${idPesanan}`, {
        method: 'PATCH',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: statusBaru }),
      });

      if (GAS_URL) {
        fetch(GAS_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify({ action: 'syncUpdateStatus', idPesanan, statusBaru }),
        }).catch((e) => console.error('Sync GAS gagal:', e.message));
      }

      return new Response(JSON.stringify({ status: 'success', idPesanan, statusBaru }), { status: 200, headers });
    }

    // ===== UPDATE STOK =====
    if (action === 'updateStokAdmin') {
      const { idVarian, stokBaru } = body;
      await fetch(`${SUPABASE_URL}/rest/v1/produk?id_varian=eq.${idVarian}`, {
        method: 'PATCH',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ stok: parseInt(stokBaru) }),
      });
      return new Response(JSON.stringify({ status: 'success', idVarian, stokBaru }), { status: 200, headers });
    }

    // ===== SIMPAN RESI =====
    if (action === 'simpanResi') {
      const { idPesanan, noResi, kurir } = body;
      await fetch(`${SUPABASE_URL}/rest/v1/pesanan?id_pesanan=eq.${idPesanan}`, {
        method: 'PATCH',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ no_resi: noResi, kurir, status: 'Dikirim' }),
      });

      if (GAS_URL) {
        fetch(GAS_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify({ action: 'syncResi', idPesanan, noResi, kurir }),
        }).catch((e) => console.error('Sync GAS gagal:', e.message));
      }

      return new Response(JSON.stringify({ status: 'success', idPesanan, noResi, kurir }), { status: 200, headers });
    }

    return new Response(JSON.stringify({ status: 'error', message: 'Action tidak dikenal' }), { status: 400, headers });
  } catch (err) {
    console.error('[admin]', err.message);
    return new Response(JSON.stringify({ status: 'error', message: 'Terjadi kesalahan' }), { status: 500, headers });
  }
};

export const config = { path: '/.netlify/functions/admin' };
