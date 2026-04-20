
import { GoogleGenAI, Type } from "@google/genai";
import { ServiceType } from "../types";

export interface ReadingResult {
  v1: number | null;
  v2: number | null;
}

export const parseEuropeanNumber = (val: string | number | null | undefined): number | null => {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') return val;
  let s = val.trim();
  if (!s) return null;
  if (s.includes('.') && s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  }
  const num = parseFloat(s);
  return isNaN(num) ? null : num;
};

export const extractReadingsForService = async (base64Image: string, service: ServiceType): Promise<ReadingResult> => {
  try {
    const apiKey = process.env.GEMINI_API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY || '';
    const ai = new GoogleGenAI({ apiKey });
    const imagePart = {
      inlineData: {
        mimeType: 'image/jpeg',
        data: base64Image.split(',')[1] || base64Image,
      },
    };

    let instruction = "";
    if (service === 'luz') {
      instruction = "Analiza este contador o cuadro eléctrico. Extrae la lectura acumulada en kWh. Si hay dos contadores, extrae ambos. Si solo hay uno, pon el segundo como null. Devuelve JSON {v1: num, v2: num | null}.";
    } else if (service === 'agua') {
      instruction = "Analiza este contador de AGUA. Extrae la lectura acumulada en metros cúbicos (m3). Ignora los decimales en rojo si los hay o inclúyelos con coma. Devuelve JSON {v1: num, v2: null}.";
    } else {
      instruction = "Analiza este panel de CALDERA o dispositivo de medición. Extrae la lectura numérica principal de consumo. Devuelve JSON {v1: num, v2: null}.";
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: { 
        parts: [
          imagePart, 
          { text: instruction + " Devuelve solo el JSON. Usa formato 12345.67." }
        ] 
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            v1: { type: Type.NUMBER },
            v2: { type: Type.NUMBER }
          }
        }
      }
    });

    const result = JSON.parse(response.text || "{}");
    return {
      v1: result.v1 || null,
      v2: result.v2 || null
    };
  } catch (error) {
    console.error("Error OCR:", error);
    return { v1: null, v2: null };
  }
};

export interface MaterialSuggestion {
  respuesta: string;
  materiales: {
    nombre: string;
    cantidad: number;
    unidad: string;
    categoria: string;
    descripcion?: string;
  }[];
}

export const suggestMaterialsForTask = async (mensaje: string, historial: { role: string, content: string }[]): Promise<MaterialSuggestion> => {
  try {
    const apiKey = process.env.GEMINI_API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY || '';
    const ai = new GoogleGenAI({ apiKey });
    
    const systemInstruction = `Actúa como un experto en Logística de Mantenimiento de la USAC.
    Tu objetivo es ayudar al usuario a identificar qué materiales necesita para una tarea específica.
    
    REGLAS:
    1. Si el usuario describe un problema (ej: "la puerta no cierra"), sugiere los materiales necesarios (ej: "bisagras", "aceite 3en1", "tornillos").
    2. Si el usuario es vago, haz preguntas aclaratorias.
    3. Devuelve SIEMPRE un JSON con la respuesta textual y una lista de materiales sugeridos.
    4. Categorías válidas: ferreteria, fontaneria, electricidad, climatizacion, pintura, limpieza, jardineria, oficina, seguridad, construccion, carpinteria, informatica, otros.
    
    JSON SCHEMA:
    {
      "respuesta": "Texto de ayuda para el usuario",
      "materiales": [
        {
          "nombre": "Nombre del material",
          "cantidad": 1,
          "unidad": "unidades|metros|litros|kg|cajas|packs",
          "categoria": "categoria_valida",
          "descripcion": "Breve nota técnica"
        }
      ]
    }`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        ...historial.map(h => ({ role: h.role === 'asistente' ? 'model' : 'user', parts: [{ text: h.content }] })),
        { role: 'user', parts: [{ text: mensaje }] }
      ],
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            respuesta: { type: Type.STRING },
            materiales: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  nombre: { type: Type.STRING },
                  cantidad: { type: Type.NUMBER },
                  unidad: { type: Type.STRING },
                  categoria: { type: Type.STRING },
                  descripcion: { type: Type.STRING }
                },
                required: ["nombre", "cantidad", "unidad", "categoria"]
              }
            }
          },
          required: ["respuesta", "materiales"]
        }
      }
    });

    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Error AI Material Suggestion:", error);
    return {
      respuesta: "Lo siento, no he podido procesar tu solicitud. ¿Podrías intentarlo de nuevo?",
      materiales: []
    };
  }
};

export interface ProviderInfo {
  name: string;
  cif?: string;
  phone?: string;
  email?: string;
  categories: string[];
  address?: string;
  website?: string;
}

export const extractProviderInfo = async (base64Image: string): Promise<ProviderInfo | null> => {
  try {
    const apiKey = process.env.GEMINI_API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY || '';
    const ai = new GoogleGenAI({ apiKey });
    const imagePart = {
      inlineData: {
        mimeType: 'image/jpeg',
        data: base64Image.split(',')[1] || base64Image,
      },
    };

    const systemInstruction = `Analiza la imagen de esta tarjeta de visita o albarán y extrae los datos del PROVEEDOR.
    Devuelve un JSON con: nombre, CIF (Código de Identificación Fiscal), teléfono, email, categorías (lista de: ferreteria, fontaneria, electricidad, climatizacion, pintura, limpieza, jardineria, oficina, seguridad, construccion, carpinteria, informatica, otros), dirección y web.
    
    JSON SCHEMA:
    {
      "name": "Nombre Empresa",
      "cif": "B12345678",
      "phone": "965123456",
      "email": "info@empresa.com",
      "categories": ["categoria1", "categoria2"],
      "address": "Calle Falsa 123",
      "website": "www.empresa.com"
    }`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: { parts: [imagePart, { text: "Extrae los datos del proveedor (incluyendo el CIF si aparece) de esta imagen en formato JSON." }] },
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            cif: { type: Type.STRING },
            phone: { type: Type.STRING },
            email: { type: Type.STRING },
            categories: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            address: { type: Type.STRING },
            website: { type: Type.STRING }
          },
          required: ["name"]
        }
      }
    });

    return JSON.parse(response.text || "null");
  } catch (error) {
    console.error("Error OCR Provider:", error);
    return null;
  }
};

export const askGeminiAboutData = async (pregunta: string, dataContext: any, historial: { role: string, content: string }[]): Promise<string> => {
  try {
    const apiKey = process.env.GEMINI_API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY || '';
    const ai = new GoogleGenAI({ apiKey });
    
    const systemInstruction = `Actúa como el Asistente de Inteligencia de la USAC (SIGAI).
    Tienes acceso a los datos actuales de la unidad (lecturas, tareas, solicitudes, personal).
    
    DATOS ACTUALES:
    ${JSON.stringify(dataContext)}
    
    REGLAS:
    1. Responde de forma concisa y profesional (estilo militar).
    2. Si te preguntan por consumos, analiza las tendencias si hay datos suficientes.
    3. Si te preguntan por tareas, prioriza las críticas.
    4. Si no tienes datos para responder, admítelo y sugiere qué información falta.
    5. Usa Markdown para dar formato a las respuestas (tablas, negritas, listas).
    6. Idioma: Español.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        ...historial.map(h => ({ role: h.role === 'asistente' ? 'model' : 'user', parts: [{ text: h.content }] })),
        { role: 'user', parts: [{ text: pregunta }] }
      ],
      config: {
        systemInstruction,
      }
    });

    return response.text || "No he podido procesar la consulta.";
  } catch (error) {
    console.error("Error AI Data Query:", error);
    return "Error en el sistema de inteligencia. Inténtelo de nuevo.";
  }
};
