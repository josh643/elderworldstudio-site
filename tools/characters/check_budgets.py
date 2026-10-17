#!/usr/bin/env python3
"""Verify the shipped wardrobe atlas and every selectable outfit against the geometry budget."""
import json
import struct
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
ASSETS = ROOT / 'site/office/assets/characters'
MAX_TRIANGLES = 15_000


def meshes(path):
    data = path.read_bytes()
    if data[:4] != b'glTF' or struct.unpack_from('<I', data, 4)[0] != 2:
        raise ValueError(f'{path.name}: expected GLB v2')
    json_len = struct.unpack_from('<I', data, 12)[0]
    doc = json.loads(data[20:20 + json_len])
    counts = {}
    for node in doc.get('nodes', []):
        mesh_id = node.get('mesh')
        if mesh_id is None:
            continue
        name = node.get('name', '')
        tris = 0
        for prim in doc['meshes'][mesh_id]['primitives']:
            accessor = prim.get('indices', prim['attributes']['POSITION'])
            count = doc['accessors'][accessor]['count']
            tris += count // 3
        counts[name] = tris
    return counts


def outfits(female):
    hairs = ['hair_Hair_Long', 'hair_Hair_Buns', 'hair_Hair_SimpleParted', 'hair_Hair_BuzzedFemale'] if female else [
        'hair_Hair_SimpleParted', 'hair_Hair_Buzzed', 'hair_Hair_Long']
    common = ['body', 'shoes', 'eyes']
    variants = [
        ('office', common, hairs, not female),
        ('host', common + ['jacket'], hairs, not female),
        ('architect', common + ['vest_field'], hairs, not female),
        ('exec', common + ['jacket'], hairs, not female),
        ('lead', common + ['jacket'], hairs, not female),
        ('security', common + ['cap', 'belt', 'badge'], ['hair_Hair_BuzzedFemale' if female else 'hair_Hair_Buzzed'], False),
        ('construction', common + ['hardhat', 'vest_hivis'], ['hair_Hair_BuzzedFemale' if female else 'hair_Hair_Buzzed'], not female),
    ]
    for kind, base, choices, beard_possible in variants:
        for hair in choices:
            parts = base + [hair]
            yield kind, parts
            if beard_possible:
                yield kind + '+beard', parts + ['hair_Hair_Beard']


def main():
    atlas_path = ASSETS / 'atlas.jpg'
    with Image.open(atlas_path) as atlas:
        width, height = atlas.size
    if width >= 1024 or height >= 1024:
        raise SystemExit(f'FAIL atlas: {width}x{height} must be below 1024x1024')
    print(f'PASS shared atlas: {width}x{height} ({atlas_path.relative_to(ROOT)})')

    for sex, path in [('female', ASSETS / 'chars_f.glb'), ('male', ASSETS / 'chars_m.glb')]:
        part_counts = meshes(path)
        for lod in (0, 1):
            highest = (0, '')
            for kind, parts in outfits(sex == 'female'):
                missing = [part for part in parts if not any(f'{part}_L{level}' in part_counts for level in (0, 1))]
                if missing:
                    raise SystemExit(f'FAIL {sex} {kind}: missing selectable mesh(es): {", ".join(missing)}')
                total = sum(part_counts.get(f'{part}_L{lod}', part_counts.get(f'{part}_L{1 - lod}', 0)) for part in parts)
                if total > highest[0]:
                    highest = total, kind
                if total > MAX_TRIANGLES:
                    raise SystemExit(f'FAIL {sex} {kind} LOD{lod}: {total} triangles exceeds {MAX_TRIANGLES}')
            print(f'PASS {sex} LOD{lod}: max outfit {highest[1]} = {highest[0]} / {MAX_TRIANGLES} triangles')


if __name__ == '__main__':
    main()
