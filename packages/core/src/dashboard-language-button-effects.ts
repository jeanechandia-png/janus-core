/** Visual interaction contract for the EXACT supplied flag images; no image generation. */
export const languageButtonInteraction = Object.freeze({
  originalImageOnly: true,
  illuminateOnPointerDown: true,
  illuminateOnTouch: true,
  persistentSelectedGlow: true,
  keyboardAccessible: true,
  prefersReducedMotion: true,
  renderResolutionTarget: "4K-source-when-available",
  reflectionAndCinematicLightingPreserved: true,
});
/** CSS applied to a wrapper around the supplied 3D images. */
export const languageButtonCss = `
.janus-language-button{border:0;background:transparent;cursor:pointer;border-radius:50%;padding:3px;transition:filter 160ms ease,transform 160ms ease;touch-action:manipulation}
.janus-language-button img{display:block;width:100%;height:auto;object-fit:contain}
.janus-language-button:active{filter:brightness(1.24) drop-shadow(0 0 16px #46bdff);transform:scale(.96)}
.janus-language-button[aria-pressed="true"]{filter:brightness(1.12) drop-shadow(0 0 18px #45bfff)}
.janus-language-button:focus-visible{outline:3px solid #0c73dd;outline-offset:3px}
@media(prefers-reduced-motion:reduce){.janus-language-button{transition:none}}
`;
