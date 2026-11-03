const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');

const moduleOutput = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/lessons.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, { module: moduleOutput, exports: moduleOutput.exports });
const { lessons, lessonChapters } = moduleOutput.exports;

test('the advertised challenge has exactly 83 distinct lessons and preserves earlier saved IDs', () => {
  assert.equal(lessons.length, 83);
  assert.equal(new Set(lessons.map(lesson => lesson.id)).size, 83);
  for (const lesson of lessons) {
    assert.match(lesson.id, /^[a-z][a-z0-9-]+$/);
    assert.ok(lesson.title.trim().length > 5, `${lesson.id} needs a descriptive title`);
  }
  for (const savedId of ['forex', 'candles', 'risk', 'trend', 'mindset']) {
    assert.ok(lessons.some(lesson => lesson.id === savedId), `${savedId} must retain saved completion and bookmarks`);
  }
});

test('nine ordered chapters contain every lesson exactly once with matching metadata', () => {
  assert.equal(lessonChapters.length, 9);
  assert.equal(new Set(lessonChapters.map(chapter => chapter.id)).size, 9);
  const membership = new Map();
  const orderedIds = [];
  for (const chapter of lessonChapters) {
    assert.ok(chapter.title.trim());
    assert.ok(chapter.lessonIds.length > 0);
    assert.equal(new Set(chapter.lessonIds).size, chapter.lessonIds.length);
    for (const id of chapter.lessonIds) {
      const lesson = lessons.find(item => item.id === id);
      assert.ok(lesson, `Chapter ${chapter.id} references missing lesson ${id}`);
      assert.equal(lesson.chapterId, chapter.id);
      assert.equal(lesson.category, chapter.category);
      membership.set(id, (membership.get(id) || 0) + 1);
      orderedIds.push(id);
    }
  }
  assert.equal(membership.size, 83);
  for (const lesson of lessons) assert.equal(membership.get(lesson.id), 1);
  assert.equal(JSON.stringify(orderedIds), JSON.stringify(lessons.map(lesson => lesson.id)));
});

test('every lesson contains a substantive explanation, practice prompt, and a usable quiz', () => {
  const explanations = new Set();
  for (const lesson of lessons) {
    assert.ok(Number.isInteger(lesson.minutes) && lesson.minutes > 0, `${lesson.id} has invalid duration`);
    assert.ok(lesson.description.trim().length >= 20, `${lesson.id} needs a practice description`);
    assert.ok(lesson.content.length >= 2, `${lesson.id} needs explanation and practice content`);
    assert.ok(lesson.content[0].trim().length >= 100, `${lesson.id} explanation is too short`);
    explanations.add(lesson.content[0].trim());
    for (const paragraph of lesson.content) {
      assert.equal(typeof paragraph, 'string');
      assert.ok(paragraph.trim().length >= 20, `${lesson.id} has empty or placeholder content`);
    }
    assert.ok(lesson.question.trim().length >= 15, `${lesson.id} needs a usable question`);
    assert.equal(lesson.answers.length, 3);
    assert.equal(new Set(lesson.answers.map(answer => answer.trim().toLowerCase())).size, 3, `${lesson.id} has duplicate answers`);
    for (const answer of lesson.answers) {
      assert.equal(typeof answer, 'string');
      assert.ok(answer.trim().length >= 3, `${lesson.id} has an empty answer`);
    }
    assert.ok(Number.isInteger(lesson.correct) && lesson.correct >= 0 && lesson.correct < lesson.answers.length, `${lesson.id} has an invalid correct-answer index`);
  }
  assert.equal(explanations.size, lessons.length, 'Lessons must not reuse the same explanation as filler');
  assert.ok(new Set(lessons.map(lesson => lesson.correct)).size > 1, 'Correct answers should not always occupy one position');
});
