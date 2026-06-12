// api/admin.js - Final dengan stok per motif
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
const ADMIN_PASS = process.env.ADMIN_PASS;
const GAS_URL = process.env.GAS_URL;

const cleanUrl = SUPABASE_URL.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ status: 'error', message: 'Method not allowed' });

  // Parsing body (handle berbagai kemungkinan)
  let body = req.body;
  if (!body || typeof body !== 'object') {
    try {
      body = JSON.parse(req.body);
    } catch (e) {
      return res.status(400).json({ status: 'error', message: 'Body tidak valid JSON: ' + e.message });
    }
  }

  // Validasi password
  if (!body.adminPass || body.adminPass !== ADMIN_PASS) {
    await new Promise(r => setTimeout(r, 1000));
    return res.status(403).json({ status: 'error', message: 'Akses ditolak' });
  }

  const { action } = body;

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
        idPesanan: p.id_pesanan, tanggal: p.tanggal, nama: p.nama_pembeli, noWA: p.no_whatsapp,
        idVarian: p.id_varian, idMotif: p.id_motif, jumlah: p.jumlah_beli, totalHarga: p.total_harga,
        alamat: p.alamat, kotaTujuan: p.kota_tujuan || '-', status: p.status || 'Menunggu Pembayaran',
        noResi: p.no_resi || '', kurir: p.kurir || ''
      }));
      return res.status(200).json({ status: 'success', pesanan });
    }

    // ===== GET PRODUK ADMIN (cara lama, tanpa motif) =====
    if (action === 'getProdukAdmin') {
      const r = await fetch(`${cleanUrl}/rest/v1/produk?select=*&order=lebar.asc,tinggi_kasur.asc`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
      });
      const data = await r.json();
      const produk = data.map(p => ({
        id: p.id_varian, nama: p.nama_produk, lebar: p.lebar, tinggi: p.tinggi_kasur,
        harga: p.harga, stok: p.stok, aktif: p.aktif
      }));
      return res.status(200).json({ status: 'success', produk });
    }

    // ===== GET PRODUK DAN MOTIF (untuk matriks stok) =====
    if (action === 'getProdukDanMotif') {
      const [produkRes, motifRes] = await Promise.all([
        fetch(`${cleanUrl}/rest/v1/produk?select=id_varian,nama_produk,lebar,tinggi_kasur,harga&aktif=eq.true&order=lebar.asc,tinggi_kasur.asc`, {
          headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
        }),
        fetch(`${cleanUrl}/rest/v1/motif?select=id_motif,nama_motif&aktif=eq.true`, {
          headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
        })
      ]);
      const produk = await produkRes.json();
      const motif = await motifRes.json();
      return res.status(200).json({ status: 'success', produk, motif });
    }

    // ===== GET STOK PER MOTIF =====
    if (action === 'getStokPerMotif') {
      const r = await fetch(`${cleanUrl}/rest/v1/stok_produk?select=id_varian,id_motif,stok`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
      });
      const stok = await r.json();
      return res.status(200).json({ status: 'success', stok });
    }

    // ===== UPDATE STOK PER MOTIF =====
    if (action === 'updateStokPerMotif') {
      const { idVarian, idMotif, stokBaru } = body;
      if (!idVarian || !idMotif || stokBaru === undefined) {
        return res.status(400).json({ status: 'error', message: 'idVarian, idMotif, stokBaru diperlukan' });
      }
      await fetch(`${cleanUrl}/rest/v1/stok_produk?id_varian=eq.${idVarian}&id_motif=eq.${idMotif}`, {
        method: 'PATCH',
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ stok: parseInt(stokBaru) })
      });
      return res.status(200).json({ status: 'success', idVarian, idMotif, stokBaru });
    }

    // ===== UPDATE STATUS PESANAN =====
    if (action === 'updateStatus') {
      const { idPesanan, statusBaru } = body;
      const valid = ['Menunggu Pembayaran','Pembayaran Dikonfirmasi','Diproses','Dikirim','Selesai'];
      if (!valid.includes(statusBaru)) return res.status(400).json({ status: 'error', message: 'Status tidak valid' });
      await fetch(`${cleanUrl}/rest/v1/pesanan?id_pesanan=eq.${idPesanan}`, {
        method: 'PATCH', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: statusBaru })
      });
      if (GAS_URL) {
        fetch(GAS_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ action: 'syncUpdateStatus', idPesanan, statusBaru }) })
          .catch(e => console.error('Sync GAS gagal:', e.message));
      }
      return res.status(200).json({ status: 'success', idPesanan, statusBaru });
    }

    // ===== UPDATE STOK (cara lama, produk) =====
    if (action === 'updateStokAdmin') {
      const { idVarian, stokBaru } = body;
      await fetch(`${cleanUrl}/rest/v1/produk?id_varian=eq.${idVarian}`, {
        method: 'PATCH', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ stok: parseInt(stokBaru) })
      });
      return res.status(200).json({ status: 'success', idVarian, stokBaru });
    }

    // ===== SIMPAN RESI =====
    if (action === 'simpanResi') {
      const { idPesanan, noResi, kurir } = body;
      await fetch(`${cleanUrl}/rest/v1/pesanan?id_pesanan=eq.${idPesanan}`, {
        method: 'PATCH', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ no_resi: noResi, kurir, status: 'Dikirim' })
      });
      if (GAS_URL) {
        fetch(GAS_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ action: 'syncResi', idPesanan, noResi, kurir }) })
          .catch(e => console.error('Sync GAS gagal:', e.message));
      }
      return res.status(200).json({ status: 'success', idPesanan, noResi, kurir });
    }

    return res.status(400).json({ status: 'error', message: 'Action tidak dikenal' });
  } catch (err) {
    console.error('[admin]', err.message);
    return res.status(500).json({ status: 'error', message: 'Terjadi kesalahan: ' + err.message });
  }
}
