/**
 * Reusable "living emblem" (LEGO piece): a hyper-real 3D brand image that
 * tilts in perspective with the finger/cursor, sweeps a specular reflection
 * across its metal and blooms a cinematic halo when touched.
 *
 * Product-agnostic: any InfinitySeed surface passes its own image element.
 * Importing has no side effects; pure helpers are testable in Node.
 * Respects prefers-reduced-motion (no tilt, light only) and never takes
 * over taps: it is decorative, so it adds no button without a destination.
 */

/** Pure: pointer position inside a rect -> tilt degrees and light position (0..1). */
export function emblemPose(rect, point, maxDeg = 14) {
  const w = Math.max(1, rect.width);
  const h = Math.max(1, rect.height);
  const x = Math.min(1, Math.max(0, (point.x - rect.left) / w));
  const y = Math.min(1, Math.max(0, (point.y - rect.top) / h));
  return {
    x, y,
    rotateY: Number(((x - 0.5) * 2 * maxDeg).toFixed(2)),
    rotateX: Number(((0.5 - y) * 2 * maxDeg).toFixed(2)),
  };
}

export function mountGlowEmblem(element, { maxDeg = 14, reducedMotion } = {}) {
  if (!element) throw new Error('mountGlowEmblem requires an element');
  const reduce = reducedMotion ?? matchMedia('(prefers-reduced-motion: reduce)').matches;
  let frame = 0;
  let releaseTimer = 0;

  const apply = (pose) => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      element.style.setProperty('--glow-x', `${(pose.x * 100).toFixed(1)}%`);
      element.style.setProperty('--glow-y', `${(pose.y * 100).toFixed(1)}%`);
      element.style.setProperty('--tilt-x', reduce ? '0deg' : `${pose.rotateX}deg`);
      element.style.setProperty('--tilt-y', reduce ? '0deg' : `${pose.rotateY}deg`);
    });
  };
  const aim = (event) => apply(emblemPose(element.getBoundingClientRect(), { x: event.clientX, y: event.clientY }, maxDeg));
  const light = (event) => {
    clearTimeout(releaseTimer);
    element.classList.add('is-lit');
    if (event) aim(event);
  };
  const dim = () => {
    clearTimeout(releaseTimer);
    // Keep the glow a moment after a quick tap so the bloom is actually seen.
    releaseTimer = setTimeout(() => {
      element.classList.remove('is-lit');
      apply({ x: 0.5, y: 0.5, rotateX: 0, rotateY: 0 });
    }, 650);
  };

  const listeners = [
    ['pointerenter', light], ['pointermove', (event) => { if (element.classList.contains('is-lit')) aim(event); }],
    ['pointerdown', light], ['pointerup', dim], ['pointercancel', dim], ['pointerleave', dim],
    ['focus', () => light()], ['blur', dim],
  ];
  for (const [name, handler] of listeners) element.addEventListener(name, handler);
  apply({ x: 0.5, y: 0.5, rotateX: 0, rotateY: 0 });

  return () => {
    cancelAnimationFrame(frame);
    clearTimeout(releaseTimer);
    for (const [name, handler] of listeners) element.removeEventListener(name, handler);
    element.classList.remove('is-lit');
  };
}
