// api/admin.js
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ status: 'error', message: 'Method not allowed' });

  // Baca body
  let rawBody = '';
  try {
    const buffers = [];
    for await (const chunk of req) buffers.push(chunk);
    rawBody = Buffer.concat(buffers).toString();
  } catch (err) {
    return res.status(400).json({ status: 'error', message: 'Gagal membaca body: ' + err.message });
  }
  let cleanBody = rawBody.trim();
  if ((cleanBody.startsWith('"') && cleanBody.endsWith('"')) || 
      (cleanBody.startsWith("'") && cleanBody.endsWith("'"))) {
    cleanBody = cleanBody.slice(1, -1);
  }
  cleanBody = cleanBody.replace(/\\"/g, '"');
  let body;
  try {
    body = JSON.parse(cleanBody);
  } catch (err) {
    return res.status(400).json({ status: 'error', message: 'Body tidak valid JSON: ' + err.message });
  }

  const { adminPass, action, idPesanan, statusBaru, idVarian, stokBaru, noResi, kurir } = body;

  if (!adminPass || adminPass !== process.env.ADMIN_PASS) {
    await new Promise(r => setTimeout(r, 1000));
    return res.status(403).json({ status: 'error', message: 'Akses ditolak' });
  }

  let supabaseUrl = process.env.SUPABASE_URL || '';
  supabaseUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, '');
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ status: 'error', message: 'Env Supabase tidak lengkap' });
  }

  try {
    if (action === 'verifyLogin') {
      return res.status(200).json({ status: 'success' });
    }
    if (action === 'getAllPesanan') {
      const result = await fetch(`${supabaseUrl}/rest/v1/pesanan?order=tanggal.desc`, {
        headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
      });
      const data = await result.json();
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
    if (action === 'getProdukAdmin') {
      const result = await fetch(`${supabaseUrl}/rest/v1/produk?order=lebar.asc,tinggi_kasur.asc`, {
        headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
      });
      const data = await result.json();
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
    if (action === 'updateStatus') {
      if (!idPesanan || !statusBaru) return res.status(400).json({ status: 'error', message: 'idPesanan dan statusBaru diperlukan' });
      const valid = ['Menunggu Pembayaran','Pembayaran Dikonfirmasi','Diproses','Dikirim','Selesai'];
      if (!valid.includes(statusBaru)) return res.status(400).json({ status: 'error', message: 'Status tidak valid' });
      await fetch(`${supabaseUrl}/rest/v1/pesanan?id_pesanan=eq.${idPesanan}`, {
        method: 'PATCH', headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: statusBaru })
      });
      return res.status(200).json({ status: 'success', idPesanan, statusBaru });
    }
    if (action === 'updateStokAdmin') {
      if (!idVarian || stokBaru === undefined) return res.status(400).json({ status: 'error', message: 'idVarian dan stokBaru diperlukan' });
      await fetch(`${supabaseUrl}/rest/v1/produk?id_varian=eq.${idVarian}`, {
        method: 'PATCH', headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ stok: parseInt(stokBaru) })
      });
      return res.status(200).json({ status: 'success', idVarian, stokBaru });
    }
    if (action === 'simpanResi') {
      if (!idPesanan || !noResi || !kurir) return res.status(400).json({ status: 'error', message: 'idPesanan, noResi, kurir diperlukan' });
      await fetch(`${supabaseUrl}/rest/v1/pesanan?id_pesanan=eq.${idPesanan}`, {
        method: 'PATCH', headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ no_resi: noResi, kurir, status: 'Dikirim' })
      });
      return res.status(200).json({ status: 'success', idPesanan, noResi, kurir });
    }
    return res.status(400).json({ status: 'error', message: 'Action tidak dikenal' });
  } catch (err) {
    console.error('[admin]', err.message);
    return res.status(500).json({ status: 'error', message: err.message });
  }
}
