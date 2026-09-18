import { staticFile } from "remotion";

/**
 * CSS @font-face declaration for NotoSerif-Bold (bundled locally).
 * Use in components via: <style>{notoSerifFontFace}</style>
 */
export const NOTO_SERIF_FONT_FAMILY = "NotoSerif-Bold";

export const notoSerifFontFace = `
@font-face {
  font-family: '${NOTO_SERIF_FONT_FAMILY}';
  src: url('${staticFile("fonts/NotoSerif-Bold.ttf")}') format('truetype');
  font-weight: 700;
  font-style: normal;
}
`;

/**
 * Map of subtitle font families to their CSS-safe names.
 * These match the options available in SubtitleModal.jsx.
 */
export const SUBTITLE_FONTS: Record<string, string> = {
  Verdana: "Verdana, Geneva, sans-serif",
  Arial: "Arial, Helvetica, sans-serif",
  Impact: "Impact, Haettenschweiler, sans-serif",
  Helvetica: "Helvetica, Arial, sans-serif",
  Georgia: "Georgia, 'Times New Roman', serif",
  "Courier New": "'Courier New', Courier, monospace",
};

export function getFontStack(fontFamily: string): string {
  return SUBTITLE_FONTS[fontFamily] ?? fontFamily;
}

export const subtitlePackFontFace = `
@font-face {
  font-family: 'Akira Expanded';
  src: url('${staticFile("fonts/subtitle-packs/Akira Expanded Demo.otf")}') format('opentype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Burbank Big Condensed';
  src: url('${staticFile("fonts/subtitle-packs/Burbank-Big-Condensed-Bold-Font.otf")}') format('opentype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Dimbo Italic';
  src: url('${staticFile("fonts/subtitle-packs/Dimbo Italic.ttf")}') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Dimbo Regular';
  src: url('${staticFile("fonts/subtitle-packs/Dimbo Regular.ttf")}') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Gilliany';
  src: url('${staticFile("fonts/subtitle-packs/Gilliany.ttf")}') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'QUARTZO demo PERSONAL USE ONLY';
  src: url('${staticFile("fonts/subtitle-packs/QUARTZO + PERSONAL USE ONLY.ttf")}') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'QUARTZO demo PERSONAL USE ONLY 2';
  src: url('${staticFile("fonts/subtitle-packs/QUARTZO Ôòò PERSONAL USE ONLY.ttf")}') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'QUARTZO';
  src: url('${staticFile("fonts/subtitle-packs/QUARTZO-demo.ttf")}') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Questrian';
  src: url('${staticFile("fonts/subtitle-packs/Questrian.otf")}') format('opentype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'REVOLUTION';
  src: url('${staticFile("fonts/subtitle-packs/REVOLUTION.ttf")}') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Rainbow';
  src: url('${staticFile("fonts/subtitle-packs/Rainbow.ttf")}') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Red Rocket Academy';
  src: url('${staticFile("fonts/subtitle-packs/Red Rocket Academy.ttf")}') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Regensburg Italic';
  src: url('${staticFile("fonts/subtitle-packs/Regensburg-Italic.ttf")}') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Regensburg Regensburg';
  src: url('${staticFile("fonts/subtitle-packs/Regensburg.ttf")}') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Regensburg Grunged RegensburgGrunged Italic';
  src: url('${staticFile("fonts/subtitle-packs/RegensburgGrunged-Italic.ttf")}') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Regensburg Grunged RegensburgGrunged';
  src: url('${staticFile("fonts/subtitle-packs/RegensburgGrunged.ttf")}') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Restaurant Menu';
  src: url('${staticFile("fonts/subtitle-packs/RestaurantMenu.ttf")}') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Restaurant Menu Book';
  src: url('${staticFile("fonts/subtitle-packs/RestaurantMenuBook.ttf")}') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Restaurant Menu Book College';
  src: url('${staticFile("fonts/subtitle-packs/RestaurantMenuBookCollege.ttf")}') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Restaurant Menu Hollow';
  src: url('${staticFile("fonts/subtitle-packs/RestaurantMenuHollow.ttf")}') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Retroica';
  src: url('${staticFile("fonts/subtitle-packs/Retroica.ttf")}') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Riffic Free';
  src: url('${staticFile("fonts/subtitle-packs/RifficFree-Bold.ttf")}') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'RissaTypeface';
  src: url('${staticFile("fonts/subtitle-packs/RissaTypeface.ttf")}') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Road Rage';
  src: url('${staticFile("fonts/subtitle-packs/Road_Rage.otf")}') format('opentype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Roboto Condensed RobotoCondensed Bold';
  src: url('${staticFile("fonts/subtitle-packs/RobotoCondensed-Bold.ttf")}') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Roboto Condensed RobotoCondensed BoldItalic';
  src: url('${staticFile("fonts/subtitle-packs/RobotoCondensed-BoldItalic.ttf")}') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Roboto Condensed RobotoCondensed Italic';
  src: url('${staticFile("fonts/subtitle-packs/RobotoCondensed-Italic.ttf")}') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Russo One';
  src: url('${staticFile("fonts/subtitle-packs/Russo_One.ttf")}') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'SeriesOrbit';
  src: url('${staticFile("fonts/subtitle-packs/SERIO___.TTF")}') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'SF Collegiate Solid';
  src: url('${staticFile("fonts/subtitle-packs/SF Collegiate Solid Italic.ttf")}') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'SF Viper Squadron';
  src: url('${staticFile("fonts/subtitle-packs/SFViperSquadron.ttf")}') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Shlop';
  src: url('${staticFile("fonts/subtitle-packs/SHLOP__.ttf")}') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'SIMPLCITY PERSONAL USE';
  src: url('${staticFile("fonts/subtitle-packs/SIMPLICITY PERSONALUSE.ttf")}') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'SIMPLICITY SHADOW PERSONAL USE';
  src: url('${staticFile("fonts/subtitle-packs/SIMPLICITY SHADOW PERSONAL USE.ttf")}') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'SkaterDudes';
  src: url('${staticFile("fonts/subtitle-packs/SKATERDUDES.ttf")}') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Slant';
  src: url('${staticFile("fonts/subtitle-packs/SLANT.TTF")}') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'SPIDER MONKEY';
  src: url('${staticFile("fonts/subtitle-packs/SPIDER MONKEY.ttf")}') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Saltino Saltino';
  src: url('${staticFile("fonts/subtitle-packs/Saltino.otf")}') format('opentype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Saltino Saltino 2';
  src: url('${staticFile("fonts/subtitle-packs/Saltino.ttf")}') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'SanelmaW00-Regular';
  src: url('${staticFile("fonts/subtitle-packs/Sanelma W00 Regular.ttf")}') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Sheeping Dogs';
  src: url('${staticFile("fonts/subtitle-packs/Sheeping Dogs.ttf")}') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Short Xurkit Tilt';
  src: url('${staticFile("fonts/subtitle-packs/Short Xurkit Tilt.otf")}') format('opentype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Short Xurkit';
  src: url('${staticFile("fonts/subtitle-packs/Short Xurkit.otf")}') format('opentype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Shutter Braille Free Version';
  src: url('${staticFile("fonts/subtitle-packs/Shutter Braille Personal Use Only.ttf")}') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Signatra DEMO Signatra';
  src: url('${staticFile("fonts/subtitle-packs/Signatra.otf")}') format('opentype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Signatra DEMO Signatra 2';
  src: url('${staticFile("fonts/subtitle-packs/Signatra.ttf")}') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Sketch 3D';
  src: url('${staticFile("fonts/subtitle-packs/Sketch 3D.woff")}') format('woff');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Slimlines';
  src: url('${staticFile("fonts/subtitle-packs/Slimlines.ttf")}') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Snickles';
  src: url('${staticFile("fonts/subtitle-packs/Snickles.ttf")}') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Sontoloyo';
  src: url('${staticFile("fonts/subtitle-packs/Sontoloyo.otf")}') format('opentype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Soviet Program SovietProgram Bold';
  src: url('${staticFile("fonts/subtitle-packs/SovietProgram-Bold.ttf")}') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Soviet Program SovietProgram BoldItalic';
  src: url('${staticFile("fonts/subtitle-packs/SovietProgram-BoldItalic.ttf")}') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Soviet Program SovietProgram Italic';
  src: url('${staticFile("fonts/subtitle-packs/SovietProgram-Italic.ttf")}') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Soviet Program SovietProgram';
  src: url('${staticFile("fonts/subtitle-packs/SovietProgram.ttf")}') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Stalinist One';
  src: url('${staticFile("fonts/subtitle-packs/StalinistOne-Regular.ttf")}') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Star Jedi';
  src: url('${staticFile("fonts/subtitle-packs/Starjedi.ttf")}') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Starlight Personal';
  src: url('${staticFile("fonts/subtitle-packs/Starlight Personal.ttf")}') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Sugarpunch DEMO';
  src: url('${staticFile("fonts/subtitle-packs/SugarpunchDEMO.otf")}') format('opentype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'SummerLove';
  src: url('${staticFile("fonts/subtitle-packs/SummerLove.otf")}') format('opentype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Super Mario World';
  src: url('${staticFile("fonts/subtitle-packs/Super-Mario-World.ttf")}') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Super glue';
  src: url('${staticFile("fonts/subtitle-packs/Super-glue.ttf")}') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Super Mario 256';
  src: url('${staticFile("fonts/subtitle-packs/SuperMario.ttf")}') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Supersonic Rocketship';
  src: url('${staticFile("fonts/subtitle-packs/Supersonic Rocketship.ttf")}') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Surfing Capital';
  src: url('${staticFile("fonts/subtitle-packs/Surfing Capital.ttf")}') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'TYPOGRAPH PRO';
  src: url('${staticFile("fonts/subtitle-packs/TYPOGRAPH PRO Extra Bold.ttf")}') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Territorial';
  src: url('${staticFile("fonts/subtitle-packs/Territorial.ttf")}') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'The Godfather';
  src: url('${staticFile("fonts/subtitle-packs/TheGodfather-v2.ttf")}') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'The Juke Box';
  src: url('${staticFile("fonts/subtitle-packs/The_Juke_Box-FFP.ttf")}') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Thinking Of Betty';
  src: url('${staticFile("fonts/subtitle-packs/Thinking_of_Betty.ttf")}') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Thunder Lord';
  src: url('${staticFile("fonts/subtitle-packs/Thunder Lord.ttf")}') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Timeline';
  src: url('${staticFile("fonts/subtitle-packs/Timeline.ttf")}') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Tough Love';
  src: url('${staticFile("fonts/subtitle-packs/Tough_Love.ttf")}') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Toxico';
  src: url('${staticFile("fonts/subtitle-packs/Toxico.otf")}') format('opentype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Transformers';
  src: url('${staticFile("fonts/subtitle-packs/Transformers Movie.ttf")}') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'True Lies';
  src: url('${staticFile("fonts/subtitle-packs/True Lies.ttf")}') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'TypoGraphica';
  src: url('${staticFile("fonts/subtitle-packs/TypoGraphica.otf")}') format('opentype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Uni Sans Heavy Italic';
  src: url('${staticFile("fonts/subtitle-packs/Uni Sans Heavy Italic.otf")}') format('opentype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Uni Sans Heavy';
  src: url('${staticFile("fonts/subtitle-packs/Uni Sans Heavy.otf")}') format('opentype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'UnitaW01-ExtraBold';
  src: url('${staticFile("fonts/subtitle-packs/Unita W01 Extra Bold.ttf")}') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'University';
  src: url('${staticFile("fonts/subtitle-packs/University.otf")}') format('opentype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Unrealised';
  src: url('${staticFile("fonts/subtitle-packs/Unrealised.ttf")}') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Vermin Vibes V';
  src: url('${staticFile("fonts/subtitle-packs/Vermin Vibes V.otf")}') format('opentype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Viafont';
  src: url('${staticFile("fonts/subtitle-packs/Viafont.otf")}') format('opentype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Videopac';
  src: url('${staticFile("fonts/subtitle-packs/Videopac Bold.otf")}') format('opentype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'WhoopAss';
  src: url('${staticFile("fonts/subtitle-packs/WHOOPASS.TTF")}') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Wide awake Black';
  src: url('${staticFile("fonts/subtitle-packs/WIDEAWAKEBLACK.ttf")}') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Walrus';
  src: url('${staticFile("fonts/subtitle-packs/Walrus-Bold.otf")}') format('opentype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Xenos';
  src: url('${staticFile("fonts/subtitle-packs/Xeno_s! .ttf")}') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Xheighter Black Xheighter Black';
  src: url('${staticFile("fonts/subtitle-packs/Xheighter-Black.otf")}') format('opentype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Xheighter Black BlackOblique';
  src: url('${staticFile("fonts/subtitle-packs/Xheighter-BlackOblique.otf")}') format('opentype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Xheighter Light Xheighter Light';
  src: url('${staticFile("fonts/subtitle-packs/Xheighter-Light.otf")}') format('opentype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Xheighter Light LightOblique';
  src: url('${staticFile("fonts/subtitle-packs/Xheighter-LightOblique.otf")}') format('opentype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Zilap Black Storm';
  src: url('${staticFile("fonts/subtitle-packs/Zilap Black Storm.ttf")}') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Zilap Monograma';
  src: url('${staticFile("fonts/subtitle-packs/Zilap Monograma.ttf")}') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'ROBO';
  src: url('${staticFile("fonts/subtitle-packs/s3d.ttf")}') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Screengem';
  src: url('${staticFile("fonts/subtitle-packs/screengem.ttf")}') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Soup of Justice';
  src: url('${staticFile("fonts/subtitle-packs/soupofjustice.ttf")}') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Space Age';
  src: url('${staticFile("fonts/subtitle-packs/space age.ttf")}') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Strenuous';
  src: url('${staticFile("fonts/subtitle-packs/strenuous bl.ttf")}') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Technique OL BRK';
  src: url('${staticFile("fonts/subtitle-packs/techniqo.ttf")}') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Technique BRK';
  src: url('${staticFile("fonts/subtitle-packs/techniqu.ttf")}') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'The Breakdown';
  src: url('${staticFile("fonts/subtitle-packs/the breakdown.ttf")}') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'The Bold Font';
  src: url('${staticFile("fonts/subtitle-packs/theboldfont.ttf")}') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Thunderstrike';
  src: url('${staticFile("fonts/subtitle-packs/thunderstrike.ttf")}') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Thunder Titan';
  src: url('${staticFile("fonts/subtitle-packs/thundertitan.ttf")}') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Times New Yorker';
  src: url('${staticFile("fonts/subtitle-packs/times_new_yorker.ttf")}') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Troublemarker DEMO';
  src: url('${staticFile("fonts/subtitle-packs/troublemarkerDEMO.otf")}') format('opentype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Umbrage';
  src: url('${staticFile("fonts/subtitle-packs/umbrage2.ttf")}') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Uni Sans heavy italic caps';
  src: url('${staticFile("fonts/subtitle-packs/uni-sans.heavy-italic-caps.otf")}') format('opentype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Varsity Regular';
  src: url('${staticFile("fonts/subtitle-packs/varsity_regular.ttf")}') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Vermin Vibes';
  src: url('${staticFile("fonts/subtitle-packs/vermin_vibes.ttf")}') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Whiskey Bravo Victor';
  src: url('${staticFile("fonts/subtitle-packs/wbv5.ttf")}') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Whiskey Bravo Victor Bold';
  src: url('${staticFile("fonts/subtitle-packs/wbv5bold.ttf")}') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Whiskey Bravo Victor Condensed';
  src: url('${staticFile("fonts/subtitle-packs/wbv5cond.ttf")}') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Whiskey Bravo Victor Expanded';
  src: url('${staticFile("fonts/subtitle-packs/wbv5expand.ttf")}') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Whiskey Bravo Victor Halftone';
  src: url('${staticFile("fonts/subtitle-packs/wbv5half.ttf")}') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Whiskey Bravo Victor Italic';
  src: url('${staticFile("fonts/subtitle-packs/wbv5ital.ttf")}') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Whiskey Bravo Victor Laser';
  src: url('${staticFile("fonts/subtitle-packs/wbv5laser.ttf")}') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Whiskey Bravo Victor Laser Pro';
  src: url('${staticFile("fonts/subtitle-packs/wbv5laserpro.ttf")}') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Whiskey Bravo Victor Leftalic';
  src: url('${staticFile("fonts/subtitle-packs/wbv5left.ttf")}') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Whiskey Bravo Victor Outline';
  src: url('${staticFile("fonts/subtitle-packs/wbv5out.ttf")}') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'woodcutter carnage';
  src: url('${staticFile("fonts/subtitle-packs/woodcutter carnage.ttf")}') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Zephyrean BRK';
  src: url('${staticFile("fonts/subtitle-packs/zephyrea.ttf")}') format('truetype');
  font-weight: 400;
  font-style: normal;
}
`;