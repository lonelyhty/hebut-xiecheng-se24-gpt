import fs from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../frontend/assets");
await fs.mkdir(root, { recursive: true });
const scenes = {
  chengdu: {
    sky: "#a9c2bd",
    sky2: "#e2d5b5",
    water: "#658a80",
    land: "#294f46",
    sun: "#eadfc3",
    type: "pagoda",
    title: "成都 · 青城山水",
  },
  sanya: {
    sky: "#83c8d8",
    sky2: "#d0e5de",
    water: "#3894a4",
    land: "#e7d6ad",
    sun: "#fff0c3",
    type: "beach",
    title: "三亚 · 海棠晴湾",
  },
  hangzhou: {
    sky: "#b0c8c8",
    sky2: "#e4d8bd",
    water: "#7aaca7",
    land: "#3c7069",
    sun: "#eae1c9",
    type: "lake",
    title: "杭州 · 西湖远山",
  },
  xian: {
    sky: "#bfd0ce",
    sky2: "#e8ccb1",
    water: "#af9585",
    land: "#69594c",
    sun: "#eecab0",
    type: "wall",
    title: "西安 · 长安暮色",
  },
  beijing: {
    sky: "#b5c9d8",
    sky2: "#e6c7a8",
    water: "#829da6",
    land: "#8c6452",
    sun: "#efdbb1",
    type: "palace",
    title: "北京 · 紫禁秋光",
  },
  shanghai: {
    sky: "#8fb5c8",
    sky2: "#dfc1ac",
    water: "#56889d",
    land: "#506f80",
    sun: "#f2d3ad",
    type: "skyline",
    title: "上海 · 浦江天际",
  },
  guangzhou: {
    sky: "#94c8c9",
    sky2: "#e2d8b7",
    water: "#5d9ca3",
    land: "#557d7a",
    sun: "#f2e3bd",
    type: "tower",
    title: "广州 · 珠江云际",
  },
};
function pagoda(x, y, s = 1) {
  return `<g transform="translate(${x} ${y}) scale(${s})"><path d="M-10 0h20v-57h-20z" fill="#4e6054"/><path d="m-37-13 37-14 37 14-9 4h-56zM-30-31 30-14 30 14-7 3h-46zM-23-47 23-16 23 16-5 3h-36z" fill="#384d44"/><path d="M0-68v-11" stroke="#384d44" stroke-width="3"/><path d="M-6-5v-10H6v10" fill="#d5c7a5"/></g>`;
}
for (const [name, c] of Object.entries(scenes)) {
  let subject = "";
  if (c.type === "pagoda")
    subject = `<path d="M0 286Q80 210 180 260T370 247T600 220V400H0Z" fill="#55796b"/>${pagoda(320, 274, 1.6)}<path d="M0 347Q130 268 224 317T420 302T600 290V400H0Z" fill="#294f46"/><path d="M480 400V110M498 400V60M516 400V88" stroke="#213f37" stroke-width="9"/><g fill="#274d3e"><path d="m480 170-70-35 65 9-45-55 50 39 20-58-5 82 60-31-56 49ZM500 244l-65-31 58 3-10-48 22 35 58-30-51 53 55 18Z"/></g>`;
  if (c.type === "lake")
    subject = `<path d="M0 285Q130 247 260 279T600 270V400H0Z" fill="#80ada3"/>${pagoda(400, 260, 0.8)}<path d="M0 300Q120 280 230 294" stroke="#375f58" stroke-width="8" fill="none"/><path d="M35 301Q95 217 158 294" fill="none" stroke="#5b7668" stroke-width="13"/><path d="M35 301Q95 217 158 294" fill="none" stroke="#b4b493" stroke-width="4"/><path d="m249 320 60 0-10 9h-42z" fill="#52695c"/><path d="M283 318v-33l-17 23h17" fill="#e0d9bb"/><g fill="#325b50"><path d="M0 400V108q20 25 12 80l8 70 40 110z"/><path d="M5 132q45 25 84 14-28 31-81 4M7 163q67 0 101 60-57-20-101-43M10 226q64 11 98 79-61-26-99-65"/></g>`;
  if (c.type === "beach")
    subject = `<path d="M0 270Q170 236 350 267T600 240V400H0Z" fill="#54a8af"/><path d="M0 355Q260 257 410 292T600 280V400H0Z" fill="#b4d7c8"/><path d="M0 375Q260 280 433 318T600 306V400H0Z" fill="#efddba"/><path d="M55 400Q85 245 112 175" fill="none" stroke="#686953" stroke-width="13"/><g fill="#326d5e"><path d="M113 180Q46 119 0 172q71-17 113 8M113 180Q72 83 31 111q55 17 82 69M113 180q6-105 52-98-34 36-52 98M113 180q75-92 130-47-71 0-130 47M113 180q98-19 112 54-65-52-112-54M113 180q-38 15-65 77 1-74 65-77"/></g><path d="m445 295 58 0-13 8h-28z" fill="#6b7d72"/><path d="M472 293v-70l-38 62h38" fill="#f5f0d8"/>`;
  if (c.type === "wall" || c.type === "palace")
    subject = `<path d="M0 333H600V400H0Z" fill="#7e6d5c"/><path d="M0 300H600V351H0Z" fill="#b29272"/><path d="M0 300v-15h30v15h30v-15h30v15h30v-15h30v15h300v-15h30v15h30v-15h30v15h30v-15h30v15h30" fill="#c5a17e"/><path d="M183 297V195H417V297" fill="${c.type === "palace" ? "#9a5848" : "#a57c5a"}"/><path d="M170 231h260l-25-21H195Z" fill="#736348"/><path d="m155 196 145-30 145 30-28 12H183z" fill="#5d6656"/><path d="M221 165v-46h158v46" fill="#ac7d52"/><path d="m195 119 105-36 105 36-22 10H217z" fill="#72765b"/><path d="M278 297v-40q22-29 44 0v40" fill="#4e4b43"/><path d="M237 238v56M264 237v56M338 237v56M365 237v56" stroke="#ceab7d" stroke-width="6"/><g fill="#c2aa7b"><rect x="240" y="139" width="19" height="22"/><rect x="291" y="139" width="19" height="22"/><rect x="342" y="139" width="19" height="22"/></g>`;
  if (c.type === "skyline" || c.type === "tower")
    subject = `<path d="M0 312H600V400H0Z" fill="#668d9a"/><g fill="#6c8c96">${Array.from(
      { length: 14 },
      (_, i) => {
        const h = 40 + ((i * 53) % 110);
        return `<path d="M${i * 48 - 10} 305v-${h}h33v${h}Z"/>`;
      },
    ).join(
      "",
    )}</g><g fill="#536f80"><path d="M326 300V120l25-46 23 46v180Z"/><path d="M399 300V92l18-12 18 14v206Z"/><path d="M460 300V170h47v130Z"/></g>${c.type === "skyline" ? '<g fill="#8a7e84"><path d="M178 300 192 170h8l14 130Z"/><path d="M196 175V61" stroke="#6c7380" stroke-width="4"/><circle cx="196" cy="168" r="23"/><circle cx="196" cy="105" r="14"/><path d="M160 300h72v12h-72Z"/></g>' : '<path d="M187 302Q222 208 191 92M221 302Q185 208 217 92M195 270l23-23-29-22 30-22-25-23 22-22-20-21 19-20" fill="none" stroke="#8c8890" stroke-width="6"/>'}<path d="M0 338q160-18 300-2t300-8" stroke="#a2b4b3" stroke-width="2" fill="none"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400" role="img" aria-label="${c.title}"><defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="${c.sky}"/><stop offset="1" stop-color="${c.sky2}"/></linearGradient><linearGradient id="mist" x2="0" y2="1"><stop stop-color="${c.water}" stop-opacity=".1"/><stop offset="1" stop-color="${c.water}" stop-opacity=".7"/></linearGradient></defs><rect width="600" height="400" fill="url(#sky)"/><circle cx="430" cy="105" r="38" fill="${c.sun}" opacity=".75"/><path d="M0 254 85 168 141 203 241 111 333 191 405 160 511 220 600 165V400H0Z" fill="${c.land}" opacity=".12"/><path d="M0 275 97 225 180 247 286 177 396 244 477 209 600 253V400H0Z" fill="${c.land}" opacity=".2"/><rect y="260" width="600" height="140" fill="url(#mist)"/>${subject}<path d="M0 391H600" stroke="${c.land}" opacity=".05" stroke-width="18"/></svg>`;
  await fs.writeFile(path.join(root, name + ".svg"), svg);
}
console.log("Created 7 original SVG destination illustrations.");
