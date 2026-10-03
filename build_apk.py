#!/usr/bin/env python3
"""Build with official Android SDK tools and a JDK; no third-party app dependencies."""
import argparse, hashlib, json, os, pathlib, re, subprocess, tempfile, zipfile, xml.etree.ElementTree as ET
from verify_apk_layout import verify_apk_layout

ROOT = pathlib.Path(__file__).resolve().parent
gradle = (ROOT/'app/build.gradle').read_text()
version = re.search(r"versionName '([^']+)'", gradle).group(1)
version_code = re.search(r'versionCode (\d+)', gradle).group(1)
p = argparse.ArgumentParser()
p.add_argument('--platform', required=True, help='Directory containing android.jar')
p.add_argument('--tools', required=True, help='Android build-tools directory')
p.add_argument('--key', default=str(ROOT/'private-signing'/'marketonly.p12'))
p.add_argument('--output', default=str(ROOT/'dist'/('MarketOnly-'+version+'.apk')))
a = p.parse_args()
platform, tools = pathlib.Path(a.platform).resolve(), pathlib.Path(a.tools).resolve()
build = ROOT/'build-manual'
for directory in ['compiled', 'gen', 'classes', 'dex']:
    (build/directory).mkdir(parents=True, exist_ok=True)
out = pathlib.Path(a.output).resolve(); out.parent.mkdir(parents=True, exist_ok=True)
env = dict(os.environ)
secret = ROOT/'private-signing'/'password.txt'
if 'MARKETONLY_KEYSTORE_PASSWORD' not in env:
    env['MARKETONLY_KEYSTORE_PASSWORD'] = secret.read_text().strip()
def run(*cmd):
    subprocess.run([str(c) for c in cmd], check=True, env=env)
run(tools/'aapt2','compile','--dir',ROOT/'app/src/main/res','-o',build/'compiled')
resources = sorted((build/'compiled').glob('*.flat'))
# Gradle supplies the package from namespace; standalone AAPT2 needs it explicitly.
ET.register_namespace('android','http://schemas.android.com/apk/res/android')
manifest_tree=ET.parse(ROOT/'app/src/main/AndroidManifest.xml')
manifest_tree.getroot().set('package','au.sutto.marketonly')
manifest_tree.write(build/'AndroidManifest.xml',encoding='utf-8',xml_declaration=True)
run(tools/'aapt2','link','-o',build/'base.apk','--manifest',build/'AndroidManifest.xml',
    '-I',platform/'android.jar','--java',build/'gen','--min-sdk-version','26','--target-sdk-version','35',
    '--version-code',version_code,'--version-name',version,'-A',ROOT/'app/src/main/assets',*resources)
sources = sorted((ROOT/'app/src/main/java').rglob('*.java')) + sorted((build/'gen').rglob('*.java'))
run('java','-m','jdk.compiler/com.sun.tools.javac.Main','-source','8','-target','8','-Xlint:-options',
    '-classpath',platform/'android.jar','-d',build/'classes',*sources)
with zipfile.ZipFile(build/'classes.jar','w',zipfile.ZIP_DEFLATED) as jar:
    for file in sorted((build/'classes').rglob('*.class')): jar.write(file,file.relative_to(build/'classes'))
run(tools/'d8','--release','--min-api','26','--lib',platform/'android.jar','--output',build/'dex',build/'classes.jar')
with zipfile.ZipFile(build/'base.apk') as src, zipfile.ZipFile(build/'unsigned.apk','w',zipfile.ZIP_DEFLATED) as dst:
    # Preserve AAPT2 storage methods: resource tables MUST remain uncompressed.
    for info in src.infolist(): dst.writestr(info,src.read(info.filename))
    dst.write(build/'dex/classes.dex','classes.dex')
run(tools/'zipalign','-f','4',build/'unsigned.apk',build/'aligned.apk')
with tempfile.TemporaryDirectory(prefix='marketonly-sign-') as tmp:
    signed = pathlib.Path(tmp)/'signed.apk'
    run(tools/'apksigner','sign','--ks',a.key,'--ks-key-alias','marketonly',
        '--ks-pass','env:MARKETONLY_KEYSTORE_PASSWORD','--key-pass','env:MARKETONLY_KEYSTORE_PASSWORD',
        '--v4-signing-enabled','false','--out',signed,build/'aligned.apk')
    # Copy fully materialized bytes rather than relying on mapped/sparse output.
    out.write_bytes(signed.read_bytes())
with zipfile.ZipFile(out) as apk:
    assert apk.testzip() is None
    for asset in (ROOT/'app/src/main/assets').rglob('*'):
        if asset.is_file():
            assert apk.read('assets/'+asset.relative_to(ROOT/'app/src/main/assets').as_posix()) == asset.read_bytes()
layout = verify_apk_layout(out)
run(tools/'apksigner','verify','--verbose',out)
run(tools/'zipalign','-c','4',out)
manifest={'file':out.name,'sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'bytes':out.stat().st_size,
    'package':'au.sutto.marketonly','version':version,'versionCode':int(version_code),'minSdk':26,'targetSdk':35,
    'apk_layout':layout,
    'validation':'Compiled, signature verified, uncompressed/aligned resources checked. Real Facebook account and Android device acceptance not performed.'}
(out.parent/('BUILD-INFO-'+version+'.json')).write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps(manifest,indent=2))
