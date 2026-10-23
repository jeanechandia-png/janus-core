import test from 'node:test';
import assert from 'node:assert/strict';
import { CREATURES, newProfile, chooseCreature, renameCreature, displayName, enableBiometrics, stageSize, pickEncouragement, isBodySafe, guardReply, makeExercise, checkAnswer, adaptLevel, SCENARIOS, answerScenario, checkMessage, companionTurn } from '../packages/modules/companion/src/index.js';

test('varias criaturas, se puede cambiar y renombrar', () => {
  assert.ok(CREATURES.length >= 4);
  const p = newProfile('k1', 'Ana');
  chooseCreature(p, 'bombo');
  assert.equal(displayName(p), 'Bombo');
  renameCreature(p, 'bombo', '  Burbuja<b> ');
  assert.equal(displayName(p), 'Burbujab');
  chooseCreature(p, 'nimbo');
  assert.equal(displayName(p), 'Nimbo');
  assert.throws(() => chooseCreature(p, 'desconocida'));
});

test('ánimo sutil: límite por hora y separación de espontáneos', () => {
  const p = newProfile('k1', 'Ana'); const t0 = 1_000_000;
  assert.ok(pickEncouragement('espontaneo', 'Ana', p.encourage, t0, undefined, () => 0));
  assert.equal(pickEncouragement('espontaneo', 'Ana', p.encourage, t0 + 60_000), null);
  for (let i = 0; i < 3; i++) pickEncouragement('acierto', 'Ana', p.encourage, t0 + 120_000 + i);
  assert.equal(pickEncouragement('acierto', 'Ana', p.encourage, t0 + 200_000), null);
  assert.ok(pickEncouragement('frustracion', 'Ana', p.encourage, t0 + 300_000), 'la frustración siempre recibe apoyo');
});

test('nunca habla de peso ni de cuerpo', () => {
  assert.equal(isBodySafe('¡Qué bien lo pensaste!'), true);
  assert.equal(isBodySafe('Deberías hacer dieta'), false);
  assert.equal(isBodySafe('no estás gordita'), false);
  assert.equal(guardReply('Tienes que bajar de peso').ok, false);
});

test('tutor: pistas graduales y nivel adaptativo', () => {
  const ex = makeExercise('multiplicacion', 1, 42);
  assert.equal(checkAnswer(ex, ex.answer, 0).correct, true);
  const a1 = checkAnswer(ex, '-1', 0), a3 = checkAnswer(ex, '-1', 2);
  assert.equal(a1.next, 'pista'); assert.equal(a3.next, 'mostrar-pasos');
  assert.equal(makeExercise('fracciones', 1, 7).answer, makeExercise('fracciones', 1, 7).answer);
  assert.equal(adaptLevel(1, 3, 0), 2); assert.equal(adaptLevel(2, 0, 2), 1);
});

test('semáforo social', () => {
  const s = SCENARIOS.find((x) => x.correct === 'rojo')!;
  assert.equal(answerScenario(s, 'rojo').correct, true);
  assert.match(answerScenario(s, 'verde').feedback, /Casi/);
});

test('seguridad: acoso y riesgo avisan al tutor', () => {
  assert.equal(checkMessage('hoy jugamos al fútbol').severity, 'ninguna');
  const b = checkMessage('en el cole se ríen de mí', 'mamá');
  assert.equal(b.severity, 'importante'); assert.match(b.reply!, /mamá/); assert.ok(b.parentAlert);
  assert.equal(checkMessage('no quiero vivir').severity, 'urgente');
  const p = newProfile('k1', 'Ana');
  const turn = companionTurn(p, 'estoy triste', 'respuesta del modelo', null, 5_000_000);
  assert.ok(turn.safety.parentAlert); assert.ok(!turn.say.includes('respuesta del modelo'));
});

test('biometría solo con consentimiento y tamaño en pantalla', () => {
  const p = newProfile('k1', 'Ana');
  assert.throws(() => enableBiometrics(p, { voice: true }, false));
  enableBiometrics(p, { voice: true, face: true }, true);
  assert.equal(p.biometrics.onDeviceOnly, true);
  assert.deepEqual(stageSize('phone'), { fraction: 0.5, position: 'bottom' });
  assert.equal(stageSize('tablet').fraction, 0.25); assert.equal(stageSize('tablet', true).fraction, 0.5);
});
