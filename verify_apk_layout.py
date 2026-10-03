#!/usr/bin/env python3
"""Validate installer requirements not covered by APK signature verification."""
import pathlib
import struct
import sys
import zipfile

def verify_apk_layout(path):
    path = pathlib.Path(path)
    data = path.read_bytes()
    with zipfile.ZipFile(path) as apk:
        if apk.testzip() is not None:
            raise ValueError('APK contains a corrupt ZIP entry')
        names = apk.namelist()
        if len(names) != len(set(names)):
            raise ValueError('APK has duplicate ZIP entries')
        for name in ['AndroidManifest.xml', 'resources.arsc', 'classes.dex', 'assets/focus.js']:
            if name not in names:
                raise ValueError('Missing required entry: ' + name)
        resource = apk.getinfo('resources.arsc')
        if resource.compress_type != zipfile.ZIP_STORED:
            raise ValueError('Android 11+ rejects compressed resources.arsc for targetSdk >= 30')
        name_size, extra_size = struct.unpack_from('<HH', data, resource.header_offset + 26)
        offset = resource.header_offset + 30 + name_size + extra_size
        if offset % 4:
            raise ValueError('Android 11+ requires resources.arsc on a 4-byte boundary')
        if not apk.read('classes.dex').startswith(b'dex\n'):
            raise ValueError('Invalid DEX header')
        return {'resource_table_uncompressed': True, 'resource_table_data_offset': offset,
                'resource_table_4_byte_aligned': True, 'zip_integrity': True}

if __name__ == '__main__':
    print(verify_apk_layout(sys.argv[1]))
