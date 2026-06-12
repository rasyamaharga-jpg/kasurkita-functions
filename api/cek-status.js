// api/cek-status.js
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ status: 'error', message: 'Method not allowed' });

  const idPesanan = req.query.idPesanan;
  if (!idPesanan) return res.status(400).json({ status: 'error', message: 'idPesanan wajib diisi' });

  let supabaseUrl = process.env.SUPABASE_URL || '';
  supabaseUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, '');
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return res.status(500).json({ status: 'error', message: 'Env tidak lengkap' });

  try {
    const result = await fetch(`${supabaseUrl}/rest/v1/pesanan?id_pesanan=eq.${idPesanan}`, {
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
    });
    const data = await result.json();
    if (!data.length) return res.status(404).json({ status: 'error', message: `Pesanan '${idPesanan}' tidak ditemukan` });
    const p = data[0];
    return res.status(200).json({
      status: 'success', idPesanan: p.id_pesanan, tanggal: p.tanggal, nama: p.nama_pembeli,
      idVarian: p.id_varian, idMotif: p.id_motif, jumlah: p.jumlah_beli, totalHarga: p.total_harga,
      kotaTujuan: p.kota_tujuan, statusPesanan: p.status, noResi: p.no_resi || '', kurir: p.kurir || ''
    });
  } catch (err) {
    console.error('[cek-status]', err.message);
    return res.status(500).json({ status: 'error', message: err.message });
  }
}
