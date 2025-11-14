export default async function handler(req, res) {
  const { uid } = req.query;
  if (!uid) {
    return res.status(400).json({ error: "UID faltando" });
  }

  const url = `https://info-ob50-gpl.vercel.app/get?uid=${uid}`;

  
  try {
    const response = await fetch(url);
    const data = await response.json();

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: "Entre em contato com (84) 991687281" });
  }
}
