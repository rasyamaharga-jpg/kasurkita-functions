// api/admin.js - versi GET dengan query parameter (tidak perlu body JSON)
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
const ADMIN_PASS = process.env.ADMIN_PASS;

const cleanUrl = SUPABASE_URL.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  // Hanya menerima GET (karena lebih mudah untuk testing)
  if (req.method !== 'GET') {
    return res.status(405).json({ status: 'error', message: 'Method not allowed, use GET' });
  }

  // Ambil parameter dari query string
  const { adminPass, action, idPesanan, statusBaru, idVarian, stokBaru, noResi, kurir } = req.query;

  if (!adminPass || adminPass !== ADMIN_PASS) {
    await new Promise(r => setTimeout(r, 1000));
    return res.status(403).json({ status: 'error', message: 'Akses ditolak' });
  }

  try {
    // ===== VERIFY LOGIN =====
    if (action === 'verifyLogin') {
      return res.status(200).json({ status: 'success' });
    }

    // ===== GET ALL PESANAN =====
    if (action === 'getAllPesanan') {
      const r = await fetch(`${cleanUrl}/rest/v1/pesanan?select=*&order=tanggal.desc`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
      });
      const data = await r.json();
      const pesanan = data.map(p => ({
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
        kurir: p.kurir || ''
      }));
      return res.status(200).json({ status: 'success', pesanan });
    }

    // ===== GET PRODUK ADMIN =====
    if (action === 'getProdukAdmin') {
      const r = await fetch(`${cleanUrl}/rest/v1/produk?select=*&order=lebar.asc,tinggi_kasur.asc`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
      });
      const data = await r.json();
      const produk = data.map(p => ({
        id: p.id_varian,
        nama: p.nama_produk,
        lebar: p.lebar,
        tinggi: p.tinggi_kasur,
        harga: p.harga,
        stok: p.stok,
        aktif: p.aktif
      }));
      return res.status(200).json({ status: 'success', produk });
    }

    // ===== UPDATE STATUS =====
    if (action === 'updateStatus') {
      const valid = ['Menunggu Pembayaran','Pembayaran Dikonfirmasi','Diproses','Dikirim','Selesai'];
      if (!idPesanan || !statusBaru || !valid.includes(statusBaru)) {
        return res.status(400).json({ status: 'error', message: 'Parameter idPesanan dan statusBaru diperlukan, status valid' });
      }
      await fetch(`${cleanUrl}/rest/v1/pesanan?id_pesanan=eq.${idPesanan}`, {
        method: 'PATCH',
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: statusBaru })
      });
      return res.status(200).json({ status: 'success', idPesanan, statusBaru });
    }

    // ===== UPDATE STOK =====
    if (action === 'updateStokAdmin') {
      if (!idVarian || stokBaru === undefined) {
        return res.status(400).json({ status: 'error', message: 'Parameter idVarian dan stokBaru diperlukan' });
      }
      await fetch(`${cleanUrl}/rest/v1/produk?id_varian=eq.${idVarian}`, {
        method: 'PATCH',
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ stok: parseInt(stokBaru) })
      });
      return res.status(200).json({ status: 'success', idVarian, stokBaru });
    }

    // ===== SIMPAN RESI =====
    if (action === 'simpanResi') {
      if (!idPesanan || !noResi || !kurir) {
        return res.status(400).json({ status: 'error', message: 'Parameter idPesanan, noResi, kurir diperlukan' });
      }
      await fetch(`${cleanUrl}/rest/v1/pesanan?id_pesanan=eq.${idPesanan}`, {
        method: 'PATCH',
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ no_resi: noResi, kurir, status: 'Dikirim' })
      });
      return res.status(200).json({ status: 'success', idPesanan, noResi, kurir });
    }

    return res.status(400).json({ status: 'error', message: `Action '${action}' tidak dikenal` });
  } catch (err) {
    console.error('[admin]', err.message);
    return res.status(500).json({ status: 'error', message: 'Terjadi kesalahan: ' + err.message });
  }
}
