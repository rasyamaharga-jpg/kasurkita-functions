// api/pesan.js - menggunakan stok per motif (tabel stok_produk)
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ status: 'error', message: 'Method not allowed' });

  // Baca body
  let body = req.body;
  if (!body || typeof body !== 'object') {
    try { body = JSON.parse(req.body); } catch { return res.status(400).json({ status: 'error', message: 'Body tidak valid' }); }
  }

  const { idVarian, idMotif, namaPembeli, noWhatsApp, alamat, kotaTujuan, jumlahBeli } = body;
  if (!idVarian || !idMotif || !namaPembeli || !noWhatsApp || !alamat || !kotaTujuan || !jumlahBeli) {
    return res.status(400).json({ status: 'error', message: 'Data tidak lengkap' });
  }

  let supabaseUrl = process.env.SUPABASE_URL || '';
  supabaseUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return res.status(500).json({ status: 'error', message: 'Env tidak lengkap' });

  try {
    // 1. Ambil harga produk dari tabel produk
    const produkRes = await fetch(`${supabaseUrl}/rest/v1/produk?id_varian=eq.${idVarian}&select=harga`, {
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
    });
    const produkArr = await produkRes.json();
    if (!produkArr.length) return res.status(400).json({ status: 'error', message: `Varian '${idVarian}' tidak ditemukan` });
    const harga = produkArr[0].harga;

    // 2. Cek stok dari tabel stok_produk
    const stokRes = await fetch(`${supabaseUrl}/rest/v1/stok_produk?id_varian=eq.${idVarian}&id_motif=eq.${idMotif}&select=stok`, {
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
    });
    let stokData = await stokRes.json();
    let stokTersedia = 0;
    if (stokData && stokData.length > 0) {
      stokTersedia = stokData[0].stok;
    } else {
      // Jika belum ada entri, buat dengan stok 0
      await fetch(`${supabaseUrl}/rest/v1/stok_produk`, {
        method: 'POST',
        headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_varian: idVarian, id_motif: idMotif, stok: 0 })
      });
      stokTersedia = 0;
    }

    const jumlah = parseInt(jumlahBeli);
    if (stokTersedia < jumlah) {
      return res.status(400).json({ status: 'error', message: `Stok hanya ${stokTersedia} pcs untuk kombinasi ini` });
    }

    const totalHarga = harga * jumlah;
    const idPesanan = `ORD-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Math.floor(Math.random()*9000+1000)}`;

    // 3. Simpan pesanan
    const simpanRes = await fetch(`${supabaseUrl}/rest/v1/pesanan`, {
      method: 'POST',
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({
        id_pesanan: idPesanan, nama_pembeli: namaPembeli, no_whatsapp: noWhatsApp,
        id_varian: idVarian, id_motif: idMotif, jumlah_beli: jumlah, total_harga: totalHarga,
        alamat, kota_tujuan: kotaTujuan, status: 'Menunggu Pembayaran'
      })
    });
    if (!simpanRes.ok) throw new Error('Gagal simpan pesanan');

    // 4. Kurangi stok
    const stokBaru = stokTersedia - jumlah;
    await fetch(`${supabaseUrl}/rest/v1/stok_produk?id_varian=eq.${idVarian}&id_motif=eq.${idMotif}`, {
      method: 'PATCH',
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ stok: stokBaru })
    });

    // 5. Sync ke Google Sheets (opsional)
    const GAS_URL = process.env.GAS_URL;
    if (GAS_URL) {
      fetch(GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: 'syncPesanan', idPesanan, namaPembeli, noWhatsApp, idVarian, idMotif, jumlahBeli: jumlah, totalHarga, alamat, kotaTujuan })
      }).catch(e => console.error('Sync GAS gagal:', e.message));
    }

    return res.status(200).json({ status: 'success', idPesanan, totalHarga });
  } catch (err) {
    console.error('[pesan]', err.message);
    return res.status(500).json({ status: 'error', message: err.message });
  }
}
