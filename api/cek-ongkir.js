// api/cek-ongkir.js (debug version)
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ status: 'error', message: 'Method not allowed' });

  const destId = req.query.destinationAreaId;
  const weight = parseInt(req.query.weight);

  // Debug: cek environment variables
  const apiKey = process.env.BITESHIP_API_KEY;
  const originId = process.env.ORIGIN_AREA_ID;

  // Kembalikan info debug (tanpa memanggil Biteship)
  return res.status(200).json({
    debug: true,
    hasApiKey: !!apiKey,
    hasOriginId: !!originId,
    apiKeyPrefix: apiKey ? apiKey.substring(0, 8) : null,
    originIdValue: originId || null,
    destId: destId,
    weight: weight
  });
}
