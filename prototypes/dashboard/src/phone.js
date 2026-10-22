'use strict';
/* ===== Teléfono: detección. (El tablero de widgets/botones fue RECHAZADO por Jean el 22-oct: no es un dashboard.) ===== */
const PHONE_MQ = '(max-width:47.5em),(max-height:31.25em)';
const isPhone = () => { try { return matchMedia(PHONE_MQ).matches; } catch (e) { return false; } };
