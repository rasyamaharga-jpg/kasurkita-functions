// api/buat-resi.js
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ status: 'error', message: 'Method not allowed' });

  const { adminPass, pesanan, courierCode, courierService, destinationAreaId } = req.body;
  if (!adminPass || adminPass !== process.env.ADMIN_PASS) {
    await new Promise(r => setTimeout(r, 1000));
    return res.status(403).json({ status: 'error', message: 'Akses ditolak' });
  }
  if (!pesanan || !courierCode || !courierService || !destinationAreaId) {
    return res.status(400).json({ status: 'error', message: 'Data tidak lengkap' });
  }

  const apiKey = process.env.BITESHIP_API_KEY;
  const originId = process.env.ORIGIN_AREA_ID;
  if (!apiKey || !originId) return res.status(500).json({ status: 'error', message: 'Konfigurasi server bermasalah' });

  try {
    const response = await fetch('https://api.biteship.com/v1/orders', {
      method: 'POST',
      headers: { Authorization: apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shipper_contact_name: 'KasurKita', shipper_contact_phone: '628561516488', shipper_contact_email: 'kasurkita@email.com', shipper_organization: 'KasurKita',
        origin_contact_name: 'KasurKita', origin_contact_phone: '628561516488', origin_address: 'Jl. Pramuka RT4/RW15 Godean', origin_area_id: originId, origin_postal_code: 57554,
        destination_contact_name: String(pesanan.nama).slice(0, 100), destination_contact_phone: String(pesanan.noWA).replace(/\D/g, '').slice(0, 15),
        destination_address: String(pesanan.alamat).slice(0, 255), destination_area_id: destinationAreaId, destination_postal_code: 0,
        courier_company: courierCode, courier_type: courierService, delivery_type: 'now', order_note: `ID: ${String(pesanan.idPesanan).slice(0, 50)}`,
        items: [{ name: `Sprei ${String(pesanan.idVarian).slice(0, 50)}`, description: `Motif: ${String(pesanan.idMotif).slice(0, 50)}`, value: Math.max(1000, parseInt(pesanan.totalHarga) || 100000), weight: Math.min(50000, Math.max(100, parseInt(pesanan.berat) || 1000)), quantity: Math.min(100, Math.max(1, parseInt(pesanan.jumlah) || 1)) }]
      })
    });
    const data = await response.json();
    if (!data.success) return res.status(400).json({ status: 'error', message: data.error || 'Gagal buat resi' });
    return res.status(200).json({ status: 'success', noResi: data.courier?.waybill_id || data.id, kurir: `${courierCode.toUpperCase()} - ${courierService}`, orderId: data.id });
  } catch (err) {
    console.error('[buat-resi]', err.message);
    return res.status(500).json({ status: 'error', message: err.message });
  }
}
