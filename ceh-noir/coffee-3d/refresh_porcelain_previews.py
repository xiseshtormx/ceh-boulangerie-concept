"""Repackage glaze stills without changing the existing sequence's revision."""
from pathlib import Path
import json
from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
WEB = HERE.parent/'assets'/'coffee'/'3d'
PUBLIC = HERE/'models'


def black(image):
    output = Image.new('RGBA', image.size, (0, 0, 0, 255))
    output.alpha_composite(image.convert('RGBA'))
    return output.convert('RGB')


with Image.open(HERE/'renders'/'keys-4k'/'frame_0150.png') as raw:
    assert raw.size == (3840, 3840)
    final = black(raw)
for folder in [WEB, PUBLIC]:
    final.resize((1280, 1280), Image.Resampling.LANCZOS).save(folder/'poster.webp', quality=90, method=5)
final.resize((640, 640), Image.Resampling.LANCZOS).save(WEB/'poster-mobile.webp', quality=86)

sheet = Image.new('RGB', (1536, 810), (0, 0, 0))
with Image.open(HERE/'porcelain-before.webp') as previous:
    sheet.paste(black(previous).resize((768, 768), Image.Resampling.LANCZOS), (0, 0))
sheet.paste(final.resize((768, 768), Image.Resampling.LANCZOS), (768, 0))
font = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 23)
draw = ImageDraw.Draw(sheet)
draw.text((28, 775), 'Прежний материал', font=font, fill=(170, 170, 170))
draw.text((796, 775), 'Фарфоровая глазурь', font=font, fill=(235, 235, 235))
sheet.save(HERE/'porcelain-v2.jpg', quality=95)

print('PORCELAIN_PREVIEWS_READY: poster, mobile poster, 4K still and comparison. Sequence metadata left unchanged; use pack_assets.py after rerendering.')
