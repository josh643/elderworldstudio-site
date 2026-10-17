import contextlib
import hashlib
import http.server
import io
import json
import tempfile
import threading
import unittest
from pathlib import Path
from unittest import mock

from tools.xbox import wdp_install


class FakeWdpHandler(http.server.BaseHTTPRequestHandler):
    calls = []
    publisher = "CN=Elder World Studio Inc"

    def log_message(self, *_args):
        pass

    def _reply(self, status=200, data=None):
        body = json.dumps(data or {}).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        type(self).calls.append(("GET", self.path))
        if self.path == "/api/os/info":
            return self._reply(data={"osVersion": "fake"})
        if self.path == "/api/app/packagemanager/packages":
            return self._reply(data={"packages": [{
                "packageFullName": "EwsApp_1.0_x64__ews",
                "packageFamilyName": "EwsApp_ews",
                "publisher": type(self).publisher,
                "praid": "MainView",
            }]})
        if self.path == "/api/app/packagemanager/state":
            return self._reply(data={"state": "InstallComplete"})
        if self.path == "/api/resourcemanager/processes":
            return self._reply(data={"processes": [{"packageFamilyName": "EwsApp_ews"}]})
        if self.path == "/api/screenshot":
            self.send_response(404)
            self.end_headers()
            return
        return self._reply(404)

    def do_POST(self):
        size = int(self.headers.get("Content-Length", "0"))
        payload = self.rfile.read(size)
        type(self).calls.append(("POST", self.path, self.headers.get("Content-Type", ""), payload))
        return self._reply(data={"ok": True})

    def do_DELETE(self):
        type(self).calls.append(("DELETE", self.path))
        return self._reply(data={"ok": True})


class WdpInstallTests(unittest.TestCase):
    def setUp(self):
        FakeWdpHandler.calls = []
        FakeWdpHandler.publisher = "CN=Elder World Studio Inc"
        self.server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), FakeWdpHandler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.log = self.root / "installs.jsonl"
        self.base = f"http://127.0.0.1:{self.server.server_port}"

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=2)
        self.temp.cleanup()

    def cli(self, *args):
        return wdp_install.main([
            "--base-url", self.base,
            "--pin-file", str(self.root / "pin.txt"),
            "--log-file", str(self.log),
            "--qa-root", str(self.root / "reports/qa/runs"),
            *args,
        ])

    def test_status_reads_only_expected_endpoints_and_logs(self):
        with contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(self.cli("status"), 0)
        self.assertEqual(FakeWdpHandler.calls, [
            ("GET", "/api/os/info"),
            ("GET", "/api/app/packagemanager/packages"),
        ])
        log = [json.loads(line) for line in self.log.read_text().splitlines()]
        self.assertEqual([entry["method"] for entry in log if "method" in entry], ["GET", "GET"])

    def test_install_requires_matching_qa_and_uploads_multipart_then_polls(self):
        directory = self.root / "package"
        directory.mkdir()
        package = directory / "EwsApp.msix"
        package.write_bytes(b"approved package")
        (directory / "dependencies").mkdir()
        (directory / "dependencies" / "EwsDependency.appx").write_bytes(b"dependency")
        (directory / "signing.cer").write_bytes(b"certificate")
        digest = hashlib.sha256(package.read_bytes()).hexdigest()
        qa = self.root / "reports/qa/runs/run-1"
        qa.mkdir(parents=True)
        (qa / "qa.json").write_text(json.dumps({"verdict": "PASS", "package_sha256": digest}))
        with contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(self.cli("install", str(directory), "--poll-interval", "0"), 0)
        calls = FakeWdpHandler.calls
        self.assertEqual(calls[0][0:2], ("POST", "/api/app/packagemanager/package"))
        self.assertIn("multipart/form-data; boundary=", calls[0][2])
        self.assertIn(b'name="package"; filename="EwsApp.msix"', calls[0][3])
        self.assertIn(b'name="dependency"; filename="EwsDependency.appx"', calls[0][3])
        self.assertIn(b'name="certificate"; filename="signing.cer"', calls[0][3])
        self.assertEqual(calls[1], ("GET", "/api/app/packagemanager/state"))

    def test_install_refuses_without_qa_and_dry_run_against_fake_url_does_not_call_console(self):
        directory = self.root / "package"
        directory.mkdir()
        (directory / "EwsApp.msix").write_bytes(b"package")
        (directory / "signing.cer").write_bytes(b"cert")
        output = io.StringIO()
        with contextlib.redirect_stderr(output):
            self.assertEqual(self.cli("install", str(directory)), 2)
        self.assertIn("Install refused", output.getvalue())
        FakeWdpHandler.calls.clear()
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            self.assertEqual(self.cli("--dry-run", "status"), 0)
        self.assertIn("Would GET /api/os/info", output.getvalue())
        self.assertEqual(FakeWdpHandler.calls, [])

    def test_install_dry_run_checks_qa_and_prints_plan_without_http(self):
        directory = self.root / "package"
        directory.mkdir()
        package = directory / "EwsApp.msix"
        package.write_bytes(b"approved package")
        (directory / "signing.cer").write_bytes(b"certificate")
        digest = hashlib.sha256(package.read_bytes()).hexdigest()
        qa = self.root / "reports/qa/runs/run-2"
        qa.mkdir(parents=True)
        (qa / "qa.json").write_text(json.dumps({"verdict": "PASS", "package_sha256": digest}))
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            self.assertEqual(self.cli("install", str(directory), "--dry-run"), 0)
        self.assertIn("Would POST /api/app/packagemanager/package", output.getvalue())
        self.assertIn(digest, output.getvalue())
        self.assertEqual(FakeWdpHandler.calls, [])

    def test_uninstall_blocks_omnivael_and_only_deletes_ews_publisher(self):
        with contextlib.redirect_stderr(io.StringIO()):
            self.assertEqual(self.cli("uninstall", "Omnivael_1.0_x64__ews"), 2)
        self.assertEqual(FakeWdpHandler.calls, [])
        with contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(self.cli("uninstall", "EwsApp_1.0_x64__ews"), 0)
        self.assertEqual(FakeWdpHandler.calls[0], ("GET", "/api/app/packagemanager/packages"))
        self.assertTrue(FakeWdpHandler.calls[1][0:2] ==
                        ("DELETE", "/api/app/packagemanager/package?package=EwsApp_1.0_x64__ews"))

    def test_uninstall_refuses_other_publishers_without_delete(self):
        FakeWdpHandler.publisher = "CN=Some Other Publisher"
        with contextlib.redirect_stderr(io.StringIO()) as output:
            self.assertEqual(self.cli("uninstall", "EwsApp_1.0_x64__ews"), 2)
        self.assertIn("Refusing to uninstall", output.getvalue())
        self.assertEqual(FakeWdpHandler.calls, [("GET", "/api/app/packagemanager/packages")])

    def test_smoke_launches_checks_process_and_stops(self):
        with mock.patch.object(wdp_install.time, "sleep"):
            with contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(self.cli("smoke", "EwsApp_ews"), 0)
        calls = FakeWdpHandler.calls
        self.assertEqual(calls[0], ("GET", "/api/app/packagemanager/packages"))
        self.assertEqual(calls[1][0:2], ("POST", "/api/taskmanager/app"))
        launch = json.loads(calls[1][3])
        self.assertEqual(launch["appid"], "TWFpblZpZXc=")
        self.assertEqual(launch["package"], "RXdzQXBwX2V3cw==")
        self.assertEqual(calls[2], ("GET", "/api/resourcemanager/processes"))
        self.assertEqual(calls[-1][0], "DELETE")
        report = self.log.with_name(self.log.name + ".smoke.jsonl")
        self.assertTrue(json.loads(report.read_text().splitlines()[-1])["stopped"])

    def test_fetch_verifies_checksums(self):
        package = self.root / "sample.msix"
        package.write_bytes(b"package")
        digest = hashlib.sha256(package.read_bytes()).hexdigest()
        sums = self.root / "SHA256SUMS"
        sums.write_text(f"{digest}  sample.msix\n")
        self.assertEqual(wdp_install.verify_sha256sums(self.root), sums)
        package.write_bytes(b"tampered")
        with self.assertRaises(wdp_install.ToolError):
            wdp_install.verify_sha256sums(self.root)

    def test_certificate_pin_is_saved_once_and_mismatch_fails_closed(self):
        pin = self.root / "pin.txt"
        client = wdp_install.WdpClient(self.base, pin, wdp_install.CallLogger(self.log))
        client._check_or_pin(b"fake certificate")
        self.assertEqual(pin.read_text().strip(), hashlib.sha256(b"fake certificate").hexdigest())
        client._check_or_pin(b"fake certificate")
        with self.assertRaises(wdp_install.ToolError):
            client._check_or_pin(b"different certificate")

    def test_fetch_dry_run_prints_github_get_without_network(self):
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            self.assertEqual(self.cli("fetch", "elderworldstudio/build", "v1.0", "--dry-run"), 0)
        self.assertIn("Would GET https://api.github.com/repos/elderworldstudio/build/releases/tags/v1.0", output.getvalue())
        self.assertEqual(FakeWdpHandler.calls, [])


if __name__ == "__main__":
    unittest.main()
