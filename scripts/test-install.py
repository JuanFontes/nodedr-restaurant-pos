"""Regression tests for install.sh. Run with python3 scripts/test-install.py."""
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest


class InstallerTest(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.root = Path(tmp.name)
        self.script = self.root / "install.sh"
        shutil.copy2(Path(__file__).resolve().parents[1] / "install.sh", self.script)
        self.bin = self.root / "bin"
        self.bin.mkdir()
        self.env = {**os.environ, "PATH": f"{self.bin}:{os.environ['PATH']}"}
        self.env.pop("HOST_PORT", None)
        self.stub("docker", """
echo "$*" >> docker.calls
case "$*" in
  "compose port web 3000") echo "${TEST_BINDING-127.0.0.1:2995}"; exit "${PORT_STATUS:-0}" ;;
  "compose config --environment") exec "$REAL_DOCKER" "$@" ;;
esac
""")
        self.stub("curl", "exit 0")

    def stub(self, name, script):
        path = self.bin / name
        path.write_text("#!/bin/sh\n" + script + "\n")
        path.chmod(0o755)

    def install(self, *args, timeout=10):
        return subprocess.run([self.script, *args], env=self.env, cwd=self.root,
                              capture_output=True, text=True, timeout=timeout)

    def test_help_and_unknown_options_stop_before_installation(self):
        for args, status in [(("--help",), 0), (("-h",), 0), (("--dmeo",), 2),
                             (("--demo", "oops"), 2), (("--help", "--oops"), 2)]:
            with self.subTest(args=args):
                result = self.install(*args)
                self.assertEqual(result.returncode, status)
                output = result.stderr if status else result.stdout
                self.assertIn("Usage:", output)
                self.assertIn("--demo", output)
                if status:
                    self.assertIn(args[-1], output)
                self.assertFalse((self.root / "docker.calls").exists())
                self.assertFalse((self.root / ".env").exists())

    def test_demo_is_opt_in(self):
        (self.root / ".env").touch()
        for args in [(), ("--demo",)]:
            with self.subTest(args=args):
                calls = self.root / "docker.calls"
                calls.write_text("")
                result = self.install(*args)
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertIn("compose up -d --build", calls.read_text())
                self.assertEqual("prisma/seed.ts" in calls.read_text(), bool(args))

    def test_port_used_for_probe_and_signup_url(self):
        # Only config reads the real Compose file. Build/start and the HTTP probe are recorded locally.
        self.env["REAL_DOCKER"] = shutil.which("docker") or self.fail("Docker Compose is required")
        (self.root / "compose.yaml").write_text(
            'services:\n  web:\n    image: busybox\n    ports: ["${HOST_PORT:-1995}:3000"]\n')
        self.stub("curl", 'for arg do url=$arg; done; echo "$url" > probe.url')
        for name, binding, file_value, shell_value, expected in [
            ("published binding wins", "[::]:4180", "HOST_PORT=2880", "2995", 4180),
            ("shell overrides file", "", "HOST_PORT=1995", "2995", 2995),
            ("quoted file value", "", 'HOST_PORT="2880" # web', None, 2880),
            ("missing key", "", "# no port configured", None, 1995),
            ("empty override", "", "HOST_PORT=2880", "", 1995),
        ]:
            with self.subTest(name=name):
                self.env.update(TEST_BINDING=binding, PORT_STATUS="1" if name == "shell overrides file" else "0")
                if shell_value is None:
                    self.env.pop("HOST_PORT", None)
                else:
                    self.env["HOST_PORT"] = shell_value
                (self.root / ".env").write_text(file_value + "\n")
                result = self.install()
                self.assertEqual(result.returncode, 0, result.stderr)
                url = f"http://localhost:{expected}"
                self.assertIn(f"Open {url}\n", result.stdout)
                self.assertIn(f"{url}/signup", result.stdout)
                self.assertEqual((self.root / "probe.url").read_text().strip(), f"{url}/api/health")

    def test_plain_env_file_with_older_compose(self):
        self.env.update(TEST_BINDING="", REAL_DOCKER="false")
        (self.root / ".env").write_text("HOST_PORT=2880\n")
        for override, port in [(None, 2880), ("2995", 2995), ("", 1995)]:
            with self.subTest(override=override):
                if override is not None:
                    self.env["HOST_PORT"] = override
                result = self.install()
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertIn(f"Open http://localhost:{port}\n", result.stdout)


if __name__ == "__main__":
    unittest.main(verbosity=2)
