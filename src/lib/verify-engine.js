
function evaluateSeriesMirror(points, opts) {
  const statusByRun = {};
  const violations = [];
  
  const lots = new Map();
  points.forEach(p => {
    if (p.excluded) return;
    if (!lots.has(p.lot)) lots.set(p.lot, []);
    lots.get(p.lot).push(p);
  });

  const levels = [...new Set(points.map(p => p.level))];
  
  lots.forEach((lotPoints, lotId) => {
    levels.forEach(level => {
      const levelPoints = lotPoints.filter(p => p.level === level).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      if (levelPoints.length === 0) return;

      const zs = levelPoints.map(p => Number(p.z.toFixed(6)));

      levelPoints.forEach((p, i) => {
        if (Math.abs(zs[i]) > 3) {
          statusByRun[p.runKey] = 'oos';
        }
      });

      levelPoints.forEach((p, i) => {
        if (Math.abs(zs[i]) > 2) {
          if (statusByRun[p.runKey] !== 'oos') statusByRun[p.runKey] = 'warning';
        }
      });

      for (let i = 1; i < zs.length; i++) {
        if ((zs[i] > 2 && zs[i-1] > 2) || (zs[i] < -2 && zs[i-1] < -2)) {
          statusByRun[levelPoints[i].runKey] = 'oos';
        }
      }

      for (let i = 3; i < zs.length; i++) {
        const window = zs.slice(i-3, i+1);
        if ((window.every(z => z > 1) || window.every(z => z < -1))) {
          statusByRun[levelPoints[i].runKey] = 'oos';
        }
      }

      let sideStreak = 0;
      for (let i = 0; i < zs.length; i++) {
        if (zs[i] === 0) { sideStreak = 0; continue; }
        if (sideStreak === 0 || Math.sign(zs[i]) === Math.sign(zs[i-1])) {
          sideStreak++;
        } else {
          sideStreak = 1;
        }
        if (sideStreak >= 10) {
          statusByRun[levelPoints[i].runKey] = 'oos';
        }
      }
    });

    if (opts.levelsCount >= 2) {
      const runMap = new Map();
      points.forEach(p => {
        if (p.excluded) return;
        if (!runMap.has(p.runKey)) runMap.set(p.runKey, []);
        runMap.get(p.runKey).push(p);
      });

      runMap.forEach((runPoints, runKey) => {
        const zs_in_run = runPoints.map(p => p.z);
        if (zs_in_run.some(z => z > 2) && zs_in_run.some(z => z < -2)) {
          statusByRun[runKey] = 'oos';
        }
        const highCount = zs_in_run.filter(z => z > 2).length;
        const lowCount = zs_in_run.filter(z => z < -2).length;
        if (highCount >= 2 || lowCount >= 2) {
          statusByRun[runKey] = 'oos';
        }
      });
    }
  });

  return { statusByRun };
}

const test = (id, points, levelsCount, expected) => {
  const res = evaluateSeriesMirror(points, { levelsCount });
  const actual = Object.values(res.statusByRun).filter(s => s === 'oos').length;
  const status = actual === expected.reject ? '✅' : '❌';
  console.log(`${status} ${id}: Expected ${expected.reject} oos, got ${actual}`);
};

console.log('🚀 Running Regression Tests F1-F13...');

test('F1', [
  { runKey: 'r1', timestamp: '1', level: 'L1', lot: 'A', z: 0.2 },
  { runKey: 'r2', timestamp: '2', level: 'L1', lot: 'A', z: -2.3 },
  { runKey: 'r3', timestamp: '3', level: 'L1', lot: 'A', z: -2.4 },
], 1, { reject: 1 });

test('F3', [
  { runKey: 'r1', timestamp: '1', level: 'L1', lot: 'A', z: -3.2 },
], 1, { reject: 1 });

test('F4a', [
  { runKey: 'r1', timestamp: '1', level: 'L1', lot: 'A', z: -1.1 },
  { runKey: 'r2', timestamp: '2', level: 'L1', lot: 'A', z: -1.2 },
  { runKey: 'r3', timestamp: '3', level: 'L1', lot: 'A', z: -1.05 },
  { runKey: 'r4', timestamp: '4', level: 'L1', lot: 'A', z: -1.3 },
], 1, { reject: 1 });

test('F6a', [
  { runKey: 'r1', timestamp: '1', level: 'L1', lot: 'A', z: 2.3 },
  { runKey: 'r1', timestamp: '1', level: 'L2', lot: 'A', z: -2.1 },
], 2, { reject: 1 });

const f13 = [-1.3, -1.2, -2.2, -2.3, -2.9, -1.4, -1.1].map((z, i) => ({
  runKey: 'r'+(i+1), timestamp: (i+1).toString(), level: 'L1', lot: 'A', z: z
}));
test('F13', f13, 1, { reject: 4 });

console.log('\n🎉 Regression Test completed.');
