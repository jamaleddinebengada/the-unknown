/**
 * Original illustrated portraits & lifestyle scenes for AI companions.
 * Pure functions returning SVG markup (rendered with react-native-svg's SvgXml).
 * Every character keeps the same face/skin/hair/colors in all its pictures.
 */
export type AvatarSpec = {
  skin: string; hair: string; hairColor: string; eyes: string; top: string; bg: [string, string] | string[];
  face: 'oval' | 'round' | 'long'; mouth: 'smile' | 'grin' | 'soft' | 'smirk'; glasses: null | 'round' | 'square';
  freckles: boolean; beard: null | 'stubble' | 'full' | 'mustache' | 'goatee'; earrings: boolean; hijab: string | null;
  brows: 'soft' | 'straight' | 'arched'; blush: boolean;
};
export type ScenePhoto = { scene: string; emoji: string; caption: Record<string, string>; bg: string[] };

const shade = (hex: string, amt: number) => {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v + amt * 255)));
  return '#' + [f(n >> 16), f((n >> 8) & 255), f(n & 255)].map((v) => v.toString(16).padStart(2, '0')).join('');
};

function hairBack(a: AvatarSpec): string {
  const c = a.hairColor;
  switch (a.hair) {
    case 'long_straight': return `<path d="M52 92 Q50 40 100 36 Q150 40 148 92 L152 168 Q100 180 48 168 Z" fill="${c}"/>`;
    case 'long_wavy': return `<path d="M50 92 Q46 38 100 34 Q154 38 150 92 Q160 120 150 140 Q160 160 146 176 Q100 186 54 176 Q40 160 50 140 Q40 120 50 92 Z" fill="${c}"/>`;
    case 'curly': return `<g fill="${c}">${[[60,70],[80,48],[104,42],[128,50],[144,72],[150,98],[148,124],[54,98],[52,124],[62,146],[140,146]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="22"/>`).join('')}</g>`;
    case 'braids': return `<g fill="${c}"><path d="M56 90 Q54 40 100 36 Q146 40 144 90 Z"/><rect x="50" y="88" width="16" height="84" rx="8"/><rect x="134" y="88" width="16" height="84" rx="8"/></g>`;
    case 'bun': return `<circle cx="100" cy="30" r="20" fill="${c}"/>`;
    case 'ponytail': return `<path d="M138 70 Q172 90 158 150 Q150 128 140 112 Z" fill="${c}"/>`;
    case 'long_tied': return `<circle cx="100" cy="34" r="13" fill="${c}"/>`;
    default: return '';
  }
}
function hairFront(a: AvatarSpec): string {
  const c = a.hairColor; const d = shade(c, 0.08);
  switch (a.hair) {
    case 'long_straight': case 'long_wavy': case 'braids': return `<path d="M58 88 Q60 46 100 44 Q140 46 142 88 Q128 64 104 60 Q80 66 58 88 Z" fill="${c}"/><path d="M100 46 Q90 58 72 70" stroke="${d}" stroke-width="3" fill="none"/>`;
    case 'bob': return `<path d="M54 120 Q46 44 100 40 Q154 44 146 120 L136 122 Q140 80 112 64 Q84 72 64 122 Z" fill="${c}"/>`;
    case 'bun': case 'ponytail': return `<path d="M60 86 Q62 44 100 42 Q138 44 140 86 Q124 60 100 58 Q76 60 60 86 Z" fill="${c}"/>`;
    case 'curly': return `<g fill="${c}">${[[74,60],[96,52],[120,56],[136,72],[64,78]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="16"/>`).join('')}</g>`;
    case 'pixie': return `<path d="M58 92 Q56 42 102 40 Q146 44 142 84 Q120 58 92 62 Q74 70 58 92 Z" fill="${c}"/>`;
    case 'buzz': return `<path d="M62 84 Q62 46 100 44 Q138 46 138 84 Q120 66 100 66 Q80 66 62 84 Z" fill="${c}" opacity="0.85"/>`;
    case 'short': return `<path d="M60 86 Q58 42 100 40 Q142 42 140 86 Q132 64 112 60 Q86 58 60 86 Z" fill="${c}"/>`;
    case 'fade': return `<path d="M62 80 Q62 40 100 38 Q138 40 138 80 Q130 58 100 56 Q70 58 62 80 Z" fill="${c}"/>`;
    case 'quiff': return `<path d="M60 86 Q56 44 92 34 Q130 26 144 60 L140 86 Q130 58 100 56 Q76 60 60 86 Z" fill="${c}"/>`;
    case 'curly_short': return `<g fill="${c}">${[[70,64],[86,50],[104,46],[122,50],[136,64],[62,80],[140,80]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="14"/>`).join('')}</g>`;
    case 'side_part': return `<path d="M60 88 Q56 42 104 40 Q144 44 140 88 Q136 62 120 56 Q92 70 60 88 Z" fill="${c}"/><path d="M84 46 L80 62" stroke="${d}" stroke-width="2"/>`;
    case 'wavy_medium': return `<path d="M56 100 Q50 42 100 40 Q150 42 144 100 Q138 74 120 62 Q96 74 72 66 Q60 80 56 100 Z" fill="${c}"/>`;
    case 'long_tied': return `<path d="M60 86 Q60 44 100 42 Q140 44 140 86 Q124 60 100 58 Q76 60 60 86 Z" fill="${c}"/>`;
    default: return '';
  }
}

export function portraitSvg(a: AvatarSpec, opts: { round?: boolean } = {}): string {
  const skin = a.skin; const sd = shade(skin, -0.08); const top = a.top;
  const faceRx = a.face === 'round' ? 40 : a.face === 'long' ? 34 : 37; const faceRy = a.face === 'long' ? 48 : a.face === 'round' ? 42 : 45;
  const [b1, b2] = a.bg;
  const brow = a.brows === 'arched' ? 'M78 86 Q86 80 94 85 M106 85 Q114 80 122 86' : a.brows === 'straight' ? 'M78 85 L94 84 M106 84 L122 85' : 'M79 86 Q86 83 94 85 M106 85 Q114 83 121 86';
  const mouth = a.mouth === 'grin' ? `<path d="M88 118 Q100 132 112 118 Z" fill="#7A2A2A"/><path d="M90 119 Q100 124 110 119" fill="#fff"/>`
    : a.mouth === 'soft' ? `<path d="M92 120 Q100 125 108 120" stroke="#8A3B3B" stroke-width="3" fill="none" stroke-linecap="round"/>`
    : a.mouth === 'smirk' ? `<path d="M90 121 Q102 126 112 117" stroke="#8A3B3B" stroke-width="3" fill="none" stroke-linecap="round"/>`
    : `<path d="M88 118 Q100 130 112 118" stroke="#8A3B3B" stroke-width="3.2" fill="none" stroke-linecap="round"/>`;
  const eye = (x: number) => `<ellipse cx="${x}" cy="97" rx="6.5" ry="5.2" fill="#fff"/><circle cx="${x}" cy="97" r="3.9" fill="${a.eyes}"/><circle cx="${x}" cy="97" r="1.9" fill="#111"/><circle cx="${x + 1.4}" cy="95.6" r="1.1" fill="#fff"/>`;
  const beard = !a.beard ? '' : a.beard === 'stubble' ? `<path d="M66 108 Q70 150 100 150 Q130 150 134 108 Q124 136 100 138 Q76 136 66 108 Z" fill="${a.hairColor}" opacity="0.28"/>`
    : a.beard === 'full' ? `<path d="M64 102 Q66 156 100 156 Q134 156 136 102 Q128 132 112 128 Q100 124 88 128 Q72 132 64 102 Z" fill="${a.hairColor}"/><path d="M90 119 Q100 126 110 119" stroke="#8A3B3B" stroke-width="3" fill="none"/>`
    : a.beard === 'mustache' ? `<path d="M86 114 Q100 106 114 114 Q100 112 86 114 Z" fill="${a.hairColor}" stroke="${a.hairColor}" stroke-width="3"/>`
    : `<path d="M88 114 Q100 108 112 114 Q100 112 88 114 Z M92 132 Q100 146 108 132 Z" fill="${a.hairColor}" stroke="${a.hairColor}" stroke-width="2.5"/>`;
  const glasses = !a.glasses ? '' : a.glasses === 'round'
    ? `<g stroke="#1F2937" stroke-width="2.6" fill="none"><circle cx="86" cy="97" r="11"/><circle cx="114" cy="97" r="11"/><path d="M97 96 Q100 93 103 96"/></g>`
    : `<g stroke="#1F2937" stroke-width="2.6" fill="none"><rect x="74" y="88" width="23" height="17" rx="5"/><rect x="103" y="88" width="23" height="17" rx="5"/><path d="M97 95 L103 95"/></g>`;
  const freckles = a.freckles ? `<g fill="${shade(skin, -0.22)}" opacity="0.6">${[[80,108],[84,112],[88,108],[112,108],[116,112],[120,108]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.2"/>`).join('')}</g>` : '';
  const blush = a.blush ? `<ellipse cx="78" cy="112" rx="8" ry="4.5" fill="#F472B6" opacity="0.22"/><ellipse cx="122" cy="112" rx="8" ry="4.5" fill="#F472B6" opacity="0.22"/>` : '';
  const ears = a.hijab ? '' : `<ellipse cx="${100 - faceRx}" cy="100" rx="7" ry="10" fill="${sd}"/><ellipse cx="${100 + faceRx}" cy="100" rx="7" ry="10" fill="${sd}"/>`;
  const earrings = a.earrings && !a.hijab ? `<circle cx="${100 - faceRx}" cy="113" r="3.6" fill="#F5C518"/><circle cx="${100 + faceRx}" cy="113" r="3.6" fill="#F5C518"/>` : '';
  const hijabBack = a.hijab ? `<path d="M48 104 Q44 36 100 32 Q156 36 152 104 Q156 150 168 200 L32 200 Q44 150 48 104 Z" fill="${a.hijab}"/>` : '';
  const hijabFront = a.hijab ? `<path d="M60 96 Q60 50 100 48 Q140 50 140 96 Q140 66 100 62 Q60 66 60 96 Z" fill="${shade(a.hijab, 0.06)}"/>` : '';
  const clip = opts.round ? `<clipPath id="c"><circle cx="100" cy="100" r="100"/></clipPath>` : `<clipPath id="c"><rect width="200" height="200"/></clipPath>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${b1}"/><stop offset="1" stop-color="${b2}"/></linearGradient>${clip}</defs>
<g clip-path="url(#c)"><rect width="200" height="200" fill="url(#g)"/><circle cx="160" cy="40" r="26" fill="#fff" opacity="0.35"/>
${a.hijab ? hijabBack : hairBack(a)}
<path d="M86 136 L114 136 L116 160 L84 160 Z" fill="${sd}"/>
<path d="M30 200 Q34 158 84 152 Q100 164 116 152 Q166 158 170 200 Z" fill="${top}"/>
<path d="M84 152 Q100 168 116 152" stroke="${shade(top, -0.12)}" stroke-width="3" fill="none"/>
${ears}<ellipse cx="100" cy="98" rx="${faceRx}" ry="${faceRy}" fill="${skin}"/>
${blush}${freckles}<path d="${brow}" stroke="${shade(a.hairColor, a.hijab ? 0 : 0)}" stroke-width="3.4" fill="none" stroke-linecap="round"/>
${eye(86)}${eye(114)}<path d="M100 100 Q96 110 101 112" stroke="${shade(skin, -0.2)}" stroke-width="2.4" fill="none" stroke-linecap="round"/>
${mouth}${beard}${glasses}${earrings}${a.hijab ? hijabFront : hairFront(a)}</g></svg>`;
}

/** Lifestyle scene background (decorative shapes); emoji + caption are drawn on top by the component. */
export function sceneSvg(p: ScenePhoto): string {
  const [b1, b2] = p.bg;
  const ground: Record<string, string> = {
    beach: `<path d="M0 140 Q50 128 100 138 Q150 148 200 136 L200 200 L0 200 Z" fill="#7DD3FC"/><path d="M0 168 Q60 156 120 168 Q160 176 200 166 L200 200 L0 200 Z" fill="#FDE68A"/>`,
    mountain: `<path d="M0 170 L60 90 L100 140 L140 70 L200 160 L200 200 L0 200 Z" fill="#86A789"/><path d="M140 70 L152 88 L128 88 Z" fill="#fff"/>`,
    park: `<rect y="160" width="200" height="40" fill="#86EFAC"/><circle cx="40" cy="120" r="30" fill="#4ADE80"/><rect x="37" y="140" width="6" height="24" fill="#92400E"/><circle cx="165" cy="130" r="22" fill="#22C55E"/>`,
    city: `<g fill="#94A3B8"><rect x="10" y="100" width="34" height="100"/><rect x="50" y="70" width="28" height="130"/><rect x="84" y="110" width="40" height="90"/><rect x="130" y="80" width="26" height="120"/><rect x="162" y="120" width="34" height="80"/></g>`,
    stars: `<rect width="200" height="200" fill="#1E1B4B" opacity="0.85"/>${Array.from({ length: 22 }, (_, i) => `<circle cx="${(i * 47) % 200}" cy="${(i * 29) % 120}" r="${(i % 3) + 1}" fill="#FFF7C2"/>`).join('')}`,
    road: `<rect y="150" width="200" height="50" fill="#475569"/><g fill="#FDE047">${[10, 60, 110, 160].map((x) => `<rect x="${x}" y="172" width="30" height="5"/>`).join('')}</g>`,
    stadium: `<rect y="140" width="200" height="60" fill="#4ADE80"/><path d="M0 140 L200 140" stroke="#fff" stroke-width="3"/><circle cx="100" cy="170" r="18" stroke="#fff" stroke-width="3" fill="none"/>`,
    concert: `<rect width="200" height="200" fill="#312E81" opacity="0.8"/><path d="M30 0 L70 200 L10 200 Z M170 0 L190 200 L130 200 Z" fill="#FDE047" opacity="0.25"/>`,
    cinema: `<rect width="200" height="200" fill="#111827" opacity="0.85"/><rect x="30" y="30" width="140" height="80" rx="6" fill="#F9FAFB" opacity="0.85"/>`,
    terrace: `<circle cx="150" cy="70" r="30" fill="#FDBA74"/><rect y="150" width="200" height="50" fill="#C2410C" opacity="0.4"/>`,
  };
  const g = ground[p.scene] ?? `<circle cx="40" cy="160" r="70" fill="#fff" opacity="0.35"/><circle cx="170" cy="40" r="44" fill="#fff" opacity="0.3"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="s" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${b1}"/><stop offset="1" stop-color="${b2}"/></linearGradient></defs>
<rect width="200" height="200" fill="url(#s)"/>${g}</svg>`;
}
