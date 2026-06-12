// Vercel Function - Buat Pesanan
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
const GAS_URL = process.env.GAS_URL;

function generateOrderId() {
  const now = new Date();
  const tgl = now.toISOString().slice(0,10).replace(/-/g,'');
  const random = Math.floor(Math.random() * 9000) + 1000;
  return `ORD-${tgl}-${random}`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'error', message: 'Method not allowed' });
  }

  let body;
  try {
    body = req.body;
  } catch {
    return res.status(400).json({ status: 'error', message: 'Body tidak valid' });
  }

  const { idVarian, idMotif, namaPembeli, noWhatsApp, alamat, kotaTujuan, jumlahBeli } = body;

  if (!idVarian || !idMotif || !namaPembeli || !noWhatsApp || !alamat || !kotaTujuan || !jumlahBeli) {
    return res.status(400).json({ status: 'error', message: 'Data tidak lengkap' });
  }

  try {
    // cek stok
    const resProduk = await fetch(
      `${SUPABASE_URL}/rest/v1/produk?id_varian=eq.${idVarian}&aktif=eq.true&select=harga,stok,berat_gram`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    );
    const produkArr = await resProduk.json();
    if (!produkArr.length) {
      return res.status(400).json({ status: 'error', message: `Varian '${idVarian}' tidak ditemukan` });
    }

    const produk = produkArr[0];
    const jumlah = parseInt(jumlahBeli);
    if (produk.stok < jumlah) {
      return res.status(400).json({ status: 'error', message: `Stok hanya ${produk.stok} pcs` });
    }

    const totalHarga = produk.harga * jumlah;
    const idPesanan = generateOrderId();

    // simpan pesanan
    const resSimpan = await fetch(`${SUPABASE_URL}/rest/v1/pesanan`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
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

    if (!resSimpan.ok) throw new Error('Gagal simpan pesanan');

    // kurangi stok
    await fetch(`${SUPABASE_URL}/rest/v1/produk?id_varian=eq.${idVarian}`, {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ stok: produk.stok - jumlah })
    });

    // sync ke GAS jika ada
    if (GAS_URL) {
      fetch(GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: 'syncPesanan', idPesanan, namaPembeli, noWhatsApp, idVarian, idMotif, jumlahBeli: jumlah, totalHarga, alamat, kotaTujuan })
      }).catch(e => console.error('Sync GAS gagal:', e.message));
    }

    res.status(200).json({ status: 'success', idPesanan, totalHarga });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: 'Gagal memproses pesanan' });
  }
}
