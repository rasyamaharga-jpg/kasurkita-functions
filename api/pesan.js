// api/pesan.js (dengan parser body yang lebih kuat)
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ status: 'error', message: 'Method not allowed' });

  // Baca raw body terlebih dahulu
  let rawBody = '';
  try {
    const buffers = [];
    for await (const chunk of req) buffers.push(chunk);
    rawBody = Buffer.concat(buffers).toString();
  } catch (err) {
    return res.status(400).json({ status: 'error', message: 'Gagal membaca body: ' + err.message });
  }

  // Bersihkan: hapus kutip diawal/akhir jika ada (misal jika body berupa string JSON yang dikutip)
  let cleanBody = rawBody.trim();
  if ((cleanBody.startsWith('"') && cleanBody.endsWith('"')) || 
      (cleanBody.startsWith("'") && cleanBody.endsWith("'"))) {
    cleanBody = cleanBody.slice(1, -1);
  }
  // Unescape jika perlu
  cleanBody = cleanBody.replace(/\\"/g, '"');

  let body;
  try {
    body = JSON.parse(cleanBody);
  } catch (err) {
    return res.status(400).json({
      status: 'error',
      message: 'Body tidak valid JSON: ' + err.message,
      raw: rawBody.substring(0, 100)
    });
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
    return res.status(500).json({ status: 'error', message: 'Env tidak lengkap' });
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
