import unittest
from pathlib import Path


class LakeWaterShaderTests(unittest.TestCase):
    def test_normal_map_shapes_the_reflection_at_each_quality_tier(self):
        source = (Path(__file__).resolve().parents[1] / "site/office/core/exterior.js").read_text()
        lake = source.split("/* ---------- lake: water shader", 1)[1].split("/* ---------- street lamps", 1)[0]

        self.assertIn("new T.DataTexture(normalData, normalSize, normalSize", lake)
        self.assertIn("uniform sampler2D uWaterNormal", lake)
        self.assertIn("texture2D(uWaterNormal, uvA)", lake)
        self.assertIn("micro = mapA.xy * 0.24", lake)
        shader = lake.split("fragmentShader", 1)[1]
        detail_guard = shader.index("#ifdef WAVES4")
        detail_sample = shader.index("vec3 mapB = texture2D(uWaterNormal, p * vec2(-0.23, 0.19)")
        self.assertLess(detail_guard, detail_sample)
        self.assertLess(detail_sample, shader.index("#endif", detail_sample))
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
