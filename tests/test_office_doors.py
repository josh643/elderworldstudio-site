import subprocess
import unittest
from pathlib import Path


DOOR_MODULE = Path(__file__).resolve().parents[1] / 'site' / 'office' / 'core' / 'doors.mjs'


class OfficeDoorBehaviorTest(unittest.TestCase):
    def run_node(self, body):
        script = f"import {{ nearDoor, nextDoorOpen, registerSlidingDoors }} from {DOOR_MODULE.as_uri()!r};\n{body}"
        return subprocess.run(
            ['node', '--input-type=module', '-e', script],
            check=True,
            capture_output=True,
            text=True,
        )

    def test_sliding_door_opens_and_clears_its_collision_gap(self):
        self.run_node("""
const ctx = { extraCols: [], player: { pos: { x: 0, z: 0 } } };
const leaves = [{ position: { x: -0.625 } }, { position: { x: 0.625 } }];
const door = registerSlidingDoors(ctx, leaves, { centerX: 0, centerZ: 0, width: 1.25 });
if (door.update(1) !== 1) throw new Error('near door did not fully open');
if (leaves[0].position.x >= -0.6 || leaves[1].position.x <= 0.6) throw new Error('leaves did not slide apart');
if (ctx.extraCols[0][2] >= ctx.extraCols[1][0]) throw new Error('doorway collision gap is still blocked');
ctx.player.pos = { x: 0, z: 6 };
if (door.update(1) !== 0) throw new Error('door did not close after leaving trigger range');
if (ctx.extraCols[1][0] - ctx.extraCols[0][2] > 0.05) throw new Error('closed door leaves no longer block the doorway');
""")

    def test_trigger_range_and_transition_are_bounded(self):
        self.run_node("""
if (!nearDoor({ x: 2, z: 0 }, { x: 0, z: 0 }, 3)) throw new Error('nearby position did not trigger');
if (nearDoor({ x: 3, z: 0 }, { x: 0, z: 0 }, 3)) throw new Error('trigger should stop at radius');
if (nextDoorOpen(0, true, 0.1) <= 0) throw new Error('door did not begin opening');
if (nextDoorOpen(0, true, 1) !== 1) throw new Error('large frame step must clamp at fully open');
if (nextDoorOpen(1, false, 1) !== 0) throw new Error('large frame step must clamp at fully closed');
""")


if __name__ == '__main__':
    unittest.main()
