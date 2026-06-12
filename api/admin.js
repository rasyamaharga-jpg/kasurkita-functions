export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  let body = req.body;
  try {
    if (typeof body === 'string') body = JSON.parse(body);
  } catch(e) { console.log(e); }
  return res.status(200).json({ receivedBody: body, type: typeof req.body, raw: req.body });
}
