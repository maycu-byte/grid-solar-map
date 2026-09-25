// The Models and Sources tabs in English, Portuguese and German.
const GH = "https://github.com/maycu-byte/lv-grid-stress-test/blob/main/";
const a = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;
const code = (path) => a(GH + path, `<code>${path.split("/").pop()}</code>`);

const EQ = {
  place: "unit ≥ 135 kW → nearest MV bus<br>30 kW ≤ unit &lt; 135 kW → nearest bus<br>postcode only → P<sub>postcode</sub> / N<sub>buildings in cell</sub> per building",
  worst: "P<sub>load</sub> = 0.10·P<sub>peak</sub> (LV), 0.15·P<sub>peak</sub> (MV)<br>P<sub>PV</sub> = 0.85·P<sub>rated</sub>,  P<sub>other</sub> = P<sub>rated</sub><br>0.90 ≤ V ≤ 1.10 pu,  loading ≤ 100%",
  roof: "k<sub>g</sub> = max { k ∈ {1, 1.1, … 10} : LV grid g within limits with k·P<sub>rooftop</sub> }<br>room = Σ<sub>g</sub> (k<sub>g</sub> − 1)·P<sub>rooftop,g</sub>",
  firm: "P<sub>firm</sub> = max P : loading of the HV/MV transformers ≤ 100%<br>with the largest transformer out (n-1)",
  head: "G(t) = E<sub>max</sub> − E(t) − 0.05·S<sub>n-1</sub><br>E(t) = PV·pv(t) + W·w(t) + P<sub>other</sub> − L·ℓ(t)<br>c(t) = max(0, (P<sub>firm</sub> + X)·pv(t) − max(0, G(t)))",
  rules: "pro rata: loss = Σ c(t) / (X·Σ pv(t))<br>LIFO, plant b of B: loss<sub>b</sub> = [C(b·X/B) − C((b−1)·X/B)] / (X/B·Σ pv(t))",
  prof: "pv(t) = 0.85·GHI(t) / 1000 W/m²<br>w(t) = (v³ − 3³)/(12³ − 3³), 0 below 3 and from 25 m/s<br>ℓ(t) = load(t) / max load",
};

const CARDS = {
  en: [
    ["place", "Placing the register on the grid", "97% of the units publish only a postcode. Their capacity is spread equally over the buildings inside an approximate postcode area (the Voronoi cell of its centre).", "Spreading by existing PV or by peak load piled whole postcodes onto a few buses and overloaded their cables. Units above 135 kW connect at medium voltage in Germany (VDE-AR-N 4105 covers low voltage)."],
    ["worst", "Worst feed-in case and limits", "The planning case of eDisGo, the tool the ding0 grids were made for.", "A grid is planned for its worst credible hour: strong sun and little consumption. The limits are the ones of the LV study (EN 50160 voltage band, thermal loading)."],
    ["roof", "Rooftop room per LV grid", "Today's rooftop PV is scaled in steps and every LV grid keeps the last factor at which its own transformer, cables and buses stay within limits.", "A single number for a whole district would be set by its weakest street. Per LV grid, the map can say how many streets could double their solar."],
    ["firm", "Firm room at the substation", "New feed-in at the MV busbar, found by bisection. The tap changer holds the busbar voltage, and a plant on the busbar does not load the feeders, so only the HV/MV transformers limit it.", "Operators plan substations so that they still work with one transformer out: n-1 is the firm room a new connection can be promised."],
    ["head", "Hourly headroom in 2025", "E<sub>max</sub> is the export the n-1 transformers carry in the worst case; E(t) is what the district already exports in hour t. 5% of the n-1 capacity is kept in reserve.", "The worst case (full wind, strong sun, little load) is rare. The real hours of 2025 show how often new plants would actually meet the limit. Full power flows on the tightest hours showed the linear model to be up to 4% optimistic, hence the reserve."],
    ["rules", "Two curtailment rules", "C(X) is the curtailment of X MW of flexible PV; B = 4 plants of equal size join one after the other.", "Who pays for a flexible connection matters as much as its size: De Santi et al. (2025) found pro rata fairer but about 20% less productive than the technically best rule. Last in, first out protects early plants and burdens the queue."],
    ["prof", "Sun, wind and load of 2025", "Irradiance and wind at 100 m from the ERA5 reanalysis for the Saarland, load as the German grid load.", "Measured weather keeps the coincidence of sun and wind real; the Saarland's own load is not published, so the national shape stands in for it."],
  ],
  pt: [
    ["place", "Colocando o cadastro na rede", "97% das unidades só publicam o CEP. A potência delas é repartida igualmente entre os prédios de uma área aproximada do CEP (a célula de Voronoi do seu centro).", "Repartir pelo solar já existente ou pela carga de pico empilhava CEPs inteiros em poucas barras e sobrecarregava os cabos. Na Alemanha, unidades acima de 135 kW se ligam em média tensão (a VDE-AR-N 4105 cobre a baixa tensão)."],
    ["worst", "Pior caso de injeção e limites", "O caso de planejamento do eDisGo, a ferramenta para a qual as redes ding0 foram feitas.", "Uma rede é planejada para a sua pior hora plausível: muito sol e pouco consumo. Os limites são os do estudo de baixa tensão (faixa de tensão da EN 50160, carregamento térmico)."],
    ["roof", "Folga para telhados por rede de baixa tensão", "O solar em telhado de hoje é aumentado em passos, e cada rede de baixa tensão guarda o último fator em que o seu transformador, os seus cabos e as suas barras continuam dentro dos limites.", "Um número único para o distrito seria definido pela rua mais fraca. Por rede de baixa tensão, o mapa consegue dizer quantas ruas poderiam dobrar o solar."],
    ["firm", "Folga firme na subestação", "Injeção nova no barramento de média tensão, achada por bisseção. O comutador de tap segura a tensão do barramento, e uma usina no barramento não carrega os alimentadores, então só os transformadores AT/MT limitam.", "As distribuidoras planejam subestações para funcionar com um transformador fora: n-1 é a folga firme que se pode prometer a uma ligação nova."],
    ["head", "Folga hora a hora em 2025", "E<sub>max</sub> é a exportação que os transformadores n-1 suportam no pior caso; E(t) é o que o distrito já exporta na hora t. 5% da capacidade n-1 fica de reserva.", "O pior caso (vento máximo, muito sol, pouca carga) é raro. As horas reais de 2025 mostram com que frequência as usinas novas encontrariam o limite de fato. Fluxos de potência completos nas horas mais apertadas mostraram o modelo linear até 4% otimista, daí a reserva."],
    ["rules", "Duas regras de corte", "C(X) é o corte de X MW de solar flexível; B = 4 usinas do mesmo tamanho entram uma depois da outra.", "Quem paga pela ligação flexível importa tanto quanto o tamanho: De Santi et al. (2025) acharam o ProRata mais justo, mas cerca de 20% menos produtivo que a regra tecnicamente melhor. A regra LIFO protege as usinas antigas e pesa sobre a fila."],
    ["prof", "Sol, vento e carga de 2025", "Irradiação e vento a 100 m da reanálise ERA5 para o Saarland, carga como a carga da rede alemã.", "O clima medido mantém real a coincidência de sol e vento; a carga do próprio Saarland não é publicada, então o formato nacional a substitui."],
  ],
  de: [
    ["place", "Das Register ins Netz legen", "97 % der Anlagen veröffentlichen nur eine Postleitzahl. Ihre Leistung wird gleichmäßig auf die Gebäude einer angenäherten PLZ-Fläche verteilt (die Voronoi-Zelle ihres Mittelpunkts).", "Eine Verteilung nach vorhandener PV oder nach Spitzenlast häufte ganze PLZ auf wenige Knoten und überlastete deren Kabel. Anlagen über 135 kW werden in Deutschland an die Mittelspannung angeschlossen (VDE-AR-N 4105 gilt für die Niederspannung)."],
    ["worst", "Ungünstigster Einspeisefall und Grenzen", "Der Planungsfall von eDisGo, dem Werkzeug, für das die ding0-Netze erstellt wurden.", "Ein Netz wird für seine ungünstigste plausible Stunde geplant: viel Sonne, wenig Verbrauch. Die Grenzen sind die der NS-Studie (Spannungsband nach EN 50160, thermische Auslastung)."],
    ["roof", "Dachspielraum je NS-Netz", "Die heutige Dach-PV wird schrittweise erhöht, und jedes NS-Netz behält den letzten Faktor, bei dem sein Transformator, seine Kabel und Knoten in den Grenzen bleiben.", "Eine einzige Zahl für den Bezirk würde von der schwächsten Straße bestimmt. Je NS-Netz kann die Karte sagen, wie viele Straßen ihre Solarleistung verdoppeln könnten."],
    ["firm", "Feste Kapazität am Umspannwerk", "Neue Einspeisung an der MS-Sammelschiene, per Bisektion. Der Stufensteller hält die Spannung der Sammelschiene, und eine Anlage an der Sammelschiene belastet die Abgänge nicht, daher begrenzen nur die HS/MS-Transformatoren.", "Netzbetreiber planen Umspannwerke so, dass sie auch mit einem ausgefallenen Transformator funktionieren: n-1 ist die feste Kapazität, die man einem neuen Anschluss zusagen kann."],
    ["head", "Stündlicher Spielraum 2025", "E<sub>max</sub> ist die Einspeisung, die die n-1-Transformatoren im ungünstigsten Fall tragen; E(t) ist, was der Bezirk in Stunde t schon einspeist. 5 % der n-1-Kapazität bleiben als Reserve.", "Der ungünstigste Fall (voller Wind, viel Sonne, wenig Last) ist selten. Die echten Stunden von 2025 zeigen, wie oft neue Anlagen tatsächlich an die Grenze stoßen. Vollständige Lastflüsse in den engsten Stunden zeigten das lineare Modell bis zu 4 % zu optimistisch, daher die Reserve."],
    ["rules", "Zwei Abregelungsregeln", "C(X) ist die Abregelung von X MW flexibler PV; B = 4 gleich große Anlagen kommen nacheinander hinzu.", "Wer den flexiblen Anschluss bezahlt, zählt so viel wie seine Größe: De Santi et al. (2025) fanden pro rata gerechter, aber etwa 20 % weniger ertragreich als die technisch beste Regel. LIFO schützt frühe Anlagen und belastet die Warteschlange."],
    ["prof", "Sonne, Wind und Last 2025", "Einstrahlung und Wind in 100 m aus der ERA5-Reanalyse für das Saarland, Last als deutsche Netzlast.", "Gemessenes Wetter hält das Zusammentreffen von Sonne und Wind echt; die Last des Saarlands wird nicht veröffentlicht, daher steht die nationale Form dafür."],
  ],
};
const WHY = { en: "Why", pt: "Por quê", de: "Warum" };
const SRC_CODE = { place: "regional/mastr_today.py", worst: "regional/capacity.py", roof: "regional/capacity.py", firm: "regional/capacity.py", head: "regional/flexible.py", rules: "regional/flexible.py", prof: "regional/profiles.py" };

export function modelsHtml(lang) {
  const intro = {
    en: "Every number on this map comes from one of these models. The full method, the validation against power flows and the limits are in " + a(GH + "docs/regional.md", "docs/regional.md") + ".",
    pt: "Cada número deste mapa vem de um destes modelos. O método completo, a validação com fluxos de potência e os limites estão em " + a(GH + "docs/regional.md", "docs/regional.md") + ".",
    de: "Jede Zahl dieser Karte stammt aus einem dieser Modelle. Die vollständige Methode, die Validierung mit Lastflüssen und die Grenzen stehen in " + a(GH + "docs/regional.md", "docs/regional.md") + ".",
  }[lang];
  return `<p class="note">${intro}</p>` + CARDS[lang].map(([k, title, params, why], i) =>
    `<div class="model"><h3><span class="n">${i + 1}</span>${title}</h3><div class="eq">${EQ[k]}</div><p>${params}</p><p><b>${WHY[lang]}.</b> ${why}</p><p class="src">${code(SRC_CODE[k])}</p></div>`).join("");
}

const SOURCES = [
  ["ding0", "https://doi.org/10.5281/zenodo.10405129", "ding0 v0.3.0-alpha (eGo^n)", { en: "Synthetic MV and LV grids of 46 of the 47 districts", pt: "Redes sintéticas de média e baixa tensão de 46 dos 47 distritos", de: "Synthetische MS- und NS-Netze von 46 der 47 Bezirke" }, "CC BY-SA 4.0", "syn"],
  ["mastr", "https://www.marktstammdatenregister.de", "Marktstammdatenregister via open-MaStR", { en: "Every operating solar unit, 10 February 2025", pt: "Cada unidade solar em operação, 10/02/2025", de: "Jede Solaranlage in Betrieb, 10. Februar 2025" }, "dl-de/by-2-0", "real"],
  ["om", "https://open-meteo.com/en/docs/historical-weather-api", "Open-Meteo, ERA5 reanalysis", { en: "Hourly irradiance and wind at 100 m, 2025", pt: "Irradiação e vento a 100 m, hora a hora, 2025", de: "Stündliche Einstrahlung und Wind in 100 m, 2025" }, "CC BY 4.0", "real"],
  ["ec", "https://api.energy-charts.info/", "Energy-Charts (Fraunhofer ISE)", { en: "German grid load 2025, as the shape of consumption", pt: "Carga da rede alemã em 2025, como formato do consumo", de: "Deutsche Netzlast 2025 als Verbrauchsprofil" }, "CC BY 4.0", "real"],
  ["osm", "https://www.openstreetmap.org/copyright", "OpenStreetMap", { en: "Names of the 110 kV substations, state boundary, postcode and municipality centres", pt: "Nomes das subestações de 110 kV, contorno do estado, centros de CEP e municípios", de: "Namen der 110-kV-Umspannwerke, Landesgrenze, PLZ- und Gemeindemittelpunkte" }, "ODbL", "real"],
  ["reg", "https://eur-lex.europa.eu/eli/reg/2024/1747/oj/eng", "Regulation (EU) 2024/1747", { en: "Operators must publish the capacity for new connections, including flexible ones", pt: "Distribuidoras devem publicar a capacidade para novas ligações, inclusive flexíveis", de: "Netzbetreiber müssen die Kapazität für neue Anschlüsse veröffentlichen, auch flexible" }, "", "law"],
  ["dir", "https://eur-lex.europa.eu/legal-content/EN/TXT/PDF/?uri=OJ%3AL_202401711", "Directive (EU) 2024/1711, Art. 6a", { en: "Framework for flexible connection agreements", pt: "Regras para ligações flexíveis", de: "Rahmen für flexible Netzanschlussvereinbarungen" }, "", "law"],
  ["enwg", "https://www.recht.bund.de/bgbl/1/2025/51/VO.html", "§ 17 (2b) EnWG, BGBl. 2025 I Nr. 51", { en: "Flexible connection agreement in Germany", pt: "Ligação flexível na Alemanha", de: "Flexible Netzanschlussvereinbarung in Deutschland" }, "", "law"],
  ["desanti", "https://doi.org/10.1016/j.apenergy.2025.126260", "De Santi, Meeus, Beckstedde, Delarue, Vitiello (2025), Applied Energy 396, 126260", { en: "Curtailment rules for flexible connections", pt: "Regras de corte para ligações flexíveis", de: "Abregelungsregeln für flexible Anschlüsse" }, "", "paper"],
  ["bnetza", "https://www.pv-magazine.de/2026/08/25/netzanschluesse-fuer-batteriespeicher-574-gigawatt-angefragt-54-gigawatt-zugesagt/", "Bundesnetzagentur monitoring 2025 (pv magazine)", { en: "406.8 GW of battery connections requested in distribution grids, 26.9 GW committed", pt: "406,8 GW de baterias pedidos nas redes de distribuição, 26,9 GW aprovados", de: "406,8 GW Speicheranschlüsse im Verteilnetz angefragt, 26,9 GW zugesagt" }, "", "paper"],
];
const KIND = {
  en: { syn: "synthetic", real: "measured", law: "law", paper: "study" },
  pt: { syn: "sintético", real: "medido", law: "lei", paper: "estudo" },
  de: { syn: "synthetisch", real: "gemessen", law: "Gesetz", paper: "Studie" },
};

export function sourcesHtml(lang) {
  const head = { en: "Every source links to its origin.", pt: "Cada fonte tem link para a origem.", de: "Jede Quelle verlinkt auf ihren Ursprung." }[lang];
  return `<p class="note">${head}</p><ul class="sources">` + SOURCES.map(([, href, title, what, lic, kind]) =>
    `<li><span class="kind ${kind}">${KIND[lang][kind]}</span> ${a(href, title)}<br><span>${what[lang]}${lic ? ` · ${lic}` : ""}</span></li>`).join("") + "</ul>";
}
