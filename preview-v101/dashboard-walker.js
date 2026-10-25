// Device-only animated avatar. These helpers never read or write workout records.
export const WALKER_KEY = 'fitnesspilot.preview.v101.ui.walker.v1';
export const MAX_WALKER_BYTES = 600_000;

export function validateWalkerFile(file) {
  if (!file || typeof file.name !== 'string' || !/\.webp$/i.test(file.name) ||
      (file.type && file.type !== 'image/webp') ||
      !Number.isInteger(file.size) || file.size < 20 || file.size > MAX_WALKER_BYTES)
    throw Error('Choose an animated .webp image smaller than 600 KB.');
  return file;
}

export function validateWalkerDataUrl(value) {
  if (typeof value !== 'string' || value.length > 810_000 ||
      !/^data:image\/webp;base64,UklGR[A-Za-z0-9+/]*={0,2}$/.test(value))
    throw Error('Invalid local walking character. Choose a .webp file again.');
  return value;
}

export function dashboardWalkerBanner(dataUrl = null) {
  const hasAvatar = dataUrl != null;
  const src = hasAvatar ? validateWalkerDataUrl(dataUrl) : './adventurer-idle.svg';
  return `<section class="fp-walker-banner" aria-label="Decorative walking character">
    <div class="fp-walker-copy"><span class="fp-walker-label">Your adventurer</span>
    <h2 class="fp-walker-title">Walking beside your progress</h2>
    <p class="fp-walker-note">${hasAvatar ? 'Walking in place on your private stage.' : 'To use your personal walking sprite, open Tools and import the WebP.'}</p></div>
    <div class="fp-walker-stage" aria-hidden="true">
      <div class="fp-walker-platform"></div>
      <img class="fp-walker-sprite" src="${src}" alt="" width="144" height="320">
      <img class="fp-walker-still" src="./adventurer-idle.svg" alt="">
    </div>
  </section>`;
}
