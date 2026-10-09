import {
  areas,
  calculateScore,
  checkAIAvailability,
  createChallenge,
  localProvider,
  localRecommendations,
  prioritizeAreas,
  profileFor,
  questions,
  RemoteRecommendationProvider,
  type Answers,
  type Area,
  type RecommendationResult,
} from "./engine";
import "./styles.css";
import "./visual-refresh.css";

type Screen = "home" | "question" | "analysis" | "result";
type AppRoute = { screen: "question"; index: number } | { screen: Exclude<Screen, "question"> };
type SavedState = { answers: Partial<Answers>; demo?: boolean };

const root = document.querySelector<HTMLDivElement>("#app");
if (!root) throw new Error("No se encontró el contenedor principal de ECOESPEJO.");

const emptyAnswers = (): Answers => ({ transporte: NaN, agua: NaN, residuos: NaN, plásticos: NaN, energía: NaN });
let answers = emptyAnswers();
let isDemo = false;
let route: AppRoute = { screen: "home" };
let aiReady = false;
let aiNotice = "";
let currentResult: RecommendationResult | null = null;
let analysisTimer = 0;

const endpoint = import.meta.env.VITE_AI_ENDPOINT?.trim() ?? "";
const remoteProvider = endpoint ? new RemoteRecommendationProvider(endpoint) : null;

function restoreAnswers(): void {
  try {
    const stored = sessionStorage.getItem("ecoespejo-session");
    if (!stored) return;
    const parsed: unknown = JSON.parse(stored);
    if (typeof parsed !== "object" || parsed === null || !("answers" in parsed) || typeof parsed.answers !== "object" || parsed.answers === null) return;
    const saved = parsed as { answers: Record<string, unknown>; demo?: boolean };
    for (const area of areas) {
      const value = saved.answers[area];
      if (typeof value === "number" && Number.isFinite(value)) answers[area] = value;
    }
    isDemo = saved.demo === true;
  } catch (error) {
    console.warn("No se pudo restaurar la sesión local de ECOESPEJO.", error);
  }
}

function persistAnswers(): void {
  try {
    sessionStorage.setItem("ecoespejo-session", JSON.stringify({ answers, demo: isDemo } satisfies SavedState));
  } catch (error) {
    console.warn("No se pudo guardar la sesión local; puedes continuar sin persistencia.", error);
  }
}

function routeFromHash(): AppRoute {
  const hash = location.hash.replace(/^#/, "");
  if (hash.startsWith("pregunta/")) {
    const index = Number(hash.split("/")[1]);
    if (Number.isInteger(index) && index >= 0 && index < questions.length) return { screen: "question", index };
  }
  if (hash === "analisis") return { screen: "analysis" };
  if (hash === "resultado") return { screen: "result" };
  return { screen: "home" };
}

function setRoute(next: AppRoute, replace = false): void {
  route = next;
  const value = next.screen === "question" ? `pregunta/${next.index}` : next.screen === "home" ? "inicio" : next.screen === "analysis" ? "analisis" : "resultado";
  const url = `${location.pathname}${location.search}#${value}`;
  if (replace) history.replaceState(null, "", url);
  else history.pushState(null, "", url);
  render();
}

function allAnswered(): boolean {
  return areas.every((area) => Number.isFinite(answers[area]));
}

function icon(name: string, extra = ""): string {
  const paths: Record<string, string> = {
    bike: '<circle cx="6" cy="17" r="3"/><circle cx="18" cy="17" r="3"/><path d="m6 17 4-8h4l4 8m-8-8-2-3H5m5 3 3 8m-1-5h5"/>',
    bus: '<rect x="4" y="4" width="16" height="15" rx="3"/><path d="M7 19v2m10-2v2M7 8h10M7 13h2m6 0h2"/>',
    share: '<circle cx="6" cy="17" r="3"/><circle cx="18" cy="17" r="3"/><path d="M9 17h6m-7-1 2-8h5l3 9M11 8h3m-7 4h3"/>',
    car: '<path d="m4 11 2-5h12l2 5 1 2v5h-3v-2H6v2H3v-5l1-2Z"/><path d="M5 12h14M7 14h2m6 0h2"/>',
    drop: '<path d="M12 3S5 11 5 15a7 7 0 0 0 14 0c0-4-7-12-7-12Z"/><path d="M9 16a3 3 0 0 0 3 3"/>',
    shower: '<path d="M4 11a8 8 0 0 1 16 0H4Zm4 4v2m4-2v2m4-2v2M6 11V8"/>',
    water: '<path d="M12 3S6 10 6 14a6 6 0 0 0 12 0c0-4-6-11-6-11Z"/><path d="M9 15a3 3 0 0 0 3 3"/>',
    tap: '<path d="M4 9h16M7 9V6h10v3m-7 0v4h8v2m-2-1 2 2 2-2M7 6V4"/>',
    cycle: '<path d="M7 7H3l3-3m11 13h4l-3 3M6 6a8 8 0 0 1 13 3m-1 9a8 8 0 0 1-13-3"/>',
    recycle: '<path d="m9 5 3-3 3 3m-3-3v7m6 2 4 1-1 4m1-4-6 4M7 13l-1 4H2l1-4m-1 4 6-4m6 3H9l-3 4m3-4 2 4"/>',
    sort: '<path d="M4 6h16M6 12h12m-9 6h6"/><circle cx="7" cy="6" r="1"/><circle cx="15" cy="12" r="1"/>',
    bin: '<path d="M4 7h16m-14 0 1 13h10l1-13M9 7V4h6v3m-5 4v5m4-5v5"/>',
    bottle: '<path d="M10 3h4v3l2 2v12H8V8l2-2V3Zm0 5h4m-5 6h10"/>',
    bag: '<path d="M5 8h14l-1 12H6L5 8Zm4 0a3 3 0 0 1 6 0"/>',
    leaf: '<path d="M20 4C10 4 5 7 5 13a5 5 0 0 0 5 5c6 0 9-5 10-14Z"/><path d="M4 21c3-6 7-9 12-12"/>',
    plastic: '<path d="M9 3h6l1 3-1 2 2 3v10H7V11l2-3-1-2 1-3Z"/><path d="M9 6h6m-6 8h6"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    bulb: '<path d="M9 18h6m-5 3h4m-6-7a7 7 0 1 1 8 0c-1 .7-1 1-1 2h-6c0-1-.1-1.3-1-2Z"/>',
    switch: '<rect x="3" y="6" width="18" height="12" rx="6"/><circle cx="15" cy="12" r="4"/>',
    plug: '<path d="M9 3v6m6-6v6M6 9h12v3a6 6 0 0 1-6 6v3m0-3v-4"/>',
    star: '<path d="m12 2 2.3 6.7L21 11l-6.7 2.3L12 20l-2.3-6.7L3 11l6.7-2.3L12 2Z"/>',
    arrow: '<path d="M4 12h16m-7-7 7 7-7 7"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    sparkle: '<path d="m12 3 1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3Zm7 12 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z"/>',
  };
  return `<svg class="icon ${extra}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ?? paths.sparkle}</svg>`;
}

function globe(smile: number, large = false): string {
  const mouth = smile > 65 ? "M72 88c7 10 19 10 26 0" : smile < 40 ? "M74 94c6-7 16-7 22 0" : "M73 91h24";
  return `<svg class="earth ${large ? "earth-large" : ""}" viewBox="0 0 180 180" role="img" aria-label="Planeta Tierra animado y amigable">
    <defs><radialGradient id="earthSkin" cx="35%" cy="28%"><stop stop-color="#FBF4DC"/><stop offset="1" stop-color="#6EDDA6"/></radialGradient><clipPath id="earthClip"><circle cx="90" cy="90" r="71"/></clipPath></defs>
    <circle cx="90" cy="90" r="79" fill="#F5B93F" opacity=".28"/><circle cx="90" cy="90" r="71" fill="url(#earthSkin)" stroke="#FBF4DC" stroke-width="3"/>
    <g clip-path="url(#earthClip)" fill="#2B7A8F"><path d="M32 50 48 38l18 3 6 12-8 8-3 15-12 8-13-9-8-16Zm69-17 20 2 13 14-9 8-10-4-6 9-15-3-9-10 4-12Zm-32 55 12-4 16 5 3 13 13 6 5 17-11 17-10 12-11-11 3-15-13-9-8-17Zm58-7 16-8 12 10-5 18-14 5-9-11Z"/></g>
    <circle cx="70" cy="78" r="4" fill="#14211F"/><circle cx="108" cy="78" r="4" fill="#14211F"/><path d="${mouth}" fill="none" stroke="#14211F" stroke-width="4" stroke-linecap="round"/>
    <circle cx="59" cy="88" r="6" fill="#F4735B"/><circle cx="120" cy="88" r="6" fill="#F4735B"/>
    <path d="M22 44 30 34m120 97 9 5" stroke="#F5B93F" stroke-width="3" stroke-linecap="round"/>
  </svg>`;
}

function optionIllustration(area: Area, index: number): string {
  const accent = ["#F4735B", "#8C9BE8", "#F5B93F", "#6EDDA6"][index];
  const common = `<path d="M9 88h102" stroke="#14211F" stroke-width="3" stroke-linecap="round"/><ellipse cx="61" cy="91" rx="34" ry="4" fill="#14211F" opacity=".12"/>`;
  const characters: Record<Area, string[]> = {
    transporte: [
      `<circle cx="36" cy="39" r="10" fill="#F5B93F"/><path d="m36 50-8 19m8-18 14 12 11-2m-25-10 13 8m-13 10-10 12m10-12 12 11" fill="none" stroke="#14211F" stroke-width="5" stroke-linecap="round"/><circle cx="26" cy="81" r="11" fill="#6EDDA6" stroke="#14211F" stroke-width="2"/><circle cx="62" cy="81" r="11" fill="#6EDDA6" stroke="#14211F" stroke-width="2"/><path d="m27 81 12-19 13 19H27l5-9h15" fill="none" stroke="#14211F" stroke-width="2.3"/>`,
      `<rect x="23" y="25" width="58" height="49" rx="13" fill="#F5B93F" stroke="#14211F" stroke-width="2"/><path d="M32 34h39v19H32z" fill="#FBF4DC"/><circle cx="36" cy="65" r="5" fill="#14211F"/><circle cx="67" cy="65" r="5" fill="#14211F"/><circle cx="41" cy="44" r="3" fill="#14211F"/><circle cx="62" cy="44" r="3" fill="#14211F"/><path d="M47 48q5 5 10 0" fill="none" stroke="#14211F" stroke-width="2"/>`,
      `<circle cx="40" cy="35" r="9" fill="#F4735B"/><circle cx="65" cy="38" r="9" fill="#8C9BE8"/><path d="M40 46v28m25-19-10 21m-15-30 14 11 12-4m-26 0-12 17m12-3-9 16m19-7 11 7" fill="none" stroke="#14211F" stroke-width="5" stroke-linecap="round"/><circle cx="32" cy="81" r="9" fill="#F5B93F" stroke="#14211F" stroke-width="2"/><circle cx="68" cy="81" r="9" fill="#6EDDA6" stroke="#14211F" stroke-width="2"/>`,
      `<path d="M19 60h12l7-20h42l11 20v17H19z" fill="#F4735B" stroke="#14211F" stroke-width="2" stroke-linejoin="round"/><path d="M42 44h14v14H36zm18 0h15l8 14H60z" fill="#FBF4DC"/><circle cx="35" cy="76" r="7" fill="#14211F"/><circle cx="77" cy="76" r="7" fill="#14211F"/>`,
    ],
    agua: [
      `<path d="M56 20S31 48 31 62a25 25 0 0 0 50 0c0-14-25-42-25-42Z" fill="#8C9BE8" stroke="#14211F" stroke-width="2"/><circle cx="48" cy="57" r="3" fill="#14211F"/><circle cx="65" cy="57" r="3" fill="#14211F"/><path d="M48 68q8 8 17 0" fill="none" stroke="#14211F" stroke-width="2.5" stroke-linecap="round"/>`,
      `<circle cx="53" cy="31" r="11" fill="#F5B93F"/><path d="M53 43v29m0-17-17 11m17-11 17 11m-17 6-12 13m12-13 12 13" fill="none" stroke="#14211F" stroke-width="5" stroke-linecap="round"/><path d="M29 41q-8 8 0 13m-7-19q-13 13 0 26m61-20q8 8 0 13" fill="none" stroke="#8C9BE8" stroke-width="3" stroke-linecap="round"/>`,
      `<path d="M36 70q-1-27 20-36 21 9 20 36" fill="#6EDDA6" stroke="#14211F" stroke-width="2"/><path d="M56 35V20m0 17L43 26m13 14 14-15" stroke="#14211F" stroke-width="2.5" stroke-linecap="round"/><path d="M52 60c-4 5-5 8-5 10a7 7 0 0 0 14 0c0-2-2-6-5-10" fill="#8C9BE8"/><circle cx="49" cy="48" r="2" fill="#14211F"/><circle cx="64" cy="48" r="2" fill="#14211F"/><path d="M51 55q5 4 10 0" fill="none" stroke="#14211F" stroke-width="2"/>`,
      `<path d="M30 38h38v9H30zm9 9v-9m20 9v-9" stroke="#14211F" stroke-width="4" stroke-linecap="round"/><path d="M68 43h13q10 0 10 9v8H68z" fill="#F5B93F" stroke="#14211F" stroke-width="2"/><path d="M82 60c-5 7-5 10 0 13 5-3 5-6 0-13Z" fill="#8C9BE8"/>`,
    ],
    residuos: [
      `<path d="m54 26 9 14-11 1m11-1 9-13m-9 13 9 1m4 16-16 4 5 10m-5-10 2-9m-2 9-5 8M39 55l-1 17-11-4m11 4 8 6m-8-6-10-2" fill="none" stroke="#6EDDA6" stroke-width="5" stroke-linejoin="round"/><circle cx="55" cy="47" r="13" fill="#8C9BE8" stroke="#14211F" stroke-width="2"/><circle cx="51" cy="46" r="2" fill="#14211F"/><circle cx="59" cy="46" r="2" fill="#14211F"/><path d="M51 52q4 4 8 0" fill="none" stroke="#14211F" stroke-width="2"/>`,
      `<path d="M30 36h51v39H30z" fill="#F5B93F" stroke="#14211F" stroke-width="2"/><path d="m30 46 25 14 26-14M55 60v15" fill="none" stroke="#14211F" stroke-width="2"/><circle cx="46" cy="52" r="2" fill="#14211F"/><circle cx="63" cy="52" r="2" fill="#14211F"/><path d="M47 62q7 6 14 0" fill="none" stroke="#14211F" stroke-width="2"/>`,
      `<path d="M24 47h24v29H24zm31 0h24v29H55zm-16-14h24v29H39z" fill="#6EDDA6" stroke="#14211F" stroke-width="2"/><path d="m46 40 5 8h-10zM32 54v13m31-13v13" stroke="#14211F" stroke-width="2" stroke-linecap="round"/><circle cx="35" cy="55" r="2" fill="#14211F"/><circle cx="66" cy="55" r="2" fill="#14211F"/>`,
      `<path d="M35 39h40l-4 39H39z" fill="#F4735B" stroke="#14211F" stroke-width="2"/><path d="M30 34h50m-31 0v-5h12v5" stroke="#14211F" stroke-width="3" stroke-linecap="round"/><circle cx="49" cy="54" r="2.5" fill="#14211F"/><circle cx="62" cy="54" r="2.5" fill="#14211F"/><path d="M50 64q6 5 12 0" fill="none" stroke="#14211F" stroke-width="2"/>`,
    ],
    plásticos: [
      `<path d="M34 40h45l-4 39H38z" fill="#F4735B" stroke="#14211F" stroke-width="2"/><path d="M45 40q0-14 12-14t12 14m-16 16q7-8 14 0m-7-11v20" fill="none" stroke="#14211F" stroke-width="2.5"/><circle cx="49" cy="53" r="2" fill="#14211F"/><circle cx="65" cy="53" r="2" fill="#14211F"/>`,
      `<path d="M48 25h16v11l8 8v34H40V44l8-8z" fill="#8C9BE8" stroke="#14211F" stroke-width="2"/><path d="M48 35h16m-16 25h16" stroke="#14211F" stroke-width="2"/><circle cx="51" cy="51" r="2" fill="#14211F"/><circle cx="61" cy="51" r="2" fill="#14211F"/><path d="M52 56q4 4 8 0" fill="none" stroke="#14211F" stroke-width="2"/>`,
      `<path d="M70 28C50 28 35 36 35 52a17 17 0 0 0 17 17c17 0 25-16 18-41Z" fill="#6EDDA6" stroke="#14211F" stroke-width="2"/><path d="M30 80c14-20 26-31 39-38" fill="none" stroke="#14211F" stroke-width="2"/><circle cx="49" cy="51" r="2" fill="#14211F"/><circle cx="62" cy="51" r="2" fill="#14211F"/><path d="M51 58q5 5 10 0" fill="none" stroke="#14211F" stroke-width="2"/>`,
      `<path d="M43 24h21l3 10-3 6 10 13v25H35V53l10-13-4-6z" fill="#F5B93F" stroke="#14211F" stroke-width="2"/><path d="M44 34h20m-18 27h18" stroke="#14211F" stroke-width="2"/><circle cx="49" cy="51" r="2" fill="#14211F"/><circle cx="61" cy="51" r="2" fill="#14211F"/><path d="M50 56q5 5 10 0" fill="none" stroke="#14211F" stroke-width="2"/>`,
    ],
    energía: [
      `<circle cx="55" cy="51" r="24" fill="#F5B93F" stroke="#14211F" stroke-width="2"/><path d="M55 17v-8m0 84v-8M21 51h-8m84 0h-8M31 27l-6-6m60 60-6-6m0-48 6-6m-60 60 6-6" stroke="#14211F" stroke-width="3" stroke-linecap="round"/><circle cx="47" cy="48" r="2" fill="#14211F"/><circle cx="63" cy="48" r="2" fill="#14211F"/><path d="M47 59q8 7 16 0" fill="none" stroke="#14211F" stroke-width="2"/>`,
      `<path d="M43 69h25m-22 7h19m-15 7h11m-7-14q0-8 8-15 7-8 7-17a20 20 0 1 0-40 0q0 9 8 18 6 6 6 14" fill="#F5B93F" stroke="#14211F" stroke-width="2"/><circle cx="46" cy="42" r="2" fill="#14211F"/><circle cx="60" cy="42" r="2" fill="#14211F"/><path d="M47 49q6 5 12 0" fill="none" stroke="#14211F" stroke-width="2"/>`,
      `<rect x="27" y="37" width="58" height="35" rx="17" fill="#6EDDA6" stroke="#14211F" stroke-width="2"/><circle cx="66" cy="54" r="13" fill="#F5B93F" stroke="#14211F" stroke-width="2"/><circle cx="43" cy="49" r="2" fill="#14211F"/><circle cx="52" cy="49" r="2" fill="#14211F"/><path d="M43 56q5 4 10 0" fill="none" stroke="#14211F" stroke-width="2"/>`,
      `<path d="M43 26h12v28q0 13 13 13t13-13V39" fill="none" stroke="#14211F" stroke-width="5" stroke-linecap="round"/><path d="M38 22h22v16H38zm37 12h13v12H75z" fill="#8C9BE8" stroke="#14211F" stroke-width="2"/><circle cx="47" cy="29" r="2" fill="#14211F"/><circle cx="52" cy="29" r="2" fill="#14211F"/><path d="m45 34 5 3 5-3" fill="none" stroke="#14211F" stroke-width="1.5"/>`,
    ],
  };
  return `<svg class="option-illustration" viewBox="0 0 120 100" aria-hidden="true"><ellipse cx="59" cy="86" rx="18" ry="3" fill="${accent}" opacity=".55"/>${characters[area][index]}${common}</svg>`;
}

function sparkles(): string {
  return `<div class="space-art" aria-hidden="true">
    <span class="star star-a">${icon("star")}</span><span class="star star-b">${icon("sparkle")}</span>
    <span class="orbit orbit-a"></span><span class="orbit orbit-b"></span>
    <span class="planet-mini planet-a"></span><span class="planet-mini planet-b"></span>
    <span class="comet comet-a"></span><span class="tiny-leaf">${icon("leaf")}</span>
    <span class="cloud cloud-a"></span><span class="cloud cloud-b"></span>
    <span class="plastic-morph morph-bottle"><i>${icon("bottle")}</i><i>${icon("leaf")}</i></span>
    <span class="plastic-morph morph-bag"><i>${icon("bag")}</i><i>${icon("leaf")}</i></span>
    <span class="windmill windmill-a"><i></i></span><span class="solar-panel"></span>
  </div>`;
}

function header(home = false): string {
  return `<header class="topbar">
    <a class="brand" href="#inicio" aria-label="ECOESPEJO, ir al inicio"><span class="brand-mark">${icon("leaf")}</span><span>ECO<span>ESPEJO</span></span></a>
    <span class="topbar-tag">${home ? "UNA EXPERIENCIA PARA EMPEZAR" : "TU VIAJE SOSTENIBLE"}</span>
    ${home ? '<span class="topbar-language">PERÚ · MODO DEMO</span>' : '<span class="local-pill"><i></i> Modo demo local</span>'}
  </header>`;
}

function homeScreen(): string {
  return `<main class="screen home-screen">${sparkles()}${header(true)}
    <div class="home-content">
      <div class="home-copy">
        <span class="eyebrow"><span class="eyebrow-dot"></span> UNA PAUSA PARA MIRAR DISTINTO</span>
        <h1>Cinco decisiones<br>cotidianas.<br><em>Una nueva visión</em><br>de tu impacto.</h1>
        <p class="tagline">Tu huella de hoy. El futuro de mañana.</p>
        <p class="home-description">Descubre cómo tus hábitos de cada día pueden abrirle camino a un futuro más verde.</p>
        <div class="home-actions">
          <button class="button button-primary" data-action="start">Descubrir mi huella <span>${icon("arrow")}</span></button>
          <button class="button button-quiet" data-action="demo">${icon("sparkle")} Ver demo</button>
        </div>
        <div class="trust-line"><span>1 minuto</span><b></b><span>Gratis</span><b></b><span>Sin registro</span></div>
      </div>
      <div class="home-visual" aria-label="Ilustración del planeta Tierra sonriente">
        <div class="glow-orbit orbit-one"></div><div class="glow-orbit orbit-two"></div>
        <span class="float-card card-leaf">${icon("leaf")}<span>Pequeños pasos,<br>grandes posibilidades</span></span>
        <span class="float-card card-water">${icon("drop")}<span>Un mundo<br>por cuidar</span></span>
        <span class="visual-spark visual-spark-one">${icon("star")}</span><span class="visual-spark visual-spark-two">${icon("sparkle")}</span>
        ${globe(90, true)}
        <div class="planet-caption"><span>HOLA, FUTURO</span><i></i><span>LISTO PARA EMPEZAR</span></div>
      </div>
    </div>
    <footer class="screen-foot"><span>EXPERIENCIA EDUCATIVA · HECHA PARA EL PLANETA</span><span>01 / 04</span></footer>
  </main>`;
}

function questionScreen(index: number): string {
  const question = questions[index];
  const selected = answers[question.area];
  const mood = Number.isFinite(selected) ? selected : 60;
  return `<main class="screen quiz-screen">${sparkles()}${header()}
    <div class="quiz-progress">
      <button class="back-button" data-action="back" aria-label="${index === 0 ? "Volver al inicio" : "Pregunta anterior"}">${icon("arrow")} <span>ATRÁS</span></button>
      <div class="progress-center"><span class="progress-label">PREGUNTA 0${index + 1} DE 05</span><div class="progress-track" role="progressbar" aria-label="Progreso de preguntas" aria-valuenow="${index + 1}" aria-valuemin="1" aria-valuemax="5"><i style="width:${((index + 1) / 5) * 100}%"></i></div><span class="progress-count">0${index + 1}<small> / 05</small></span></div>
      <span class="step-number">PASO 0${index + 1}</span>
    </div>
    <section class="question-stage" aria-labelledby="question-title">
      <div class="question-heading"><span class="eyebrow"><span class="eyebrow-dot"></span> ${question.eyebrow}</span><h1 id="question-title">${question.title}</h1><p>Elige la opción que más se acerca a tu día a día.</p></div>
      <div class="question-planet">${globe(mood)}<span class="planet-glimmer"></span><span class="planet-note">${selected >= 80 ? "¡SE NOTA!" : selected <= 35 ? "TODO PASO CUENTA" : "SIN JUICIOS, SOLO IDEAS"}</span></div>
      <div class="options-grid" role="group" aria-label="Opciones para ${question.area}">
        ${question.options.map((option, optionIndex) => `<button class="answer-card ${selected === option.score ? "is-selected" : ""}" data-action="answer" data-value="${option.score}" aria-pressed="${selected === option.score}">
          <span class="illustration-wrap">${optionIllustration(question.area, optionIndex)}</span><span class="answer-copy"><strong>${option.label}</strong><small>${option.detail}</small><i class="answer-underline"></i></span><span class="answer-check">${icon("check")}</span>
        </button>`).join("")}
      </div>
    </section>
    <footer class="quiz-footer"><span>NO HAY RESPUESTAS PERFECTAS. SOLO TU PUNTO DE PARTIDA.</span><button class="button button-primary next-button" data-action="next" ${Number.isFinite(selected) ? "" : "disabled"}>${index === 4 ? "Ver mi resultado" : "Continuar"} <span>${icon("arrow")}</span></button></footer>
  </main>`;
}

function analysisScreen(): string {
  return `<main class="screen analysis-screen">${sparkles()}${header()}
    <section class="analysis-content" aria-live="polite">${globe(84)}
      <span class="eyebrow"><span class="eyebrow-dot"></span> UN MOMENTO PARA CONECTAR TUS IDEAS</span>
      <h1>Armando una nueva<br><em>perspectiva.</em></h1>
      <p>Este es un cálculo local del programa. Tus respuestas no salen de este dispositivo.</p>
      <div class="analysis-steps"><div class="analysis-step active" data-step="0"><span>01</span>Organizando tus respuestas<i></i></div><div class="analysis-step" data-step="1"><span>02</span>Construyendo tu perfil ambiental<i></i></div><div class="analysis-step" data-step="2"><span>03</span>Preparando tus recomendaciones<i></i></div></div>
    </section>
    <footer class="screen-foot"><span>TODO SE PROCESA EN TU NAVEGADOR</span><span>${icon("sparkle")}</span></footer>
  </main>`;
}

function cityIllustration(focus: Area): string {
  const feature = focus === "energía"
    ? '<g class="city-focus"><path d="m93 104 20-9 17 10-20 9-17-10Zm4-3 1 11m8-14 1 11m8-8 1 11" fill="#247c87" stroke="#aef46f" stroke-width="1.5"/><path d="M185 80v22m-9-22 9-7 9 7m-17 0h17m-9-7v28" stroke="#c8ed77" stroke-width="2" fill="none"/></g>'
    : focus === "transporte"
      ? '<g class="city-focus"><path d="M147 128h70" stroke="#b9f275" stroke-width="3" stroke-dasharray="5 5"/><path d="M159 119h34a4 4 0 0 1 4 4v8h-42v-8a4 4 0 0 1 4-4Z" fill="#ff956e"/><circle cx="162" cy="133" r="3" fill="#f5dc83"/><circle cx="190" cy="133" r="3" fill="#f5dc83"/><path d="M164 120v7m14-7v7m-12-7h11" stroke="#f4ffe4" stroke-width="1.5"/></g>'
      : '<g class="city-focus"><path d="M193 117c-1-13 7-19 16-21-1 13-7 19-16 21Zm0 0c0-11-5-16-12-18 0 10 4 16 12 18Z" fill="#a3ed65"/><path d="M193 117v13m37-24c-1-12 7-18 15-20-1 12-6 18-15 20Zm0 0c0-10-5-15-12-17 0 10 4 15 12 17Z" fill="#a3ed65"/><path d="M230 106v24" stroke="#9fc883" stroke-width="2"/></g>';
  return `<svg class="future-city" viewBox="0 0 300 168" role="img" aria-label="Ciudad futura sostenible con énfasis en ${focus}">
    <defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="#3A93A6"/><stop offset="1" stop-color="#2B7A8F"/></linearGradient></defs>
    <path d="M0 0h300v168H0z" fill="url(#sky)"/><circle cx="241" cy="34" r="17" fill="#F5B93F"/><path d="M0 105 39 72l33 31 35-52 48 56 38-38 48 40 24-27 35 32v54H0Z" fill="#1F6678" opacity=".55"/>
    <g class="city-silhouette" fill="#8C9BE8"><path d="M13 103h30v55H13zm36-25h33v80H49zm39 16h27v64H88zm36-35h36v99h-36zm42 40h26v59h-26zm32-15h30v74h-30zm36 21h29v53h-29zm36-10h20v63h-20zm27 14h21v49h-21z"/></g>
    <g class="city-windows" fill="#F5B93F"><path d="M57 88h6v7h-6zm13 0h6v7h-6zm-13 14h6v7h-6zm13 0h6v7h-6zm-13 14h6v7h-6zm13 0h6v7h-6zm70-29h6v7h-6zm13 0h6v7h-6zm-13 14h6v7h-6zm13 0h6v7h-6zm-13 15h6v7h-6zm48-3h6v7h-6zm14 0h6v7h-6z"/></g>
    <path d="M0 148q39-13 76 0t75 0 75 0 74 0v20H0Z" fill="#1F6678"/><g class="city-green"><path d="M8 135c-2-11 4-17 11-19-1 11-4 16-11 19Zm0 0c0-9-4-13-10-15 0 8 3 13 10 15Zm22 5c-1-12 5-18 12-19-1 11-5 16-12 19Zm0 0c0-9-4-13-10-15 0 8 3 13 10 15Z" fill="#6EDDA6"/><path d="M8 134v15m22-10v10" stroke="#F5B93F" stroke-width="1.5"/></g>
    ${feature}
  </svg>`;
}

function resultScreen(): string {
  const score = calculateScore(answers);
  const profile = profileFor(score);
  const priority = prioritizeAreas(answers);
  const challenge = createChallenge(priority[0]);
  const recommendations = currentResult?.recommendations ?? [];
  const label = currentResult?.source === "ia" ? "Resultado con IA" : "Resultado local";
  const contribution = [...areas].sort((a, b) => answers[b] - answers[a]).slice(0, 2);
  return `<main class="result-screen">
    <div class="result-top">${header()}<div class="result-kicker"><span class="eyebrow-dot"></span> TU REFLEJO, UNA NUEVA POSIBILIDAD</div></div>
    <section class="result-hero">
      <div class="result-copy"><span class="eyebrow"><span class="eyebrow-dot"></span> ${label.toUpperCase()}</span><h1>${profile.name}<br><em>en movimiento.</em></h1><p>${profile.description}</p><div class="result-actions">
        <button class="button button-primary" data-action="share">${icon("sparkle")} Compartir mi reto</button>
        <button class="button button-outline" data-action="retry">Volver a intentarlo</button>
      </div>${aiNotice ? `<p class="ai-notice" role="status">${aiNotice}</p>` : ""}${aiReady && currentResult?.source !== "ia" ? '<button class="ai-button" data-action="ai">Mejorar con IA <span>Opcional · requiere conexión</span></button>' : ""}
      </div>
      <div class="score-card"><div class="score-orbit"></div><div class="score-ring" role="img" aria-label="Puntuación orientativa: ${score} de 100" style="--score:0"><div class="score-inner"><strong data-score="${score}">0</strong><span>DE 100</span></div></div><span class="score-caption">TU PUNTUACIÓN<br><b>ORIENTATIVA</b></span><span class="score-spark">${icon("star")}</span></div>
    </section>
    <p class="disclaimer">Puntuación educativa y orientativa; no es una huella de carbono medida científicamente ni una evaluación certificada.</p>
    <section class="result-grid">
      <article class="result-panel recommendation-panel"><div class="panel-heading"><span class="panel-index">01 / IDEAS PARA TI</span><h2>Pequeños pasos,<br><em>cambio real.</em></h2><p>Una idea a la vez. Adáptala a lo que sí funciona en tu día.</p></div>
        <div class="recommendation-list">${recommendations.map((text, index) => `<div class="recommendation-item"><span class="list-number">0${index + 1}</span><p>${escapeHTML(text)}</p><span class="recommendation-spark">${icon(index === 1 ? "drop" : "leaf")}</span></div>`).join("")}</div>
        <button class="text-button" data-action="how">¿Cómo se calculó? ${icon("arrow")}</button>
      </article>
      <article class="result-panel challenge-panel"><div class="panel-heading"><span class="panel-index">02 / TU RETO DE 7 DÍAS</span><h2>Una semana.<br><em>Un nuevo hábito.</em></h2><p>Tu primera idea parte de <b>${priority[0]}</b>. Sin perfección, a tu manera.</p></div>
        <ol class="challenge-list">${challenge.map((item, index) => `<li><span>${index + 1}</span><p><b>DÍA 0${index + 1}</b>${escapeHTML(item)}</p><i></i></li>`).join("")}</ol>
      </article>
    </section>
    <section class="future-panel"><div class="future-copy"><span class="panel-index">03 / UNA VISIÓN DE FUTURO</span><h2>Imagina lo que<br><em>podemos construir.</em></h2><p>Una ciudad con más ${priority[0] === "energía" ? "energía limpia" : priority[0] === "transporte" ? "formas de movernos" : "verde y naturaleza"} empieza con decisiones cotidianas, compartidas por muchas personas.</p><div class="city-label">${icon("sparkle")} UNA CIUDAD QUE APRENDE CONTIGO</div></div><div class="city-scene">${cityIllustration(priority[0])}<span class="city-horizon"></span><span class="city-caption">EL FUTURO TAMBIÉN SE CULTIVA.</span></div></section>
    <section class="habit-panel"><div><span class="panel-index">04 / LO QUE YA ESTÁS HACIENDO BIEN</span><h2>Tus hábitos que<br><em>abren camino.</em></h2><p>La puntuación es un promedio simple: cada área aporta por igual. Tus respuestas más sostenibles también cuentan.</p></div><div class="strength-list">${contribution.map((area, index) => `<div><span>0${index + 1}</span><b>${area}</b><i style="--strength:${answers[area]}%"></i><strong>${answers[area]}</strong></div>`).join("")}</div></section>
    <section class="commitment-card"><span class="commitment-orbit"></span><span class="panel-index">UN COMPROMISO, A TU MANERA</span><h2>Mi compromiso<br><em>ECOESPEJO</em></h2><p>Esta semana elijo empezar con:</p><div class="commitment-line">${escapeHTML(challenge[0])}</div><div class="commitment-footer"><span>UN PASO POSIBLE. UN FUTURO COMPARTIDO.</span><button class="button button-light" data-action="share">${icon("sparkle")} Compartir mi compromiso</button></div></section>
    <section class="how-panel"><div><span class="panel-index">TRANSPARENCIA, SIEMPRE</span><h2>¿Cómo funciona?</h2></div><div class="how-copy"><p>En modo demo, tu navegador calcula el promedio de cinco respuestas, propone recomendaciones programadas y genera un reto desde plantillas locales. No se usa IA para crear este resultado.</p><button class="text-button" data-action="how">Ver las reglas del cálculo ${icon("arrow")}</button></div></section>
    <footer class="result-footer"><a class="brand" href="#inicio"><span class="brand-mark">${icon("leaf")}</span><span>ECO<span>ESPEJO</span></span></a><span>Tu huella de hoy. El futuro de mañana.</span><button class="button button-quiet" data-action="retry">Empezar de nuevo ${icon("arrow")}</button></footer>
  </main>`;
}

function escapeHTML(text: string): string {
  return text.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
}

function showErrorBoundary(error: unknown): void {
  const detail = error instanceof Error ? error.message : "Ocurrió un problema inesperado.";
  if (!root) return;
  root.innerHTML = `<main class="error-screen">${sparkles()}<div class="error-card"><span class="brand-mark">${icon("leaf")}</span><span class="eyebrow">UN PEQUEÑO TROPIEZO</span><h1>Volvamos a intentarlo.</h1><p>${escapeHTML(detail)}</p><button class="button button-primary" data-action="retry-render">Reintentar</button><button class="button button-quiet" data-action="reset">Reiniciar experiencia</button></div></main>`;
  root.querySelector<HTMLButtonElement>('[data-action="retry-render"]')?.addEventListener("click", () => render());
  root.querySelector<HTMLButtonElement>('[data-action="reset"]')?.addEventListener("click", () => restart());
}

function render(): void {
  try {
    if (route.screen === "question" && !allAnswered() && route.index > 0 && !areas.slice(0, route.index).every((area) => Number.isFinite(answers[area]))) {
      route = { screen: "question", index: Math.max(0, areas.findIndex((area) => !Number.isFinite(answers[area]))) };
      history.replaceState(null, "", `${location.pathname}${location.search}#pregunta/${route.index}`);
    }
    if ((route.screen === "analysis" || route.screen === "result") && !allAnswered()) {
      route = { screen: "home" };
      history.replaceState(null, "", `${location.pathname}${location.search}#inicio`);
    }
    document.body.dataset.screen = route.screen;
    root!.innerHTML = route.screen === "home" ? homeScreen() : route.screen === "question" ? questionScreen(route.index) : route.screen === "analysis" ? analysisScreen() : resultScreen();
    bindEvents();
    if (route.screen === "analysis") beginAnalysis();
    if (route.screen === "result") animateScore();
  } catch (error) {
    showErrorBoundary(error);
  }
}

function beginAnalysis(): void {
  window.clearTimeout(analysisTimer);
  const startedAt = performance.now();
  const stages = root!.querySelectorAll<HTMLElement>(".analysis-step");
  const tick = (): void => {
    const elapsed = performance.now() - startedAt;
    const active = Math.min(2, Math.floor(elapsed / 730));
    stages.forEach((stage, index) => stage.classList.toggle("active", index === active));
    if (elapsed >= 2200) {
      void localProvider.getRecommendations(answers, calculateScore(answers)).then((result) => {
        currentResult = result;
        setRoute({ screen: "result" }, true);
      }).catch(showErrorBoundary);
      return;
    }
    analysisTimer = window.setTimeout(tick, 120);
  };
  analysisTimer = window.setTimeout(tick, 120);
}

function animateScore(): void {
  const element = root!.querySelector<HTMLElement>("[data-score]");
  const ring = root!.querySelector<HTMLElement>(".score-ring");
  if (!element) return;
  const target = Number(element.dataset.score);
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    element.textContent = String(target);
    ring?.style.setProperty("--score", String(target));
    root!.querySelector(".future-panel")?.classList.add("city-revealed");
    return;
  }
  const started = performance.now();
  const step = (now: number): void => {
    const progress = Math.min(1, (now - started) / 1100);
    const eased = 1 - Math.pow(1 - progress, 3);
    element.textContent = String(Math.round(target * eased));
    ring?.style.setProperty("--score", String(target * eased));
    if (progress < 1) requestAnimationFrame(step);
    else root!.querySelector(".future-panel")?.classList.add("city-revealed");
  };
  requestAnimationFrame(step);
}

function restart(): void {
  window.clearTimeout(analysisTimer);
  answers = emptyAnswers();
  isDemo = false;
  currentResult = null;
  aiNotice = "";
  try {
    sessionStorage.removeItem("ecoespejo-session");
  } catch (error) {
    console.warn("No se pudo borrar la sesión local guardada.", error);
  }
  setRoute({ screen: "home" });
}

function startDemo(): void {
  answers = { transporte: 80, agua: 55, residuos: 100, plásticos: 80, energía: 80 };
  isDemo = true;
  currentResult = { recommendations: localRecommendations(answers), source: "local" };
  persistAnswers();
  aiNotice = "";
  setRoute({ screen: "result" });
}

function safeHandler(handler: (event: Event) => void): (event: Event) => void {
  return (event): void => {
    try {
      handler(event);
    } catch (error) {
      showErrorBoundary(error);
    }
  };
}

function bindEvents(): void {
  root!.querySelectorAll<HTMLButtonElement>("button[data-action]").forEach((button) => button.addEventListener("click", safeHandler(() => {
    const action = button.dataset.action;
    if (action === "start") {
      answers = emptyAnswers();
      isDemo = false;
      currentResult = null;
      persistAnswers();
      setRoute({ screen: "question", index: 0 });
    } else if (action === "demo") startDemo();
    else if (action === "answer" && route.screen === "question") {
      answers[questions[route.index].area] = Number(button.dataset.value);
      persistAnswers();
      render();
    } else if (action === "back") {
      if (route.screen !== "question") return;
      if (route.index === 0) setRoute({ screen: "home" });
      else setRoute({ screen: "question", index: route.index - 1 });
    } else if (action === "next" && route.screen === "question" && Number.isFinite(answers[questions[route.index].area])) {
      if (route.index < questions.length - 1) setRoute({ screen: "question", index: route.index + 1 });
      else setRoute({ screen: "analysis" });
    } else if (action === "retry") restart();
    else if (action === "how") showCalculationDialog();
    else if (action === "share") void shareChallenge();
    else if (action === "ai") void improveWithAI();
  })));
  root!.querySelectorAll<HTMLAnchorElement>('a[href="#inicio"]').forEach((link) => link.addEventListener("click", safeHandler((event) => {
    event.preventDefault();
    setRoute({ screen: "home" });
  })));
}

function showCalculationDialog(): void {
  const dialog = document.createElement("dialog");
  dialog.className = "calculation-dialog";
  dialog.innerHTML = `<div class="dialog-inner"><button class="dialog-close" aria-label="Cerrar">×</button><span class="panel-index">TRANSPARENCIA, SIEMPRE</span><h2>¿Cómo se calculó?</h2><p>En este prototipo usamos un cálculo local, programado y educativo. No se envió información a un servidor y no se usó inteligencia artificial.</p><ul><li>Cada pregunta representa un área y vale lo mismo: un quinto del promedio.</li><li>Las cuatro opciones reciben puntajes orientativos de 25, 55, 80 o 100, según el hábito descrito.</li><li>El resultado es el promedio redondeado de tus cinco respuestas, de 0 a 100.</li><li>Tu perfil se asigna por rangos. Las recomendaciones y el reto se eligen desde plantillas locales de tus áreas prioritarias.</li></ul><p class="dialog-note">No es una medición científica de emisiones, una evaluación certificada ni una comparación con otras personas.</p><button class="button button-primary dialog-done">Entendido</button></div>`;
  document.body.append(dialog);
  dialog.showModal();
  const close = (): void => dialog.close();
  dialog.querySelector(".dialog-close")?.addEventListener("click", close);
  dialog.querySelector(".dialog-done")?.addEventListener("click", close);
  dialog.addEventListener("close", () => dialog.remove(), { once: true });
}

async function shareChallenge(): Promise<void> {
  const focus = prioritizeAreas(answers)[0];
  const text = `Mi compromiso ECOESPEJO: esta semana quiero dar un pequeño paso por ${focus}. Tu huella de hoy. El futuro de mañana.`;
  try {
    if (navigator.share) {
      await navigator.share({ title: "Mi compromiso ECOESPEJO", text });
      return;
    }
    await navigator.clipboard.writeText(text);
    aiNotice = "¡Listo! Tu compromiso se copió para que puedas compartirlo.";
    render();
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return;
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.setAttribute("readonly", "");
    textArea.className = "copy-fallback";
    document.body.append(textArea);
    textArea.select();
    const copied = document.execCommand("copy");
    textArea.remove();
    aiNotice = copied ? "¡Listo! Tu compromiso se copió para que puedas compartirlo." : "No pudimos copiarlo automáticamente. Selecciona y copia el texto: " + text;
    render();
  }
}

async function improveWithAI(): Promise<void> {
  if (!remoteProvider || !aiReady) return;
  try {
    currentResult = await remoteProvider.getRecommendations(answers, calculateScore(answers));
    aiNotice = "";
  } catch {
    currentResult = { recommendations: localRecommendations(answers), source: "local" };
    aiNotice = "No se pudo conectar con la IA; mostramos el resultado local.";
  }
  render();
}

window.addEventListener("hashchange", safeHandler(() => {
  route = routeFromHash();
  if (route.screen === "analysis" && !allAnswered()) route = { screen: "home" };
  render();
}));
window.addEventListener("popstate", safeHandler(() => {
  route = routeFromHash();
  render();
}));
window.addEventListener("error", (event) => {
  event.preventDefault();
  showErrorBoundary(event.error ?? new Error("Se produjo un error inesperado."));
});
window.addEventListener("unhandledrejection", (event) => {
  event.preventDefault();
  showErrorBoundary(event.reason);
});

try {
  restoreAnswers();
  route = routeFromHash();
  if (route.screen === "question" && !areas.slice(0, route.index).every((area) => Number.isFinite(answers[area]))) {
    route = { screen: "question", index: Math.max(0, areas.findIndex((area) => !Number.isFinite(answers[area]))) };
  }
  if (route.screen === "result" && !allAnswered()) route = { screen: "home" };
  if (route.screen === "result" && allAnswered()) currentResult = { recommendations: localRecommendations(answers), source: "local" };
  render();
} catch (error) {
  showErrorBoundary(error);
}

if (remoteProvider) void checkAIAvailability(endpoint).then((available) => {
  aiReady = available;
  if (route.screen === "result") render();
});

window.addEventListener("pointermove", (event) => {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const x = (event.clientX / window.innerWidth - 0.5) * 8;
  const y = (event.clientY / window.innerHeight - 0.5) * 8;
  document.documentElement.style.setProperty("--pointer-x", `${x}px`);
  document.documentElement.style.setProperty("--pointer-y", `${y}px`);
}, { passive: true });
