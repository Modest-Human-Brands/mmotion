import type { Composition, Scene } from '@/core/composition/schema'
import { getTemplate } from '@/core/templates'

/**
 * Art styles: how generated pictures are drawn. Independent of the look (layout, type, motion)
 * and the kind of video. Styles are described in words; names of living artists and studios are
 * never used (public-domain masters are fine).
 */

export const STYLE_FAMILIES = [
  { id: 'flat', name: 'Flat & vector' },
  { id: 'illustration', name: 'Illustration' },
  { id: 'comics', name: 'Comics & anime' },
  { id: 'fineArt', name: 'Fine art' },
  { id: 'retro', name: 'Retro & digital' },
  { id: 'craft', name: '3D & craft' },
  { id: 'photo', name: 'Photographic' },
] as const
export type StyleFamily = (typeof STYLE_FAMILIES)[number]['id']

export interface ArtStyle {
  id: string
  name: string
  family: StyleFamily
  /** Added to every picture prompt. */
  prompt: string
  /** What the style must not turn into. */
  avoid: string
  /**
   * `white`: a cut-out figure on white, blended into the scene colour;
   * `full-bleed`: a complete picture with its own background, shown in a rounded frame.
   */
  background: 'white' | 'full-bleed'
  /** Picture models that suit the style, best first (the router prefers them). */
  best: string[]
  /** Two colours for the swatch shown before a thumbnail exists. */
  swatch: [string, string]
}

const TURBO = 'qwen-image-2.1-turbo'
const MOSS = 'moss-image-sft'
const H3 = 'h3-image'
const UNCENSORED = 'qwen-image-2.1-uncensored'

const style = (
  id: string,
  name: string,
  family: StyleFamily,
  prompt: string,
  options: Partial<Pick<ArtStyle, 'avoid' | 'background' | 'best' | 'swatch'>> = {},
): ArtStyle => ({
  id,
  name,
  family,
  prompt,
  avoid: options.avoid ?? 'photorealism, text, watermark',
  background: options.background ?? 'white',
  best: options.best ?? [TURBO],
  swatch: options.swatch ?? ['#e2e8f0', '#94a3b8'],
})

export const STYLES: ArtStyle[] = [
  // ------------------------------------------------------------------ flat & vector
  style(
    'flat-vector',
    'Flat vector',
    'flat',
    'Clean flat vector illustration, simple shapes, limited harmonious palette, no outlines, subtle shadows.',
    { swatch: ['#7dd3fc', '#f472b6'] },
  ),
  style(
    'corporate-flat',
    'Corporate flat',
    'flat',
    'Friendly corporate flat illustration, people with elongated limbs and small heads, bold solid colours, simple geometric shapes.',
    { swatch: ['#a78bfa', '#fbbf24'] },
  ),
  style(
    'isometric',
    'Isometric',
    'flat',
    'Isometric illustration, 30-degree axonometric view, clean geometry, soft gradients, tidy miniature world.',
    { swatch: ['#60a5fa', '#34d399'] },
  ),
  style(
    'line-spot',
    'Line art + spot colour',
    'flat',
    'Fine black line art with one or two flat spot colours, lots of white space, elegant and minimal.',
    { swatch: ['#111827', '#f97316'] },
  ),
  style(
    'geometric',
    'Geometric minimal',
    'flat',
    'Geometric minimal illustration built from circles, triangles and rectangles, bold flat colours, strong composition.',
    { swatch: ['#ef4444', '#1d4ed8'] },
  ),
  style(
    'sticker',
    'Sticker',
    'flat',
    'Die-cut sticker illustration, thick white border around the subject, glossy flat colours, playful.',
    { swatch: ['#fde047', '#fb7185'], best: [TURBO, UNCENSORED] },
  ),
  style(
    'icon',
    'Icon style',
    'flat',
    'App icon style illustration, rounded simple shapes, soft gradients, centred single subject, crisp and readable at small sizes.',
    { swatch: ['#38bdf8', '#818cf8'] },
  ),
  // ------------------------------------------------------------------ illustration
  style(
    'storybook',
    "Children's storybook",
    'illustration',
    "Flat children's book illustration, soft pastel palette, clean thin outlines, gentle shading, soft ground shadow.",
    { swatch: ['#fecdd3', '#bae6fd'] },
  ),
  style(
    'gouache',
    'Gouache',
    'illustration',
    'Gouache painting, opaque matte brush strokes, warm muted palette, visible paper texture, cosy mood.',
    { swatch: ['#f59e0b', '#65a30d'], best: [TURBO, MOSS] },
  ),
  style(
    'watercolour',
    'Watercolour',
    'illustration',
    'Loose watercolour illustration, soft transparent washes, bleeding edges, delicate pencil under-drawing, light and airy.',
    { swatch: ['#93c5fd', '#fda4af'], best: [TURBO, MOSS] },
  ),
  style(
    'pencil',
    'Coloured pencil',
    'illustration',
    'Coloured pencil drawing, visible hatching and grain, soft layered colour, hand-drawn warmth.',
    { swatch: ['#fca5a5', '#86efac'] },
  ),
  style(
    'charcoal',
    'Charcoal sketch',
    'illustration',
    'Charcoal sketch, expressive smudged strokes, rich blacks and soft greys, rough paper texture.',
    { swatch: ['#1f2937', '#9ca3af'], avoid: 'colour, photorealism, text' },
  ),
  style(
    'ink-wash',
    'Ink & wash',
    'illustration',
    'Ink and wash illustration, confident brush lines, grey and indigo washes, calm negative space.',
    { swatch: ['#1e3a8a', '#cbd5e1'] },
  ),
  style(
    'risograph',
    'Risograph print',
    'illustration',
    'Risograph print illustration, two or three overlapping spot inks, grainy texture, slight misregistration.',
    { swatch: ['#f43f5e', '#0ea5e9'] },
  ),
  style(
    'collage',
    'Paper cut-out collage',
    'illustration',
    'Paper cut-out collage, layered coloured paper with torn and cut edges, soft drop shadows between layers.',
    { swatch: ['#fb923c', '#22c55e'] },
  ),
  style(
    'chalkboard',
    'Chalkboard',
    'illustration',
    'Chalk drawing on a dark green chalkboard, dusty strokes, hand-drawn outlines, a few pastel chalk colours.',
    { swatch: ['#14532d', '#f1f5f9'], background: 'full-bleed' },
  ),
  style(
    'doodle',
    'Whiteboard doodle',
    'illustration',
    'Whiteboard marker doodle, simple black outlines with a few marker colours, hand-drawn explainer feel.',
    { swatch: ['#f8fafc', '#2563eb'] },
  ),
  style(
    'blueprint',
    'Blueprint',
    'illustration',
    'Technical blueprint drawing, white fine lines on deep blue paper, measurement marks, precise and schematic.',
    { swatch: ['#1e40af', '#e0f2fe'], background: 'full-bleed' },
  ),
  // ------------------------------------------------------------------ comics & anime
  style(
    'anime',
    'Anime',
    'comics',
    'Anime illustration, cel-shaded colouring, clean confident line art, expressive eyes, bright hand-painted look.',
    { swatch: ['#f9a8d4', '#60a5fa'], best: [MOSS, TURBO] },
  ),
  style(
    'anime-film',
    'Anime film background',
    'comics',
    'Hand-painted anime film still, lush detailed background, soft sunlight, gentle nostalgic colours.',
    { swatch: ['#86efac', '#7dd3fc'], background: 'full-bleed', best: [MOSS, TURBO] },
  ),
  style(
    'manga',
    'Manga ink',
    'comics',
    'Black and white manga ink drawing, screentone shading, dynamic line weight, speed lines where there is motion.',
    { swatch: ['#0f172a', '#e2e8f0'], avoid: 'colour, photorealism, text', best: [MOSS, TURBO] },
  ),
  style(
    'chibi',
    'Chibi / kawaii',
    'comics',
    'Chibi kawaii illustration, big heads and tiny bodies, round shapes, pastel colours, cute and cheerful.',
    { swatch: ['#fbcfe8', '#c4b5fd'], best: [MOSS, TURBO] },
  ),
  style(
    'comic',
    'Western comic',
    'comics',
    'Western comic book illustration, bold black ink outlines, halftone dot shading, saturated primary colours.',
    { swatch: ['#dc2626', '#facc15'] },
  ),
  style(
    'graphic-novel',
    'Graphic novel',
    'comics',
    'Graphic novel illustration, moody limited palette, heavy shadows, cinematic framing, textured inking.',
    { swatch: ['#334155', '#b45309'], background: 'full-bleed' },
  ),
  style(
    'webtoon',
    'Webtoon',
    'comics',
    'Webtoon illustration, clean digital line art, soft gradients and glow, modern fashion, smooth shading.',
    { swatch: ['#a5b4fc', '#fda4af'], best: [MOSS, TURBO] },
  ),
  // ------------------------------------------------------------------ fine art
  style(
    'post-impressionist',
    'Post-impressionist (Van Gogh)',
    'fineArt',
    'Post-impressionist oil painting in the manner of Vincent van Gogh, thick swirling impasto brush strokes, vivid complementary colours.',
    { swatch: ['#1d4ed8', '#facc15'], background: 'full-bleed' },
  ),
  style(
    'impressionist',
    'Impressionist (Monet)',
    'fineArt',
    'Impressionist painting in the manner of Claude Monet, broken dabs of colour, soft natural light, airy atmosphere.',
    { swatch: ['#a7f3d0', '#c4b5fd'], background: 'full-bleed' },
  ),
  style(
    'ukiyo-e',
    'Ukiyo-e woodblock',
    'fineArt',
    'Ukiyo-e woodblock print in the manner of Hokusai, flat colour areas, strong outlines, traditional Japanese composition, washi paper texture.',
    { swatch: ['#1e3a8a', '#fecaca'], background: 'full-bleed' },
  ),
  style(
    'art-nouveau',
    'Art nouveau (Mucha)',
    'fineArt',
    'Art nouveau illustration in the manner of Alphonse Mucha, flowing organic lines, decorative floral borders, muted gold and pastel tones.',
    { swatch: ['#d97706', '#fde68a'], background: 'full-bleed' },
  ),
  style(
    'pop-art',
    'Pop art',
    'fineArt',
    'Pop art, bold flat colours, Ben-Day dots, thick black outlines, high contrast, 1960s print feel.',
    { swatch: ['#f43f5e', '#06b6d4'] },
  ),
  style(
    'cubist',
    'Cubist',
    'fineArt',
    'Cubist painting, fragmented geometric planes, several viewpoints at once, earthy muted palette.',
    { swatch: ['#a16207', '#57534e'], background: 'full-bleed' },
  ),
  style(
    'bauhaus',
    'Bauhaus poster',
    'fineArt',
    'Bauhaus and Swiss poster style, primary colours, circles and bars, strict grid, bold modernist composition.',
    { swatch: ['#dc2626', '#facc15'] },
  ),
  // ------------------------------------------------------------------ retro & digital
  style(
    'pixel-8',
    'Pixel art (8-bit)',
    'retro',
    '8-bit pixel art, retro video game sprite: a tiny 64x64 sprite scaled up with nearest-neighbour, huge square pixels clearly visible, flat colours from a 16-colour palette, no gradients, no anti-aliasing.',
    {
      swatch: ['#22c55e', '#7c3aed'],
      avoid: 'smooth gradients, anti-aliasing, photorealism, text',
      best: [TURBO, MOSS],
    },
  ),
  style(
    'pixel-16',
    'Pixel art (16-bit)',
    'retro',
    '16-bit pixel art, console-era sprite: 128x128 scaled up, crisp visible square pixels, limited palette with dithering, no smooth shading.',
    {
      swatch: ['#f97316', '#0ea5e9'],
      avoid: 'smooth gradients, photorealism, text',
      best: [TURBO, MOSS],
    },
  ),
  style(
    'low-poly',
    'Low poly',
    'retro',
    'Low-poly 3D render made of large flat triangular facets, flat-shaded polygons, no smooth surfaces, no textures, clean pastel colours, soft light.',
    { swatch: ['#2dd4bf', '#fb7185'] },
  ),
  style(
    'vaporwave',
    'Vaporwave',
    'retro',
    'Vaporwave aesthetic, pink and teal gradients, marble busts and palm trees, retro computer graphics, dreamy.',
    { swatch: ['#f0abfc', '#5eead4'], background: 'full-bleed' },
  ),
  style(
    'synthwave',
    'Synthwave neon',
    'retro',
    'Synthwave neon illustration, glowing magenta and cyan lines, dark night background, 1980s retro-futurism.',
    { swatch: ['#c026d3', '#22d3ee'], background: 'full-bleed' },
  ),
  style(
    'y2k',
    'Y2K',
    'retro',
    'Y2K aesthetic illustration, chrome and glossy plastic, bubbly shapes, iridescent colours, early-2000s digital look.',
    { swatch: ['#a5f3fc', '#e9d5ff'] },
  ),
  style(
    'seventies',
    '70s retro',
    'retro',
    '1970s retro illustration, warm orange, brown and mustard palette, groovy rounded shapes, grain.',
    { swatch: ['#ea580c', '#ca8a04'] },
  ),
  style(
    'mid-century',
    'Mid-century modern',
    'retro',
    'Mid-century modern illustration, 1950s advertising style, stylised figures, teal, mustard and coral, textured print.',
    { swatch: ['#0d9488', '#f59e0b'] },
  ),
  style(
    'glitch',
    'Glitch',
    'retro',
    'Glitch art illustration, RGB channel shifts, scanlines, digital distortion, dark background with neon accents.',
    { swatch: ['#ef4444', '#22d3ee'], background: 'full-bleed' },
  ),
  // ------------------------------------------------------------------ 3D & craft
  style(
    'clay',
    'Claymation',
    'craft',
    'Claymation figure, soft modelling clay with fingerprints, rounded forms, warm studio light, stop-motion feel.',
    { swatch: ['#fdba74', '#93c5fd'], best: [TURBO, H3] },
  ),
  style(
    '3d-cartoon',
    '3D cartoon',
    'craft',
    '3D cartoon render, smooth stylised characters, soft global illumination, vibrant colours, animated-feature quality.',
    { swatch: ['#60a5fa', '#fbbf24'], best: [TURBO, H3] },
  ),
  style(
    'vinyl-toy',
    'Vinyl toy',
    'craft',
    'Collectible vinyl toy figure, glossy plastic, simplified proportions, product shot on a seamless background.',
    { swatch: ['#f472b6', '#a3e635'], best: [TURBO, H3] },
  ),
  style(
    'felt',
    'Felt & fabric',
    'craft',
    'Handmade felt and fabric craft, visible stitches and fibres, soft textile textures, cosy colours.',
    { swatch: ['#f87171', '#4ade80'] },
  ),
  style(
    'papercraft',
    'Papercraft',
    'craft',
    'Layered papercraft, folded and cut card stock, crisp paper edges, soft shadows between layers.',
    { swatch: ['#fde68a', '#a5b4fc'] },
  ),
  style(
    'diorama',
    'Miniature diorama',
    'craft',
    'Miniature diorama, tilt-shift look, tiny handmade props and figures, soft studio light.',
    { swatch: ['#86efac', '#fcd34d'], background: 'full-bleed', best: [TURBO, H3] },
  ),
  // ------------------------------------------------------------------ photographic
  style(
    'cinematic-photo',
    'Cinematic photo',
    'photo',
    'Cinematic photograph, shallow depth of field, anamorphic film look, motivated lighting, natural colour grade.',
    {
      swatch: ['#0f172a', '#f59e0b'],
      background: 'full-bleed',
      avoid: 'illustration, cartoon, text, watermark',
      best: [H3, TURBO],
    },
  ),
  style(
    'product-photo',
    'Studio product photo',
    'photo',
    'Studio product photograph, seamless backdrop, soft box lighting, crisp detail, subtle reflection.',
    {
      swatch: ['#f1f5f9', '#64748b'],
      avoid: 'illustration, cartoon, text, watermark',
      best: [H3, TURBO],
    },
  ),
  style(
    'lifestyle-photo',
    'Lifestyle photo',
    'photo',
    'Lifestyle photograph, natural window light, candid moment, warm authentic colours, real everyday setting.',
    {
      swatch: ['#fde68a', '#a8a29e'],
      background: 'full-bleed',
      avoid: 'illustration, cartoon, text, watermark',
      best: [H3, TURBO],
    },
  ),
  style(
    'documentary',
    'Documentary',
    'photo',
    'Documentary photograph, available light, honest unposed composition, slight grain, realistic colours.',
    {
      swatch: ['#57534e', '#d6d3d1'],
      background: 'full-bleed',
      avoid: 'illustration, cartoon, text, watermark',
      best: [H3, TURBO],
    },
  ),
]

export const getStyle = (id: string): ArtStyle =>
  STYLES.find((item) => item.id === id) ?? STYLES.find((item) => item.id === 'storybook')!
export const isStyle = (id: string) => STYLES.some((item) => item.id === id)

/** One line for a picture prompt. */
export const styleLine = (item: ArtStyle) => `Style: ${item.prompt} Avoid: ${item.avoid}.`

/**
 * The style's first phrase ("8-bit pixel art"), put at the very start of a prompt: image models
 * weigh the opening words most, and a style named only at the end is often ignored.
 */
export const styleLead = (item: ArtStyle) => `${item.prompt.split(/[,.:]/)[0]!.trim()}.`

/** What every style thumbnail shows, so styles compare like for like. */
export const THUMBNAIL_SUBJECT =
  'A young woman with short dark hair in a yellow jumper holding a cup of tea, next to a potted plant.'

/** The style a scene's picture is drawn in: scene, then chapter, then video, then the look's. */
export function sceneStyle(
  composition: Pick<Composition, 'styleId' | 'templateId' | 'chapters'>,
  scene?: Pick<Scene, 'styleId' | 'chapterId'>,
): ArtStyle {
  const chapter = scene && composition.chapters.find((item) => item.id === scene.chapterId)
  const id =
    [scene?.styleId, chapter?.styleId, composition.styleId].find(
      (value) => value && isStyle(value),
    ) ?? getTemplate(composition.templateId).style
  return getStyle(id)
}