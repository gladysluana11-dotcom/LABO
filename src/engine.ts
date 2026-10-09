export const areas = ["transporte", "agua", "residuos", "plásticos", "energía"] as const;
export type Area = (typeof areas)[number];
export type Answers = Record<Area, number>;

export interface RecommendationResult {
  recommendations: string[];
  source: "local" | "ia";
}

export interface RecommendationProvider {
  getRecommendations(answers: Answers, score: number): Promise<RecommendationResult>;
}

export const questions: { area: Area; title: string; eyebrow: string; options: { label: string; detail: string; score: number; icon: string }[] }[] = [
  {
    area: "transporte",
    eyebrow: "Moverte también puede mover el cambio",
    title: "¿Cómo haces la mayoría de tus trayectos?",
    options: [
      { label: "A pie o en bici", detail: "Cuando el trayecto lo permite", score: 100, icon: "bike" },
      { label: "Transporte público", detail: "Bus, tren o colectivo", score: 80, icon: "bus" },
      { label: "Voy compartiendo", detail: "Con familia o amistades", score: 55, icon: "share" },
      { label: "Auto o moto", detail: "Casi siempre por mi cuenta", score: 25, icon: "car" },
    ],
  },
  {
    area: "agua",
    eyebrow: "Cada gota cuenta en la vida diaria",
    title: "¿Qué se parece más a tu rutina con el agua?",
    options: [
      { label: "Cierro el caño", detail: "Al cepillarme y enjabonarme", score: 100, icon: "drop" },
      { label: "Duchas breves", detail: "Y uso el agua con atención", score: 80, icon: "shower" },
      { label: "A veces me acuerdo", detail: "Estoy formando el hábito", score: 55, icon: "water" },
      { label: "La dejo correr", detail: "Todavía no lo tengo presente", score: 25, icon: "tap" },
    ],
  },
  {
    area: "residuos",
    eyebrow: "Lo que separas puede tener otra vida",
    title: "¿Qué haces con tus residuos en casa?",
    options: [
      { label: "Separo y reutilizo", detail: "Aprovecho lo que aún sirve", score: 100, icon: "cycle" },
      { label: "Reciclo lo que puedo", detail: "Según lo que reciben cerca", score: 80, icon: "recycle" },
      { label: "Separo algunas cosas", detail: "Voy aprendiendo cómo hacerlo", score: 55, icon: "sort" },
      { label: "Todo va junto", detail: "Es lo más práctico por ahora", score: 25, icon: "bin" },
    ],
  },
  {
    area: "plásticos",
    eyebrow: "Pequeñas elecciones, menos descartables",
    title: "¿Qué tan seguido eliges opciones reutilizables?",
    options: [
      { label: "Casi siempre", detail: "Llevo mi botella y mi bolsa", score: 100, icon: "bottle" },
      { label: "Cuando me acuerdo", detail: "Estoy haciendo espacio al hábito", score: 80, icon: "bag" },
      { label: "De vez en cuando", detail: "Depende de lo que encuentre", score: 55, icon: "leaf" },
      { label: "Uso descartables", detail: "Suelen ser mi primera opción", score: 25, icon: "plastic" },
    ],
  },
  {
    area: "energía",
    eyebrow: "La energía también empieza en casa",
    title: "¿Cómo cuidas la energía que usas?",
    options: [
      { label: "Apago y desconecto", detail: "Cuando algo ya no se usa", score: 100, icon: "sun" },
      { label: "Aprovecho la luz natural", detail: "Y uso focos eficientes", score: 80, icon: "bulb" },
      { label: "A veces lo reviso", detail: "Puedo volverlo más constante", score: 55, icon: "switch" },
      { label: "Queda encendido", detail: "No siempre noto qué está prendido", score: 25, icon: "plug" },
    ],
  },
];

const recommendationBank: Record<Area, string[]> = {
  transporte: [
    "Si el trayecto es corto y seguro, prueba caminar o ir en bici un día esta semana.",
    "Antes de salir, revisa si puedes combinar un tramo en transporte público.",
    "Coordina un viaje compartido para una salida que ya tengas prevista.",
  ],
  agua: [
    "Cierra el caño mientras te cepillas y vuelve a abrirlo solo para enjuagarte.",
    "Pon una canción corta para acompañar una ducha más breve, a tu ritmo.",
    "Revisa si algún caño gotea y coméntalo en casa para poder repararlo.",
  ],
  residuos: [
    "Deja un recipiente identificado para separar papel o envases limpios.",
    "Antes de botar algo, piensa si puede repararse, donarse o reutilizarse.",
    "Consulta qué materiales recibe el punto de reciclaje más cercano.",
  ],
  plásticos: [
    "Deja una bolsa reutilizable junto a tus llaves para tenerla a mano.",
    "Lleva una botella reutilizable en tu próxima salida.",
    "Al comprar, elige una opción con menos envoltorios cuando esté disponible.",
  ],
  energía: [
    "Haz una pausa al salir de una habitación: ¿hay luces que puedas apagar?",
    "Abre cortinas para aprovechar la luz natural durante el día.",
    "Desconecta un cargador que ya no estés usando, si es seguro hacerlo.",
  ],
};

const challengeBank: Record<Area, string[]> = {
  transporte: [
    "Observa un trayecto corto que podrías hacer de otra manera.",
    "Camina un tramo breve si la ruta es segura.",
    "Pregunta en casa o a una amistad si pueden compartir un viaje.",
    "Prueba el transporte público para un trayecto conocido.",
    "Deja preparada una ruta caminable o en bici para otro día.",
    "Elige una salida de la semana para compartir el trayecto.",
    "Celebra el cambio que te resultó más sencillo y decide si repetirlo.",
  ],
  agua: [
    "Fíjate en un momento cotidiano en que el caño queda abierto.",
    "Cierra el caño mientras te cepillas los dientes.",
    "Prueba una ducha breve, sin exigirte un tiempo perfecto.",
    "Cuéntale a alguien de casa un hábito de agua que quieras probar.",
    "Reutiliza agua limpia que ya tengas, por ejemplo para una planta.",
    "Revisa si hay un goteo y avisa a quien pueda repararlo.",
    "Elige el hábito de agua que quieras mantener la próxima semana.",
  ],
  residuos: [
    "Observa qué residuo aparece más en un día normal.",
    "Separa un material limpio que sí reciban cerca de ti.",
    "Busca un objeto que puedas reutilizar antes de descartarlo.",
    "Pregunta qué materiales acepta el reciclaje de tu barrio.",
    "Repara o comparte algo que todavía pueda usarse.",
    "Organiza un pequeño espacio para separar residuos en casa.",
    "Elige una separación sencilla para continuar la próxima semana.",
  ],
  plásticos: [
    "Identifica un descartable que suelas usar durante el día.",
    "Deja una bolsa reutilizable donde puedas verla al salir.",
    "Lleva una botella reutilizable en una salida.",
    "Elige una compra con menos envoltorio si es una opción accesible.",
    "Reutiliza un envase seguro que ya tengas en casa.",
    "Recuerda llevar contigo una opción reutilizable.",
    "Elige el cambio que te resultó más práctico para repetirlo.",
  ],
  energía: [
    "Observa qué luces y aparatos quedan encendidos en una habitación.",
    "Aprovecha la luz natural en un espacio de casa.",
    "Apaga una luz al salir de una habitación vacía.",
    "Desconecta un cargador que no esté en uso, si es seguro.",
    "Activa el modo de ahorro en un dispositivo que uses.",
    "Pregunta en casa si pueden revisar juntos un hábito de energía.",
    "Elige un hábito sencillo de energía para continuar.",
  ],
};

export function calculateScore(answers: Answers): number {
  const values = areas.map((area) => answers[area]);
  if (values.some((value) => !Number.isFinite(value))) throw new Error("Faltan respuestas para calcular el resultado.");
  // Cada hábito pesa lo mismo; las cuatro opciones de cada pregunta reciben valores ordinales explícitos.
  return Math.round(values.reduce((sum, value) => sum + value, 0) / areas.length);
}

export function profileFor(score: number): { name: string; description: string } {
  if (score < 40) return { name: "Explorador verde", description: "Estás empezando a mirar tus hábitos con curiosidad. Cada cambio pequeño puede abrir un camino nuevo." };
  if (score < 60) return { name: "Semilla consciente", description: "Ya hay buenas ideas creciendo en tu rutina. Puedes elegir una y hacerla más constante." };
  if (score < 80) return { name: "Impulsor sostenible", description: "Muchas de tus decisiones ya cuidan el entorno. Tu siguiente paso puede inspirar a otras personas." };
  return { name: "Guardián del planeta", description: "Has construido hábitos atentos y sostenibles. Sigue compartiendo lo que te funciona, sin buscar la perfección." };
}

export function prioritizeAreas(answers: Answers): Area[] {
  return [...areas].sort((first, second) => answers[first] - answers[second]);
}

export function localRecommendations(answers: Answers): string[] {
  const priorities = prioritizeAreas(answers);
  return [
    recommendationBank[priorities[0]][0],
    recommendationBank[priorities[1]][1],
    recommendationBank[priorities[0]][2],
  ];
}

export function createChallenge(area: Area): string[] {
  return challengeBank[area];
}

export const localProvider: RecommendationProvider = {
  async getRecommendations(answers, _score) {
    return { recommendations: localRecommendations(answers), source: "local" };
  },
};

export class RemoteRecommendationProvider implements RecommendationProvider {
  private readonly endpoint: string;

  constructor(endpoint: string) {
    this.endpoint = endpoint;
  }

  async getRecommendations(answers: Answers, score: number): Promise<RecommendationResult> {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch(`${this.endpoint.replace(/\/$/, "")}/api/recommendations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: areas.map((area) => ({ area, score: answers[area] })), score }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`El servicio de recomendaciones respondió ${response.status}.`);
      const payload: unknown = await response.json();
      if (
        typeof payload !== "object" ||
        payload === null ||
        !("recommendations" in payload) ||
        !Array.isArray(payload.recommendations) ||
        payload.recommendations.length !== 3 ||
        !payload.recommendations.every((item) => typeof item === "string" && item.length > 0 && item.length <= 280)
      ) {
        throw new Error("El servicio devolvió recomendaciones con un formato no válido.");
      }
      return { recommendations: payload.recommendations, source: "ia" };
    } finally {
      window.clearTimeout(timeout);
    }
  }
}

export async function checkAIAvailability(endpoint: string): Promise<boolean> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 4000);
  try {
    const response = await fetch(`${endpoint.replace(/\/$/, "")}/api/health`, { signal: controller.signal });
    if (!response.ok) return false;
    const payload: unknown = await response.json();
    return typeof payload === "object" && payload !== null && "available" in payload && payload.available === true;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return false;
    return false;
  } finally {
    window.clearTimeout(timeout);
  }
}
