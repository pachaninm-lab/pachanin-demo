#!/usr/bin/env python3
"""Exercise the workflow key validator in its conditional-call context."""
import os
from pathlib import Path
import shlex
import shutil
import subprocess
import tempfile
import textwrap
import unittest

ROOT=Path(__file__).resolve().parents[1]
WORKFLOW=ROOT/'.github/workflows/production-full-stack-exact-sha.yml'
SOURCE=WORKFLOW.read_text()
FUNCTION=textwrap.dedent(SOURCE[SOURCE.index('          validate_key(){'):SOURCE.index('          try_slot(){')])
FUNCTION=FUNCTION.replace('$HOME/.ssh/', '$FINGERPRINT_TEST_SSH_DIR/')
CANARY='SYNTHETIC_PRIVATE_SSH_COMMENT'
REAL_KEYGEN=shutil.which('ssh-keygen')


class Fingerprint(unittest.TestCase):
    def execute(self, variant='valid'):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d); ssh=root/'ssh';ssh.mkdir(); evidence=root/'evidence';evidence.mkdir()
            key=root/'source-key'
            subprocess.run([REAL_KEYGEN,'-q','-t','ed25519','-N','','-C',CANARY,'-f',str(key)],check=True,capture_output=True)
            expected=subprocess.run([REAL_KEYGEN,'-lf',str(key)+'.pub','-E','sha256'],check=True,capture_output=True,text=True).stdout.split()[1]
            if variant=='invalid': key.write_text('invalid '+CANARY)
            if variant=='public': key=Path(str(key)+'.pub')
            if variant=='write-error': (evidence/'ssh-key-fingerprint.txt').mkdir()
            env={**os.environ,'FINGERPRINT_TEST_SSH_DIR':str(ssh),'EVIDENCE_DIR':str(evidence)}
            if variant in ('fingerprint-error','malformed','derive-error'):
                binary=root/'bin';binary.mkdir();stub=binary/'ssh-keygen'
                body=['#!/bin/sh']
                match='-y' if variant=='derive-error' else '-lf'
                body.append('if [ "$1" = '+shlex.quote(match)+' ]; then')
                if variant=='malformed': body.append("  printf '%s\\n' '256 malformed-digest "+CANARY+"'")
                else: body.append("  printf '%s\\n' '"+CANARY+"' >&2")
                body.append('  exit '+('0' if variant=='malformed' else '23'))
                body.extend(['fi','exec '+shlex.quote(REAL_KEYGEN)+' "$@"'])
                stub.write_text('\n'.join(body)+'\n');stub.chmod(0o700)
                env['PATH']=str(binary)+os.pathsep+os.environ['PATH']
            script='set -euo pipefail\n'+FUNCTION+'\nif validate_key "$1"; then echo ACCEPTED; else echo REJECTED; exit 77; fi\n'
            result=subprocess.run(['bash','-c',script,'validator',str(key)],env=env,capture_output=True,text=True)
            saved={p.name:p.read_text() for p in evidence.iterdir() if p.is_file()}
            self.assertNotIn(CANARY,result.stdout+result.stderr+''.join(saved.values()))
            self.assertNotIn('PRIVATE KEY',result.stdout+result.stderr+''.join(saved.values()))
            return result,saved,expected

    def test_real_key_comment_is_not_retained(self):
        result,saved,expected=self.execute()
        self.assertEqual(result.returncode,0,result.stderr)
        self.assertEqual(saved,{'ssh-key-fingerprint.txt':expected+'\n'})

    def test_invalid_private_key_is_rejected(self):
        result,saved,_=self.execute('invalid');self.assertEqual(result.returncode,77);self.assertEqual(saved,{})

    def test_public_key_is_rejected(self):
        result,saved,_=self.execute('public');self.assertEqual(result.returncode,77);self.assertEqual(saved,{})

    def test_fingerprint_command_failure_is_not_overwritten_by_cleanup(self):
        result,saved,_=self.execute('fingerprint-error');self.assertEqual(result.returncode,77);self.assertEqual(saved,{})

    def test_derivation_failure_is_not_hidden_by_pipeline(self):
        result,saved,_=self.execute('derive-error');self.assertEqual(result.returncode,77);self.assertEqual(saved,{})

    def test_malformed_fingerprint_is_rejected(self):
        result,saved,_=self.execute('malformed');self.assertEqual(result.returncode,77);self.assertEqual(saved,{})

    def test_evidence_write_failure_is_rejected(self):
        result,saved,_=self.execute('write-error');self.assertEqual(result.returncode,77);self.assertEqual(saved,{})


if __name__=='__main__': unittest.main(verbosity=2)
