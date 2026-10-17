#!/usr/bin/env python3
"""Small, fail-closed Xbox Device Portal helper for Elder World Studio packages."""

from __future__ import annotations

import argparse
import base64
import hashlib
import http.client
import json
import os
import re
import shutil
import ssl
import stat
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, BinaryIO, Iterable


DEFAULT_URL = "https://10.0.0.33:11443"
DEFAULT_PIN = Path("/var/lib/ews-agent/xbox/wdp_pin.txt")
DEFAULT_LOG = Path("/var/lib/ews-agent/xbox/installs.jsonl")
PUBLISHER = "CN=Elder World Studio Inc"
PACKAGE_EXTENSIONS = {".appx", ".msix", ".appxbundle", ".msixbundle"}
MAX_RESPONSE = 32 * 1024 * 1024
MAX_DOWNLOAD = 4 * 1024 * 1024 * 1024


class ToolError(Exception):
    pass


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def append_jsonl(path: Path, item: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd = os.open(path, os.O_WRONLY | os.O_APPEND | os.O_CREAT, 0o600)
    with os.fdopen(fd, "a", encoding="utf-8") as stream:
        stream.write(json.dumps(item, sort_keys=True) + "\n")


class CallLogger:
    def __init__(self, path: Path):
        self.path = path

    def record(self, method: str, url: str, status: int | None, error: str | None = None,
               command: str | None = None) -> None:
        # Never record headers, request bodies, response bodies, or credentials.
        append_jsonl(self.path, {
            "time": now_iso(), "method": method, "url": url,
            "status": status, "error": error, "command": command,
        })


class WdpClient:
    def __init__(self, base_url: str, pin_file: Path, logger: CallLogger,
                 timeout: float = 30.0):
        self.base_url = base_url.rstrip("/")
        self.pin_file = pin_file
        self.logger = logger
        self.timeout = timeout
        self.user = os.environ.get("WDP_USER")
        self.password = os.environ.get("WDP_PASS")
        self.auth_header = None
        if self.user is not None or self.password is not None:
            if not self.user or self.password is None:
                raise ToolError("Set both WDP_USER and WDP_PASS, or neither.")
            token = base64.b64encode(f"{self.user}:{self.password}".encode()).decode("ascii")
            self.auth_header = "Basic " + token
        parsed = urllib.parse.urlsplit(self.base_url)
        if parsed.scheme not in ("http", "https") or not parsed.hostname:
            raise ToolError("Base URL must be an http:// or https:// URL with a host.")
        if parsed.username or parsed.password or parsed.query or parsed.fragment or parsed.path not in ("", "/"):
            raise ToolError("Base URL must contain only scheme, host, and optional port.")
        self.parsed = parsed

    def _pin_digest(self, cert: bytes) -> str:
        return hashlib.sha256(cert).hexdigest()

    def _check_or_pin(self, cert: bytes) -> None:
        digest = self._pin_digest(cert)
        if self.pin_file.exists():
            if self.pin_file.is_symlink():
                raise ToolError("Certificate pin file must not be a symlink.")
            pinned = self.pin_file.read_text(encoding="ascii").strip().lower()
            if not re.fullmatch(r"[0-9a-f]{64}", pinned):
                raise ToolError(f"Invalid certificate pin file: {self.pin_file}")
            if digest != pinned:
                raise ToolError("TLS certificate fingerprint does not match the saved pin.")
            return
        self.pin_file.parent.mkdir(parents=True, exist_ok=True)
        try:
            fd = os.open(self.pin_file, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        except FileExistsError:
            return self._check_or_pin(cert)
        with os.fdopen(fd, "w", encoding="ascii") as stream:
            stream.write(digest + "\n")

    def request(self, method: str, route: str, body: bytes | BinaryIO | None = None,
                headers: dict[str, str] | None = None) -> tuple[int, bytes, dict[str, str]]:
        path = route if route.startswith("/") else "/" + route
        url = self.base_url + path
        request_headers = dict(headers or {})
        if self.auth_header:
            request_headers["Authorization"] = self.auth_header
        try:
            if self.parsed.scheme == "http":
                connection: Any = http.client.HTTPConnection(
                    self.parsed.hostname, self.parsed.port, timeout=self.timeout)
            else:
                # WDP commonly uses a self-signed certificate. Establish TLS, then
                # verify the DER certificate against the locally saved SHA-256 pin.
                context = ssl._create_unverified_context()
                connection = http.client.HTTPSConnection(
                    self.parsed.hostname, self.parsed.port or 443,
                    timeout=self.timeout, context=context)
            connection.connect()
            if self.parsed.scheme == "https":
                cert = connection.sock.getpeercert(binary_form=True)
                if not cert:
                    raise ToolError("Console did not present a TLS certificate.")
                self._check_or_pin(cert)
            if body is not None and not isinstance(body, bytes):
                connection.putrequest(method, path)
                for key, value in request_headers.items():
                    connection.putheader(key, value)
                connection.endheaders()
                while True:
                    chunk = body.read(1024 * 1024)
                    if not chunk:
                        break
                    connection.send(chunk)
            else:
                connection.request(method, path, body=body, headers=request_headers)
            response = connection.getresponse()
            response_body = response.read(MAX_RESPONSE + 1)
            if len(response_body) > MAX_RESPONSE:
                raise ToolError("Response exceeded the 32 MiB safety limit.")
            status = response.status
            response_headers = {k.lower(): v for k, v in response.getheaders()}
            connection.close()
            self.logger.record(method, url, status)
            return status, response_body, response_headers
        except Exception as exc:
            try:
                connection.close()
            except Exception:
                pass
            self.logger.record(method, url, None, type(exc).__name__)
            if isinstance(exc, ToolError):
                raise
            raise ToolError(f"{method} {path} failed: {type(exc).__name__}: {exc}") from exc

    def json_request(self, method: str, route: str, data: Any = None) -> Any:
        body = None if data is None else json.dumps(data).encode("utf-8")
        headers = {} if body is None else {"Content-Type": "application/json"}
        status, payload, _ = self.request(method, route, body, headers)
        if status < 200 or status >= 300:
            raise ToolError(f"WDP returned HTTP {status} for {route}.")
        if not payload:
            return None
        try:
            return json.loads(payload)
        except json.JSONDecodeError as exc:
            raise ToolError(f"WDP returned invalid JSON for {route}.") from exc


def package_files(root: Path) -> tuple[Path, list[Path], list[Path]]:
    if not root.is_dir():
        raise ToolError(f"Install directory does not exist: {root}")
    all_paths = list(root.rglob("*"))
    if any(path.is_symlink() for path in all_paths):
        raise ToolError("Install directory must not contain symlinks.")
    all_files = sorted(p for p in all_paths if p.is_file())
    packages = [p for p in all_files if p.suffix.lower() in PACKAGE_EXTENSIONS]
    certs = [p for p in all_files if p.suffix.lower() == ".cer"]
    # A bundle is the main package when present; otherwise require one root-level
    # package and treat nested packages as dependencies.
    bundles = [p for p in packages if p.suffix.lower() in (".appxbundle", ".msixbundle")]
    if len(bundles) > 1:
        raise ToolError("Install directory has more than one app bundle.")
    if bundles:
        main = bundles[0]
    else:
        top_level = [p for p in packages if p.parent == root]
        candidates = top_level if top_level else packages
        if len(candidates) != 1:
            raise ToolError("Expected exactly one main .appx/.msix package (or bundle).")
        main = candidates[0]
    deps = [p for p in packages if p != main]
    if not certs:
        raise ToolError("Install directory must include at least one .cer certificate.")
    return main, deps, certs


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def has_qa_pass(qa_root: Path, digest: str) -> Path | None:
    if not qa_root.is_dir():
        return None
    for path in sorted(qa_root.glob("*/qa.json")):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        if not isinstance(data, dict) or str(data.get("verdict", "")).upper() != "PASS":
            continue
        def matching_hash(value: Any, key: str = "") -> bool:
            if isinstance(value, dict):
                return any(matching_hash(v, str(k).lower()) for k, v in value.items())
            if isinstance(value, list):
                return any(matching_hash(v, key) for v in value)
            return ("sha" in key or "hash" in key) and isinstance(value, str) and value.lower() == digest
        if matching_hash(data):
            return path
    return None


def multipart_payload(main: Path, dependencies: Iterable[Path], certs: Iterable[Path]) -> tuple[BinaryIO, str, int]:
    boundary = "----EWSWDP" + os.urandom(18).hex()
    stream = tempfile.TemporaryFile(mode="w+b")
    total = 0
    def write(data: bytes) -> None:
        nonlocal total
        total += len(data)
        if total > MAX_DOWNLOAD:
            raise ToolError("Package upload exceeded the 4 GiB safety limit.")
        stream.write(data)
    def add(field: str, file: Path) -> None:
        safe_name = file.name.replace('"', "_").replace("\r", "_").replace("\n", "_")
        write(f"--{boundary}\r\n".encode())
        write(f'Content-Disposition: form-data; name="{field}"; filename="{safe_name}"\r\n'.encode())
        write(b"Content-Type: application/octet-stream\r\n\r\n")
        with file.open("rb") as source:
            for chunk in iter(lambda: source.read(1024 * 1024), b""):
                write(chunk)
        write(b"\r\n")
    try:
        add("package", main)
        for file in dependencies:
            add("dependency", file)
        for file in certs:
            add("certificate", file)
        write(f"--{boundary}--\r\n".encode())
        length = stream.tell()
        stream.seek(0)
        return stream, "multipart/form-data; boundary=" + boundary, length
    except Exception:
        stream.close()
        raise


def multipart_install(client: WdpClient, main: Path, deps: list[Path], certs: list[Path]) -> Any:
    body, content_type, length = multipart_payload(main, deps, certs)
    try:
        status, payload, _ = client.request(
            "POST", "/api/app/packagemanager/package", body,
            {"Content-Type": content_type, "Content-Length": str(length)})
    finally:
        body.close()
    if status < 200 or status >= 300:
        raise ToolError(f"WDP returned HTTP {status} while uploading the package.")
    if not payload:
        return None
    try:
        return json.loads(payload)
    except json.JSONDecodeError:
        return payload.decode("utf-8", "replace")[:400]


def wait_install(client: WdpClient, timeout: float, interval: float) -> Any:
    deadline = time.monotonic() + timeout
    last: Any = None
    while True:
        last = client.json_request("GET", "/api/app/packagemanager/state")
        states: list[str] = []
        def collect(value: Any, key: str = "") -> None:
            if isinstance(value, dict):
                for k, v in value.items():
                    collect(v, str(k).lower())
            elif isinstance(value, list):
                for v in value:
                    collect(v, key)
            elif key in ("state", "status", "result"):
                states.append(str(value).lower())
        collect(last)
        normalized = {re.sub(r"[^a-z]", "", state) for state in states}
        if any(state.startswith(("failed", "error", "cancel")) for state in normalized):
            raise ToolError(f"Package installation failed: {last}")
        if normalized.intersection({"complete", "completed", "installcomplete", "success", "succeeded", "installed"}):
            return last
        if time.monotonic() >= deadline:
            raise ToolError(f"Timed out waiting for package manager state: {last}")
        time.sleep(min(interval, max(0.0, deadline - time.monotonic())))


def find_package(packages: Any, full_name: str) -> dict[str, Any] | None:
    found = None
    def walk(value: Any) -> None:
        nonlocal found
        if isinstance(value, dict):
            names = [v for k, v in value.items() if str(k).lower() in
                     ("packagefullname", "package_full_name")]
            if any(isinstance(n, str) and n == full_name for n in names):
                found = value
                return
            for child in value.values():
                walk(child)
        elif isinstance(value, list):
            for child in value:
                walk(child)
    walk(packages)
    return found


def find_family_package(packages: Any, family_name: str) -> dict[str, Any] | None:
    found = None
    def walk(value: Any) -> None:
        nonlocal found
        if isinstance(value, dict):
            names = [v for k, v in value.items() if str(k).lower() in
                     ("packagefamilyname", "package_family_name")]
            if any(isinstance(n, str) and n == family_name for n in names):
                found = value
                return
            for child in value.values():
                walk(child)
        elif isinstance(value, list):
            for child in value:
                walk(child)
    walk(packages)
    return found


def get_praid(package: dict[str, Any]) -> str | None:
    keys = ("praid", "applicationid", "application_id", "app_relative_id")
    for key, value in package.items():
        if str(key).lower() in keys and isinstance(value, str) and value:
            return value
    apps = package.get("applications")
    if isinstance(apps, list):
        for app in apps:
            if isinstance(app, dict):
                for key, value in app.items():
                    if str(key).lower() in keys and isinstance(value, str) and value:
                        return value
    return None


def get_publisher(package: dict[str, Any]) -> str | None:
    for key, value in package.items():
        if str(key).lower() in ("publisher", "publishername") and isinstance(value, str):
            return value
    return None


def encode_b64(value: str) -> str:
    return base64.b64encode(value.encode("utf-8")).decode("ascii")


def walk_text(data: Any) -> str:
    pieces: list[str] = []
    def walk(value: Any) -> None:
        if isinstance(value, dict):
            for k, v in value.items():
                pieces.append(str(k))
                walk(v)
        elif isinstance(value, list):
            for v in value:
                walk(v)
        elif isinstance(value, (str, int)):
            pieces.append(str(value))
    walk(data)
    return " ".join(pieces).casefold()


def safe_extract(archive: Path, destination: Path) -> None:
    with zipfile.ZipFile(archive) as zf:
        extracted_size = 0
        for info in zf.infolist():
            if "\\" in info.filename:
                raise ToolError("Artifact ZIP contains an unsafe path.")
            if stat.S_ISLNK(info.external_attr >> 16):
                raise ToolError("Artifact ZIP contains a symlink.")
            extracted_size += info.file_size
            if extracted_size > MAX_DOWNLOAD:
                raise ToolError("Artifact ZIP expands beyond the 4 GiB safety limit.")
            member = Path(info.filename)
            if member.is_absolute() or ".." in member.parts:
                raise ToolError("Artifact ZIP contains an unsafe path.")
            target = (destination / member).resolve()
            if destination.resolve() not in (target, *target.parents):
                raise ToolError("Artifact ZIP contains an unsafe path.")
            if target.exists() and (not info.is_dir() or not target.is_dir()):
                raise ToolError("Artifact ZIP would overwrite an existing file.")
        zf.extractall(destination)


def verify_sha256sums(root: Path) -> Path:
    checksum_files = list(root.rglob("SHA256SUMS"))
    if not checksum_files:
        raise ToolError("Artifact must contain a SHA256SUMS file.")
    for sums_file in checksum_files:
        checked = 0
        for line in sums_file.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line:
                continue
            match = re.fullmatch(r"([0-9a-fA-F]{64})\s+\*?(.+)", line)
            if not match:
                raise ToolError(f"Invalid SHA256SUMS line in {sums_file.name}.")
            expected, filename = match.groups()
            relative = Path(filename)
            if relative.is_absolute() or ".." in relative.parts:
                raise ToolError("SHA256SUMS contains an unsafe path.")
            target = (sums_file.parent / relative).resolve()
            if sums_file.parent.resolve() not in (target, *target.parents) or not target.is_file():
                raise ToolError(f"SHA256SUMS references a missing or unsafe file: {filename}")
            actual = sha256_file(target)
            if actual.lower() != expected.lower():
                raise ToolError(f"SHA256 mismatch for {filename}.")
            checked += 1
        if checked == 0:
            raise ToolError(f"SHA256SUMS file is empty: {sums_file}")
    return checksum_files[0]


def github_get(url: str, logger: CallLogger, token: str | None) -> tuple[bytes, str]:
    headers = {"Accept": "application/vnd.github+json", "User-Agent": "EWS-WDP-Installer"}
    if token:
        headers["Authorization"] = "Bearer " + token
    request = urllib.request.Request(url, headers=headers, method="GET")
    try:
        with urllib.request.urlopen(request, timeout=45) as response:
            data = response.read(MAX_RESPONSE + 1)
            if len(data) > MAX_RESPONSE:
                raise ToolError("GitHub API response exceeded the 32 MiB safety limit.")
            content_type = response.headers.get("Content-Type", "")
            logger.record("GET", url, response.status, command="fetch")
            return data, content_type
    except urllib.error.HTTPError as exc:
        logger.record("GET", url, exc.code, f"HTTPError", "fetch")
        raise ToolError(f"GitHub returned HTTP {exc.code} for {urllib.parse.urlsplit(url).path}.") from exc
    except Exception as exc:
        logger.record("GET", url, None, type(exc).__name__, "fetch")
        if isinstance(exc, ToolError):
            raise
        raise ToolError(f"GitHub GET failed: {type(exc).__name__}: {exc}") from exc


def github_download(url: str, target: Path, logger: CallLogger, token: str | None) -> None:
    headers = {"Accept": "application/vnd.github+json", "User-Agent": "EWS-WDP-Installer"}
    if token:
        headers["Authorization"] = "Bearer " + token
    request = urllib.request.Request(url, headers=headers, method="GET")
    try:
        with urllib.request.urlopen(request, timeout=90) as response, target.open("wb") as output:
            count = 0
            while True:
                chunk = response.read(1024 * 1024)
                if not chunk:
                    break
                count += len(chunk)
                if count > MAX_DOWNLOAD:
                    raise ToolError("Artifact exceeded the 4 GiB download safety limit.")
                output.write(chunk)
            logger.record("GET", url, response.status, command="fetch")
    except urllib.error.HTTPError as exc:
        logger.record("GET", url, exc.code, "HTTPError", "fetch")
        raise ToolError(f"GitHub returned HTTP {exc.code} for {urllib.parse.urlsplit(url).path}.") from exc
    except Exception as exc:
        logger.record("GET", url, None, type(exc).__name__, "fetch")
        try:
            target.unlink()
        except OSError:
            pass
        if isinstance(exc, ToolError):
            raise
        raise ToolError(f"GitHub download failed: {type(exc).__name__}: {exc}") from exc


def fetch_artifact(repo: str, ref: str, destination: Path, logger: CallLogger,
                   dry_run: bool) -> Path:
    if not re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", repo):
        raise ToolError("Repository must be owner/name.")
    if not re.fullmatch(r"[A-Za-z0-9_.-]+", ref):
        raise ToolError("Release tag or workflow run id has invalid characters.")
    is_run = ref.isdecimal()
    api_root = "https://api.github.com/repos/" + repo
    url = (f"{api_root}/actions/runs/{ref}/artifacts" if is_run else
           f"{api_root}/releases/tags/{urllib.parse.quote(ref, safe='')}")
    if dry_run:
        print(f"Would GET {url}")
        print(f"Would download, safely extract, and verify SHA256SUMS under {destination}")
        logger.record("GET", url, None, command="fetch-dry-run")
        return destination
    token = os.environ.get("GH_TOKEN")
    api_data, _ = github_get(url, logger, token)
    try:
        metadata = json.loads(api_data)
    except json.JSONDecodeError as exc:
        raise ToolError("GitHub returned invalid artifact metadata.") from exc
    if is_run:
        artifacts = metadata.get("artifacts", [])
        if not artifacts:
            raise ToolError("GitHub Actions run has no artifacts.")
        if len(artifacts) > 1:
            build_artifacts = [a for a in artifacts if "build" in str(a.get("name", "")).casefold()]
            if len(build_artifacts) != 1:
                raise ToolError("Workflow run has multiple artifacts and no unique artifact named with 'build'.")
            selected = build_artifacts[0]
        else:
            selected = artifacts[0]
        asset_url = selected.get("archive_download_url")
        asset_name = selected.get("name", "workflow-artifact.zip")
        urls = [(asset_name, asset_url)]
    else:
        assets = metadata.get("assets", [])
        urls = [(a.get("name", "asset"), a.get("browser_download_url")) for a in assets]
    urls = [(name, url) for name, url in urls if isinstance(url, str) and url.startswith("https://")]
    if not urls:
        raise ToolError("Release/run has no downloadable artifacts.")
    if destination.exists():
        raise ToolError(f"Fetch destination already exists; refusing to overwrite: {destination}")
    destination.parent.mkdir(parents=True, exist_ok=True)
    stage = destination.parent / ("." + destination.name + ".fetch-" + os.urandom(6).hex())
    stage.mkdir()
    try:
        with tempfile.TemporaryDirectory(prefix="ews-wdp-") as temp_name:
            temp = Path(temp_name)
            for index, (name, download_url) in enumerate(urls):
                # Release assets are fetched from the GitHub CDN with no Authorization
                # header; Actions artifact API URLs use the authorized API endpoint.
                hostname = urllib.parse.urlsplit(download_url).hostname or ""
                download_token = token if hostname == "api.github.com" else None
                asset_name = Path(name).name
                archive = temp / f"asset-{index}"
                github_download(download_url, archive, logger, download_token)
                saved_asset = stage / asset_name
                if saved_asset.exists():
                    raise ToolError(f"Duplicate GitHub artifact filename: {asset_name}")
                shutil.copyfile(archive, saved_asset)
                if zipfile.is_zipfile(archive):
                    extracted = stage / f"artifact-{index}"
                    extracted.mkdir()
                    safe_extract(archive, extracted)
            verify_sha256sums(stage)
        stage.rename(destination)
    except Exception:
        shutil.rmtree(stage, ignore_errors=True)
        raise
    return destination


def record_action(logger: CallLogger, action: str, detail: dict[str, Any], dry_run: bool = False) -> None:
    append_jsonl(logger.path, {"time": now_iso(), "action": action, "dry_run": dry_run, **detail})


def run(args: argparse.Namespace) -> int:
    logger = CallLogger(args.log_file)
    if args.command == "fetch":
        folder = args.download_dir / re.sub(r"[^A-Za-z0-9_.-]", "_", args.repo) / re.sub(r"[^A-Za-z0-9_.-]", "_", args.ref)
        out = fetch_artifact(args.repo, args.ref, folder, logger, args.dry_run)
        if not args.dry_run:
            print(out)
        return 0

    client = WdpClient(args.base_url, args.pin_file, logger, args.timeout)
    if args.command == "status":
        if args.dry_run:
            print("Would GET /api/os/info and /api/app/packagemanager/packages (read-only)")
            record_action(logger, "status", {"base_url": args.base_url}, True)
            return 0
        info = client.json_request("GET", "/api/os/info")
        packages = client.json_request("GET", "/api/app/packagemanager/packages")
        print(json.dumps({"os": info, "packages": packages}, indent=2))
        record_action(logger, "status", {})
        return 0
    if args.command == "install":
        main, deps, certs = package_files(args.directory)
        digest = sha256_file(main)
        qa = has_qa_pass(args.qa_root, digest)
        if qa is None:
            raise ToolError(f"Install refused: no QA PASS for package SHA256 {digest} under {args.qa_root}.")
        description = {"package": str(main), "sha256": digest,
                       "dependencies": [str(p) for p in deps], "certificates": [str(p) for p in certs],
                       "qa": str(qa)}
        if args.dry_run:
            print("Would POST /api/app/packagemanager/package with:")
            print(json.dumps(description, indent=2))
            print(f"Would poll /api/app/packagemanager/state for up to {args.install_timeout:g}s")
            record_action(logger, "install", description, True)
            return 0
        record_action(logger, "install", description)
        multipart_install(client, main, deps, certs)
        state = wait_install(client, args.install_timeout, args.poll_interval)
        print(json.dumps({"installed_sha256": digest, "state": state}, indent=2))
        return 0
    if args.command == "uninstall":
        full_name = args.package_full_name
        if "omnivael" in full_name.casefold():
            raise ToolError("Refusing to uninstall Omnivael.")
        if args.dry_run:
            print(f"Would verify Publisher is {PUBLISHER!r} for {full_name!r}, then DELETE the package.")
            record_action(logger, "uninstall", {"package_full_name": full_name,
                                                  "required_publisher": PUBLISHER}, True)
            return 0
        packages = client.json_request("GET", "/api/app/packagemanager/packages")
        package = find_package(packages, full_name)
        if package is None:
            raise ToolError("Refusing to uninstall: exact PackageFullName was not found.")
        publisher = get_publisher(package)
        if publisher != PUBLISHER:
            raise ToolError(f"Refusing to uninstall: Publisher is {publisher!r}, expected {PUBLISHER!r}.")
        route = "/api/app/packagemanager/package?package=" + urllib.parse.quote(full_name, safe="")
        status, payload, _ = client.request("DELETE", route)
        if status < 200 or status >= 300:
            raise ToolError(f"WDP returned HTTP {status} while uninstalling the package.")
        record_action(logger, "uninstall", {"package_full_name": full_name, "publisher": publisher})
        print(json.dumps({"uninstalled": full_name, "publisher": publisher}))
        return 0
    if args.command == "smoke":
        family = args.package_family_name
        if args.dry_run:
            print(f"Would resolve the PRAID for {family}, POST /api/taskmanager/app, wait 20s, confirm process, optionally screenshot, then stop.")
            record_action(logger, "smoke", {"package_family_name": family}, True)
            return 0
        return run_smoke(args, client, logger)
    raise ToolError("Unknown command.")


def run_smoke(args: argparse.Namespace, client: WdpClient, logger: CallLogger) -> int:
    family = args.package_family_name
    packages = client.json_request("GET", "/api/app/packagemanager/packages")
    package_record = find_family_package(packages, family)
    praid = args.pra_id or (get_praid(package_record) if package_record else None)
    if not praid:
        raise ToolError("Cannot smoke this package: PRAID was not provided or found in package metadata.")
    encoded = encode_b64(family)
    launch = {"appid": encode_b64(praid), "package": encoded}
    result: dict[str, Any] = {"time": now_iso(), "package_family_name": family,
                              "launched": False, "process_confirmed": False,
                              "screenshot": None, "stopped": False, "error": None}
    launched = False
    try:
        status, payload, _ = client.request("POST", "/api/taskmanager/app", json.dumps(launch).encode(),
                                            {"Content-Type": "application/json"})
        if status < 200 or status >= 300:
            raise ToolError(f"WDP returned HTTP {status} while launching smoke app.")
        launched = True
        result["launched"] = True
        time.sleep(20)
        processes = client.json_request("GET", "/api/resourcemanager/processes")
        result["process_confirmed"] = family.casefold() in walk_text(processes)
        if not result["process_confirmed"]:
            raise ToolError("Smoke app process was not present after launch.")
        # Xbox Device Portal may expose a screenshot endpoint. Treat only a missing
        # or unsupported endpoint as optional; never call /api/holographic.
        try:
            status, image_data, headers = client.request("GET", "/api/screenshot")
            if status in (404, 405, 501):
                result["screenshot"] = "unsupported"
            elif 200 <= status < 300 and image_data:
                suffix = ".png" if "png" in headers.get("content-type", "") else ".jpg"
                image_path = args.log_file.with_name(args.log_file.name + ".smoke" + suffix)
                image_path.parent.mkdir(parents=True, exist_ok=True)
                image_path.write_bytes(image_data)
                result["screenshot"] = str(image_path)
            else:
                raise ToolError(f"Screenshot endpoint returned HTTP {status}.")
        except ToolError as exc:
            if "HTTP 404" in str(exc) or "HTTP 405" in str(exc) or "HTTP 501" in str(exc):
                result["screenshot"] = "unsupported"
            else:
                raise
    except Exception as exc:
        result["error"] = str(exc)
    finally:
        if launched:
            try:
                route = "/api/taskmanager/app?package=" + urllib.parse.quote(encoded, safe="")
                status, _, _ = client.request("DELETE", route)
                if status < 200 or status >= 300:
                    raise ToolError(f"WDP returned HTTP {status} while stopping smoke app.")
                result["stopped"] = True
            except Exception as exc:
                result["stop_error"] = str(exc)
    report_path = args.log_file.with_name(args.log_file.name + ".smoke.jsonl")
    append_jsonl(report_path, result)
    print(json.dumps(result, indent=2))
    return 0 if result["process_confirmed"] and result["stopped"] and not result["error"] else 1


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default=DEFAULT_URL)
    parser.add_argument("--pin-file", type=Path, default=DEFAULT_PIN)
    parser.add_argument("--log-file", type=Path, default=DEFAULT_LOG)
    parser.add_argument("--qa-root", type=Path, default=Path("reports/qa/runs"))
    parser.add_argument("--timeout", type=float, default=30.0)
    parser.add_argument("--dry-run", action="store_true")
    sub = parser.add_subparsers(dest="command", required=True)
    def add_dry_run(command_parser: argparse.ArgumentParser) -> None:
        command_parser.add_argument("--dry-run", action="store_true", default=argparse.SUPPRESS)
    status = sub.add_parser("status", help="Read console OS and installed package information")
    add_dry_run(status)
    install = sub.add_parser("install", help="Install a QA-approved package directory")
    add_dry_run(install)
    install.add_argument("directory", type=Path)
    install.add_argument("--install-timeout", type=float, default=180.0)
    install.add_argument("--poll-interval", type=float, default=2.0)
    uninstall = sub.add_parser("uninstall", help="Uninstall only an EWS-published package")
    add_dry_run(uninstall)
    uninstall.add_argument("package_full_name")
    smoke = sub.add_parser("smoke", help="Launch, verify, screenshot if available, and stop an app")
    add_dry_run(smoke)
    smoke.add_argument("package_family_name")
    smoke.add_argument("--pra-id", help="PRAID from the package manifest, if package metadata omits it")
    fetch = sub.add_parser("fetch", help="Fetch a GitHub release asset or Actions artifact")
    add_dry_run(fetch)
    fetch.add_argument("repo")
    fetch.add_argument("ref", help="Release tag or numeric workflow run id")
    fetch.add_argument("--download-dir", type=Path, default=Path("downloads/xbox"))
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        return run(args)
    except (ToolError, OSError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
