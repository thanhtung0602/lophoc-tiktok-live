const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

class MockStudentSprite {
  constructor(scene, x, y, student) {
    this.deskIndex = student.deskIndex;
    this.score = student.score || student.currentScore || student.cumulativeScore || 0;
    this.x = x;
    this.y = y;
    this.destroyed = false;
  }

  setScale() {}
  setDepth() {}
  updateScore(score) {
    this.score = score;
  }
  destroy() {
    this.destroyed = true;
  }
}

const context = {
  Phaser: { Scene: class {} },
  StudentSprite: MockStudentSprite,
  window: {}
};
const sceneSource = fs.readFileSync(
  path.join(__dirname, '..', 'public', 'js', 'game', 'ClassroomScene.js'),
  'utf8'
);
vm.runInNewContext(sceneSource, context, { filename: 'ClassroomScene.js' });
const ClassroomScene = context.window.ClassroomScene;

function createScene() {
  const scene = Object.create(ClassroomScene.prototype);
  scene.studentSprites = new Map();
  scene.deskPositions = [{ x: 10, y: 20 }, { x: 30, y: 40 }, { x: 50, y: 60 }];
  scene.emptyDeskVisuals = scene.deskPositions.map(() => ({
    occupied: false,
    badgeContainer: {
      visible: true,
      setVisible(visible) {
        this.visible = visible;
      }
    }
  }));
  scene.scale = { height: 1280, width: 720 };
  return scene;
}

function testSnapshotReconcilesStudentsAndDesks() {
  const scene = createScene();
  scene.syncStudents([
    { username: 'student-a', deskIndex: 0, score: 2 },
    { username: 'student-b', deskIndex: 1, score: 4 },
    { username: 'student-waiting', deskIndex: -1 }
  ]);
  const originalStudentA = scene.studentSprites.get('student-a');
  const originalStudentB = scene.studentSprites.get('student-b');
  assert.ok(originalStudentA);
  assert.ok(originalStudentB);
  assert.strictEqual(scene.emptyDeskVisuals[0].badgeContainer.visible, false);

  scene.syncStudents([
    { username: 'student-a', deskIndex: 2, score: 12 },
    { username: 'student-b', deskIndex: 99 }
  ]);

  const movedStudentA = scene.studentSprites.get('student-a');
  assert.notStrictEqual(movedStudentA, originalStudentA);
  assert.strictEqual(originalStudentA.destroyed, true);
  assert.strictEqual(originalStudentB.destroyed, true);
  assert.strictEqual(scene.studentSprites.has('student-b'), false);
  assert.strictEqual(movedStudentA.score, 12);
  assert.strictEqual(scene.emptyDeskVisuals[0].badgeContainer.visible, true);
  assert.strictEqual(scene.emptyDeskVisuals[1].badgeContainer.visible, true);
  assert.strictEqual(scene.emptyDeskVisuals[2].occupied, true);
  assert.strictEqual(scene.emptyDeskVisuals[2].badgeContainer.visible, false);
}

function testInvalidDeskDoesNotRemoveExistingStudent() {
  const scene = createScene();
  scene.addStudentToDesk({ username: 'student-a', deskIndex: 0 }, false);
  const sprite = scene.studentSprites.get('student-a');

  scene.addStudentToDesk({ username: 'student-a', deskIndex: 3 }, false);

  assert.strictEqual(scene.studentSprites.get('student-a'), sprite);
  assert.strictEqual(sprite.destroyed, false);
  assert.strictEqual(scene.emptyDeskVisuals[0].occupied, true);
}

function testRevealWithoutCorrectStudentsDoesNotThrow() {
  const scene = createScene();
  const handlers = {};
  context.io = () => ({
    on(event, handler) {
      handlers[event] = handler;
    }
  });
  scene.board = { revealAnswer() {} };
  scene.teacher = { playPraiseAnimation() {} };

  scene.initSocketConnection();
  assert.doesNotThrow(() => handlers['question:revealed']({
    correctAnswer: 'A',
    explanation: 'Test'
  }));
}

function testShutdownDisconnectsSocketAndRemovesListeners() {
  const scene = createScene();
  let removedResizeHandler = false;
  let removedSocketListeners = false;
  let disconnected = false;
  scene.scale.off = () => {
    removedResizeHandler = true;
  };
  scene.socket = {
    removeAllListeners() {
      removedSocketListeners = true;
    },
    disconnect() {
      disconnected = true;
    }
  };
  scene.teacherSpeakingHandler = () => {};
  context.window.soundManager = {
    onTeacherSpeakingChange: scene.teacherSpeakingHandler
  };

  scene.handleShutdown();

  assert.strictEqual(removedResizeHandler, true);
  assert.strictEqual(removedSocketListeners, true);
  assert.strictEqual(disconnected, true);
  assert.strictEqual(scene.socket, null);
  assert.strictEqual(context.window.soundManager.onTeacherSpeakingChange, null);
}

for (const [name, test] of [
  ['Reconcile student snapshots and desk occupancy', testSnapshotReconcilesStudentsAndDesks],
  ['Preserve students when receiving invalid desk indices', testInvalidDeskDoesNotRemoveExistingStudent],
  ['Handle reveal events with no correct-student list', testRevealWithoutCorrectStudentsDoesNotThrow],
  ['Clean up socket and listeners on scene shutdown', testShutdownDisconnectsSocketAndRemovesListeners]
]) {
  test();
  console.log(`  PASS ${name}`);
}
