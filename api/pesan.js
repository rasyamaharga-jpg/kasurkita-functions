// api/pesan.js
export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ status: 'error', message: 'Method not allowed' });

  // Baca body request (manual fallback jika req.body kosong)
  let body = req.body;
  if (!body || Object.keys(body).length === 0) {
    try {
      const rawBody = await new Promise((resolve, reject) => {
        let data = '';
        req.on('data', chunk => data += chunk);
        req.on('end', () => resolve(data));
        req.on('error', reject);
      });
      body = rawBody ? JSON.parse(rawBody) : {};
    } catch (err) {
      return res.status(400).json({ status: 'error', message: 'Body tidak valid: ' + err.message });
    }
  }

  const { idVarian, idMotif, namaPembeli, noWhatsApp, alamat, kotaTujuan, jumlahBeli } = body;

  if (!idVarian || !idMotif || !namaPembeli || !noWhatsApp || !alamat || !kotaTujuan || !jumlahBeli) {
    return res.status(400).json({
      status: 'error',
      message: 'Data tidak lengkap',
      received: Object.keys(body)
    });
  }

  // Environment variables
  let supabaseUrl = process.env.SUPABASE_URL || '';
  supabaseUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, '');
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ status: 'error', message: 'Env tidak lengkap', hasUrl: !!supabaseUrl, hasKey: !!supabaseKey });
  }

  try {
    // Cek produk
    const prodRes = await fetch(`${supabaseUrl}/rest/v1/produk?id_varian=eq.${idVarian}&aktif=eq.true&select=harga,stok`, {
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
    });
    const produkArr = await prodRes.json();
    if (!produkArr.length) {
      return res.status(400).json({ status: 'error', message: `Varian '${idVarian}' tidak ditemukan` });
    }

    const produk = produkArr[0];
    const jumlah = parseInt(jumlahBeli);
    if (produk.stok < jumlah) {
      return res.status(400).json({ status: 'error', message: `Stok hanya ${produk.stok} pcs` });
    }

    const totalHarga = produk.harga * jumlah;
    const idPesanan = `ORD-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Math.floor(Math.random()*9000+1000)}`;

    // Simpan pesanan
    const simpanRes = await fetch(`${supabaseUrl}/rest/v1/pesanan`, {
      method: 'POST',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
      body: JSON.stringify({
        id_pesanan: idPesanan,
        nama_pembeli: namaPembeli,
        no_whatsapp: noWhatsApp,
        id_varian: idVarian,
        id_motif: idMotif,
        jumlah_beli: jumlah,
        total_harga: totalHarga,
        alamat,
        kota_tujuan: kotaTujuan,
        status: 'Menunggu Pembayaran'
      })
    });
    if (!simpanRes.ok) {
      const errText = await simpanRes.text();
      throw new Error(`Gagal simpan pesanan: ${simpanRes.status} - ${errText}`);
    }

    // Kurangi stok
    await fetch(`${supabaseUrl}/rest/v1/produk?id_varian=eq.${idVarian}`, {
      method: 'PATCH',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ stok: produk.stok - jumlah })
    });

    // Google Sheets sync (opsional)
    const GAS_URL = process.env.GAS_URL;
    if (GAS_URL) {
      fetch(GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          action: 'syncPesanan',
          idPesanan, namaPembeli, noWhatsApp,
          idVarian, idMotif, jumlahBeli: jumlah,
          totalHarga, alamat, kotaTujuan
        })
      }).catch(e => console.error('Sync GAS gagal:', e.message));
    }

    return res.status(200).json({ status: 'success', idPesanan, totalHarga });
  } catch (err) {
    console.error('[pesan]', err.message);
    return res.status(500).json({ status: 'error', message: err.message });
  }
}
