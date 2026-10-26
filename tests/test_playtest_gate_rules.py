import unittest

from tools.office.gate_rules import VISUAL_RULES, http_error, is_pve_mini_3070, meets_perf_floor, missing_views


class PlaytestGateRulesTest(unittest.TestCase):
    def test_http_404_is_reported_and_query_is_removed(self):
        self.assertEqual(
            http_error(404, 'https://preview.test/api/missing?op=state', 'GET', 'fetch'),
            {
                'status': 404,
                'url': 'https://preview.test/api/missing',
                'method': 'GET',
                'type': 'fetch',
            },
        )

    def test_successful_http_response_is_not_an_error(self):
        self.assertIsNone(http_error(200, 'https://preview.test/office/', 'GET', 'document'))

    def test_missing_required_screenshots_are_reported(self):
        self.assertEqual(missing_views(('lobby', 'gate'), {}), ['gate', 'lobby'])
        self.assertEqual(missing_views(('lobby', 'gate'), {'lobby': {}}), ['gate'])
        self.assertEqual(missing_views(('lobby',), {'lobby': {}}), [])

    def test_fps_floor_fails_closed_and_accepts_45(self):
        self.assertFalse(meets_perf_floor(None))
        self.assertFalse(meets_perf_floor('unmeasured'))
        self.assertFalse(meets_perf_floor(44.99))
        self.assertTrue(meets_perf_floor(45))

    def test_target_tier_requires_identified_rtx_3070(self):
        self.assertTrue(is_pve_mini_3070('NVIDIA GeForce RTX 3070/PCIe/SSE2'))
        self.assertFalse(is_pve_mini_3070('SwiftShader Device (Subzero)'))
        self.assertFalse(is_pve_mini_3070(''))

    def test_visual_rules_keep_joshua_checks(self):
        self.assertEqual(
            VISUAL_RULES,
            ('stylized-realistic look', 'no billboard trees', 'no bare poles',
             'real lamps', 'nothing floating', 'no pointless animation'),
        )


if __name__ == '__main__':
    unittest.main()
