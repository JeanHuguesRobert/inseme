import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createLabel,
  matchesLabels,
  normalizeLabelId,
  parseLabelSelector,
} from '../index.js';

test('a label is an entity with stable identity independent of display name', () => {
  const label = createLabel({ id: '#Corse', name: 'La Corse', description: 'Territoire' });
  assert.deepEqual(label, { id: 'corse', name: 'La Corse', description: 'Territoire' });
  assert.equal(Object.isFrozen(label), true);
  assert.equal(normalizeLabelId(label), 'corse');
  assert.equal(normalizeLabelId('#ÉNERGIE'), 'énergie');
});

test('historical conjunction: all selected tags are required', () => {
  const labels = [createLabel({ id: 'corse' }), '#energie', 'simulation'];
  assert.equal(matchesLabels(labels, '#corse #energie'), true);
  assert.equal(matchesLabels(labels, '#corse #histoire'), false);
  assert.equal(matchesLabels(labels, { all: ['energie', '#simulation'] }), true);
  assert.equal(matchesLabels(labels, { all: [] }), true);
  assert.equal(matchesLabels([], '#corse'), false);
});

test('selector parsing preserves canonical identities and eliminates duplicates', () => {
  assert.deepEqual(parseLabelSelector(' #Corse  #ÉNERGIE #corse '), {
    all: ['corse', 'énergie'],
  });
  assert.deepEqual(parseLabelSelector(''), { all: [] });
});

test('invalid identities and unsupported expressions fail instead of silently matching', () => {
  assert.throws(() => createLabel({ id: 'with spaces' }), TypeError);
  assert.throws(() => normalizeLabelId({ name: 'corse' }), TypeError);
  assert.throws(() => parseLabelSelector('corse #energie'), TypeError);
  assert.throws(() => matchesLabels(['corse'], { all: 'corse' }), TypeError);
  assert.throws(() => matchesLabels(['corse'], { none: ['corse'] }), TypeError);
  assert.throws(() => parseLabelSelector('#corse #but #energie'), TypeError);
  assert.throws(() => matchesLabels('corse', '#corse'), TypeError);
});
