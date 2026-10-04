#!/usr/bin/env python3
"""Portable controlled regression runner; does not log in to Facebook."""
import argparse, json, os, pathlib, subprocess, tempfile, time

ROOT = pathlib.Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--browser', action='store_true')
args = parser.parse_args()
output = ROOT / 'test-output'
output.mkdir(exist_ok=True)
results = []

def run(label, command):
    started = time.monotonic()
    try:
        result = subprocess.run(command, cwd=ROOT, stdout=subprocess.PIPE,
                                stderr=subprocess.STDOUT, text=True, timeout=240)
    except subprocess.TimeoutExpired as error:
        captured = error.stdout or ''
        if isinstance(captured, bytes):
            captured = captured.decode('utf-8', errors='replace')
        result = subprocess.CompletedProcess(command, 124, captured + '\nTimed out after 240 seconds.\n')
    (output / (label + '.log')).write_text(result.stdout)
    results.append({'name':label, 'passed':result.returncode == 0,
                    'seconds':round(time.monotonic() - started, 2)})
    print(('PASS' if result.returncode == 0 else 'FAIL') + ': ' + label, flush=True)
    if result.returncode:
        print(result.stdout[-6000:], flush=True)
    return result.returncode == 0

with tempfile.TemporaryDirectory(prefix='marketonly-checks-') as tmp:
    java = ROOT / 'app/src/main/java/au/sutto/marketonly'
    if run('java-compile', ['java','-m','jdk.compiler/com.sun.tools.javac.Main','-d',tmp,
            str(java/'UrlRules.java'),str(java/'ExternalLinks.java'),str(java/'SmartSearch.java'),
            str(ROOT/'tests/UrlRulesTest.java'),str(ROOT/'tests/ExternalLinksTest.java'),
            str(ROOT/'tests/SmartSearchFilterTest.java')]):
        for name in ['UrlRulesTest','ExternalLinksTest','SmartSearchFilterTest']:
            run(name, ['java','-cp',tmp,'au.sutto.marketonly.'+name])

for test in sorted((ROOT/'tests').glob('*_test.py')):
    run(test.stem, ['python3', str(test)])
for name in ['guard_test','pull_refresh_test','refresh_snapshot_test']:
    run(name, ['node','tests/'+name+'.cjs'])
for asset in sorted((ROOT/'app/src/main/assets').glob('*.js')):
    run('syntax-'+asset.stem, ['node','--check',str(asset)])
if args.browser:
    for test in sorted((ROOT/'tests').glob('*.cjs')):
        if "require('playwright')" in test.read_text():
            run(test.stem, ['node',str(test)])
(output/'summary.json').write_text(json.dumps({
    'scope':'Controlled regression fixtures. No Android or authenticated Facebook acceptance.',
    'results':results}, indent=2)+'\n')
raise SystemExit(0 if all(r['passed'] for r in results) else 1)
