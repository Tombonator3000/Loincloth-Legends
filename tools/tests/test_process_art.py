"""Regresjoner for original alfa og bakgrunnsfjerning. Kjør: python3 -m unittest discover -s tools/tests -p 'test_*.py'."""
import importlib.util
from pathlib import Path
import tempfile
import unittest

from PIL import Image, ImageDraw


SPEC = importlib.util.spec_from_file_location('process_art', Path(__file__).parents[1] / 'process_art.py')
art = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(art)


class AlphaImportTests(unittest.TestCase):
    def test_small_transparent_opening_preserves_dark_gate(self):
        # Som palisadeporten: mørkt tre dekker kantene, bare åpningen har alfa (18 prosent).
        im = Image.new('RGBA', (100, 100), (31, 22, 15, 255))
        ImageDraw.Draw(im).rectangle((40, 10, 59, 99), fill=(31, 22, 15, 0))
        before = im.tobytes()
        self.assertEqual(art.fjern_bakgrunn(im).tobytes(), before)

    def test_one_transparent_pixel_and_soft_alpha_are_authoritative(self):
        for alpha in (0, 19, 128, 249, 254):
            with self.subTest(alpha=alpha):
                im = Image.new('RGBA', (12, 12), (35, 25, 15, 255))
                im.putpixel((6, 6), (70, 50, 30, alpha))
                self.assertEqual(art.fjern_bakgrunn(im.copy()).tobytes(), im.tobytes())

    def test_opaque_background_removed_but_enclosed_matching_detail_survives(self):
        # RGB og heldekkende RGBA har fortsatt automatisk bakgrunnsfjerning.
        for mode in ('RGB', 'RGBA'):
            with self.subTest(mode=mode):
                im = Image.new(mode, (24, 24), 'black').convert('RGBA')
                draw = ImageDraw.Draw(im)
                draw.rectangle((6, 6, 17, 17), fill='white')
                draw.rectangle((10, 10, 13, 13), fill='black')
                clean = art.fjern_bakgrunn(im)
                self.assertEqual(clean.getpixel((0, 0))[3], 0)
                self.assertEqual(clean.getpixel((6, 6)), (255, 255, 255, 255))
                self.assertEqual(clean.getpixel((11, 11)), (0, 0, 0, 255))

    def test_opaque_sheet_still_removes_background_after_magenta_guides(self):
        im = Image.new('RGBA', (90, 90), 'white')
        draw = ImageDraw.Draw(im)
        for x in (0, 29, 30, 59, 60, 89):
            draw.line((x, 0, x, 89), fill=(255, 0, 255, 255))
        for y in (0, 29, 30, 59, 60, 89):
            draw.line((0, y, 89, y), fill=(255, 0, 255, 255))
        for y in (0, 30, 60):
            for x in (0, 30, 60):
                draw.rectangle((x + 8, y + 8, x + 21, y + 21), fill=(35, 25, 15, 255))
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / ('ark__' + '__'.join(f'prop_test_{i}' for i in range(9)) + '.png')
            im.save(path)
            parts = art.klipp(path)
        self.assertEqual(len(parts), 9)
        for _, part in parts:
            self.assertEqual(part.getpixel((0, 0))[3], 0)
            self.assertEqual(part.getpixel((10, 10)), (35, 25, 15, 255))

    def test_png_roundtrip_and_prop_import_keep_original_alpha(self):
        im = Image.new('RGBA', (100, 100), (31, 22, 15, 255))
        ImageDraw.Draw(im).rectangle((40, 10, 59, 99), fill=(0, 0, 0, 0))
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'prop_test_gate.png'
            im.save(path)
            key, loaded = art.klipp(path)[0]
            old_ut = art.UT
            try:
                art.UT = Path(folder)
                manifest = {}
                art.behandle(key, loaded, manifest, set())
                with Image.open(Path(folder) / manifest['props']['test_gate']['file']) as result:
                    # WebP-kulisser komprimerer RGB, men alfa skal være tapsfri og mørkt tre må bli stående.
                    alpha = result.convert('RGBA').getchannel('A').crop((2, 2, 102, 102))
                    self.assertEqual(alpha.tobytes(), im.getchannel('A').tobytes())
            finally:
                art.UT = old_ut

    def test_small_opaque_images_do_not_index_outside_image(self):
        for size in ((1, 1), (2, 2), (1, 8)):
            with self.subTest(size=size):
                clean = art.fjern_bakgrunn(Image.new('RGBA', size, 'white'))
                self.assertIsNone(clean.getchannel('A').getbbox())


if __name__ == '__main__':
    unittest.main()
