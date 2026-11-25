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
  "compose port web 3000") echo "127.0.0.1:2995" ;;
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


if __name__ == "__main__":
    unittest.main(verbosity=2)
