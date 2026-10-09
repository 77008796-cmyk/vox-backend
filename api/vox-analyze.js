export default async function handler(req, res) {
    // Permitir solicitudes desde la app web (CORS)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { userArgument, posture, difficulty } = req.body;
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    if (!GEMINI_API_KEY) {
        return res.status(500).json({ error: "Falta configurar GEMINI_API_KEY en Vercel" });
    }

    // Limpieza estricta de etiquetas
    const cleanArgument = (userArgument || '').replace(/\[(TESIS\vert{}ARGUMENTO\vert{}CONTRAARGUMENTO\vert{}CONCLUSIÓN)\]/gi, '').trim();
    const targetRole = posture === 'favor' ? 'EN CONTRA' : 'A FAVOR';

    let diffInstruction = '';
    if (difficulty === 'easy') {
        diffInstruction = 'Responde con argumentos sencillos, directos y con ejemplos cotidianos fácil de entender.';
    } else if (difficulty === 'medium') {
        diffInstruction = 'Actúa como un oponente terco y persistente que busca llevar la contraria en todos los aspectos.';
    } else {
        diffInstruction = 'Demuestra una postura aplastante. Utiliza un lenguaje sumamente formal, analítico, elegante y sutilmente humillante para el usuario. Señala sus fallas de lógica con precisión para que sienta que su argumento fue destruido.';
    }

    const promptText = `
Eres la IA "Abogado del Diablo" para la aplicación educativa VOX.
El usuario ha escrito este argumento: "${cleanArgument}"
El usuario sostiene una postura ${posture === 'favor' ? 'A FAVOR' : 'EN CONTRA'}.
Tú debes tomar OBLIGATORIAMENTE la postura **${targetRole}**.

Instrucciones de Dificultad (${difficulty}):
${diffInstruction}

Reglas estrictas de análisis:
1. Extrae el tema real de la discusión (1 a 3 palabras) sin incluir corchetes ni etiquetas como TESIS o postura.
2. Identifica qué premisas, datos empíricos, efectos secundarios o falacias se le escaparon al usuario.
3. Lista de 3 a 4 palabras/conceptos clave que faltaron en su borrador.
4. Redacta tu contraargumento directo atacando sus vacíos de lógica.
5. Genera 2 búsquedas o titulares de investigación web reales adaptados a la postura ${targetRole}.

Devuelve ÚNICAMENTE un objeto JSON válido con este formato:
{
  "topic": "Tema real detectado",
  "missingPremises": "Explicación de la falla o vacío detectado en su texto",
  "keyWordsToInclude": ["concepto1", "término2", "término3"],
  "argument": "Tu contraargumento atacando la posición del usuario",
  "webQueries": ["Título o búsqueda real 1", "Título o búsqueda real 2"]
}`;

    try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
        const response = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }] })
        });

        const data = await response.json();
        const rawText = data.candidates[0].content.parts[0].text;
        const cleanJson = rawText.replace(/```json/g, '').replace(/```/g, '').trim();

        res.status(200).json(JSON.parse(cleanJson));
    } catch (e) {
        res.status(500).json({ error: "Error interno al procesar el argumento con la IA" });
    }
}
