// api/cek-status.js - Cek status pesanan
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ status: 'error', message: 'Method not allowed' });

  const idPesanan = req.query.idPesanan;
  if (!idPesanan) return res.status(400).json({ status: 'error', message: 'idPesanan wajib diisi' });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
  try {
    const result = await fetch(`${SUPABASE_URL}/rest/v1/pesanan?id_pesanan=eq.${idPesanan}&select=*`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    });
    const data = await result.json();
    if (!data.length) return res.status(404).json({ status: 'error', message: `Pesanan '${idPesanan}' tidak ditemukan` });
    const p = data[0];
    return res.status(200).json({ status: 'success', idPesanan: p.id_pesanan, tanggal: p.tanggal, nama: p.nama_pembeli, idVarian: p.id_varian, idMotif: p.id_motif, jumlah: p.jumlah_beli, totalHarga: p.total_harga, kotaTujuan: p.kota_tujuan, statusPesanan: p.status, noResi: p.no_resi || '', kurir: p.kurir || '' });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
}
