import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseModelJson, cleanPitch, normalizeEvaluation } from '../src/lib/normalize.js';

test('parseModelJson handles fences, chatter and trailing commas', () => {
  assert.deepEqual(parseModelJson('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(parseModelJson('Sure! Here you go: {"a":1,} Hope that helps'), { a: 1 });
  assert.throws(() => parseModelJson('no json here'));
});

test('cleanPitch removes preambles and markdown and joins into one paragraph', () => {
  assert.equal(cleanPitch('Here is your pitch:\n\n"**Hello** everyone.\nThank you."'), 'Hello everyone. Thank you.');
});

test('normalizeEvaluation rejects incomplete output', () => {
  assert.throws(() => normalizeEvaluation({}));
  assert.throws(() => normalizeEvaluation({ evaluation: {} }));
});
