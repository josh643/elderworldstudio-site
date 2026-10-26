import unittest
from pathlib import Path


class LakeWaterShaderTests(unittest.TestCase):
    def test_one_normal_map_sample_shapes_reflections_at_each_quality_tier(self):
        source = (Path(__file__).resolve().parents[1] / "site/office/core/exterior.js").read_text()
        lake = source.split("/* ---------- lake: water shader", 1)[1].split("/* ---------- street lamps", 1)[0]

        self.assertIn("new T.DataTexture(normalData, normalSize, normalSize", lake)
        self.assertIn("uniform sampler2D uWaterNormal", lake)
        self.assertIn("texture2D(uWaterNormal, uvA)", lake)
        self.assertIn("micro = mapA.xy * 0.24", lake)
        shader = lake.split("fragmentShader", 1)[1]
        self.assertEqual(shader.count("texture2D(uWaterNormal"), 1)
        self.assertNotIn("mapB", shader)
        self.assertIn("#ifdef WAVES4", shader)  # Higher tiers retain analytic wave detail without another texture fetch.
        self.assertIn("normalize(vec3(-gr.x + micro.x, 1.0, -gr.y + micro.y))", lake)
        self.assertIn("vec3 R = reflect(-V, n)", lake)
        self.assertIn("float ndv = max(dot(n, V), 0.0), fr =", lake)

    def test_reflection_and_shore_fades_use_defined_smoothstep_edges(self):
        source = (Path(__file__).resolve().parents[1] / "site/office/core/exterior.js").read_text()
        lake = source.split("/* ---------- lake: water shader", 1)[1].split("/* ---------- street lamps", 1)[0]

        self.assertIn("1.0 - smoothstep(0.0, 0.12, R.y)", lake)
        self.assertIn("1.0 - smoothstep(0.0, 0.3, vE)", lake)
        self.assertIn("1.0 - smoothstep(0.0, 0.03, vE)", lake)
        self.assertNotRegex(lake, r"smoothstep\(\s*0\.\d+\s*,\s*0\.0\s*,")


if __name__ == "__main__":
    unittest.main()
