// api/admin.js - Admin panel (POST)
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ status: 'error', message: 'Method not allowed' });

  const { adminPass, action, idPesanan, statusBaru, idVarian, stokBaru, noResi, kurir } = req.body;
  if (adminPass !== process.env.ADMIN_PASS) {
    await new Promise(r => setTimeout(r, 1000));
    return res.status(403).json({ status: 'error', message: 'Akses ditolak' });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

  try {
    if (action === 'verifyLogin') return res.status(200).json({ status: 'success' });

    if (action === 'getAllPesanan') {
      const result = await fetch(`${SUPABASE_URL}/rest/v1/pesanan?select=*&order=tanggal.desc`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
      const data = await result.json();
      return res.status(200).json({ status: 'success', pesanan: data.map(p => ({ idPesanan: p.id_pesanan, tanggal: p.tanggal, nama: p.nama_pembeli, noWA: p.no_whatsapp, idVarian: p.id_varian, idMotif: p.id_motif, jumlah: p.jumlah_beli, totalHarga: p.total_harga, alamat: p.alamat, kotaTujuan: p.kota_tujuan || '-', status: p.status || 'Menunggu Pembayaran', noResi: p.no_resi || '', kurir: p.kurir || '' })) });
    }

    if (action === 'getProdukAdmin') {
      const result = await fetch(`${SUPABASE_URL}/rest/v1/produk?select=*&order=lebar.asc,tinggi_kasur.asc`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
      const data = await result.json();
      return res.status(200).json({ status: 'success', produk: data.map(p => ({ id: p.id_varian, nama: p.nama_produk, lebar: p.lebar, tinggi: p.tinggi_kasur, harga: p.harga, stok: p.stok, aktif: p.aktif })) });
    }

    if (action === 'updateStatus') {
      const valid = ['Menunggu Pembayaran','Pembayaran Dikonfirmasi','Diproses','Dikirim','Selesai'];
      if (!valid.includes(statusBaru)) return res.status(400).json({ status: 'error', message: 'Status tidak valid' });
      await fetch(`${SUPABASE_URL}/rest/v1/pesanan?id_pesanan=eq.${idPesanan}`, { method: 'PATCH', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ status: statusBaru }) });
      return res.status(200).json({ status: 'success', idPesanan, statusBaru });
    }

    if (action === 'updateStokAdmin') {
      await fetch(`${SUPABASE_URL}/rest/v1/produk?id_varian=eq.${idVarian}`, { method: 'PATCH', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ stok: parseInt(stokBaru) }) });
      return res.status(200).json({ status: 'success', idVarian, stokBaru });
    }

    if (action === 'simpanResi') {
      await fetch(`${SUPABASE_URL}/rest/v1/pesanan?id_pesanan=eq.${idPesanan}`, { method: 'PATCH', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ no_resi: noResi, kurir, status: 'Dikirim' }) });
      return res.status(200).json({ status: 'success', idPesanan, noResi, kurir });
    }

    return res.status(400).json({ status: 'error', message: 'Action tidak dikenal' });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
}
