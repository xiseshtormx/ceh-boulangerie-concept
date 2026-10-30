"""Pillow + imageio-ffmpeg. Creates web frames only after successful PNG decoding.
python coffee-3d/pack_assets.py --watch
Master frames retain RGBA; MP4 is deliberately composited on exact black.
"""
import argparse
import json
from pathlib import Path
import subprocess
import time
from PIL import Image, ImageDraw
import imageio_ffmpeg

HERE = Path(__file__).resolve().parent
WEB = HERE.parent/'assets'/'coffee'/'3d'
PUBLIC = HERE/'models'
MASTER = HERE/'renders'/'master'
DESKTOP = WEB/'sequence'/'desktop'
MOBILE = WEB/'sequence'/'mobile'


def black_background(image):
    bg = Image.new('RGBA', image.size, (0, 0, 0, 255))
    bg.alpha_composite(image.convert('RGBA'))
    return bg.convert('RGB')


def package(watch=False):
    for directory in [DESKTOP, MOBILE]:
        directory.mkdir(parents=True, exist_ok=True)
    done = set()
    started = time.time()
    while len(done) < 150:
        for number in range(1, 151):
            if number in done:
                continue
            filename = f'frame_{number:04d}'
            source = MASTER/(filename+'.png')
            if not source.exists():
                continue
            try:
                with Image.open(source) as raw:
                    raw.load()
                    if raw.size != (1280, 1280):
                        raise ValueError(f'Inconsistent master size: {source}: {raw.size}')
                    image = raw.convert('RGBA')
                    image.save(DESKTOP/(filename+'.webp'), quality=87, method=4, alpha_quality=100)
                    image.resize((640, 640), Image.Resampling.LANCZOS).save(MOBILE/(filename+'.webp'), quality=83, method=4, alpha_quality=100)
                done.add(number)
            except (OSError, ValueError) as error:
                print('PNG not ready:', number, error, flush=True)
        print('PACKED', len(done), '/ 150', flush=True)
        if len(done) < 150:
            if not watch:
                raise RuntimeError('Sequence is incomplete; use --watch while Blender renders')
            if time.time()-started > 3600:
                raise TimeoutError('Blender did not finish within one hour')
            time.sleep(15)
    # Decode and verify every output; exact names and dimensions, no missing frames.
    for folder, size in [(DESKTOP, 1280), (MOBILE, 640)]:
        for i in range(1, 151):
            with Image.open(folder/f'frame_{i:04d}.webp') as image:
                image.load()
                assert image.size == (size, size) and image.mode == 'RGBA'
    final = black_background(Image.open(MASTER/'frame_0150.png'))
    final.save(WEB/'poster.webp', quality=90, method=5)
    final.resize((640, 640), Image.Resampling.LANCZOS).save(WEB/'poster-mobile.webp', quality=86)
    final.save(PUBLIC/'poster.webp', quality=90, method=5)
    # Send composited RGB pixels directly to ffmpeg. No fragile shell escaping,
    # no dependency on a system ffmpeg, and no orphan process on encoder errors.
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    command = [ffmpeg, '-y', '-f', 'rawvideo', '-vcodec', 'rawvideo', '-pix_fmt', 'rgb24',
               '-s', '1280x1280', '-r', '30', '-i', '-', '-an', '-c:v', 'libx264',
               '-crf', '19', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', str(WEB/'preview.mp4')]
    process = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    try:
        for i in range(1, 151):
            with Image.open(MASTER/f'frame_{i:04d}.png') as raw:
                process.stdin.write(black_background(raw).tobytes())
        process.stdin.close()
        errors = process.stderr.read().decode('utf-8', errors='replace')
        code = process.wait()
        if code:
            raise RuntimeError(errors[-3000:])
    except Exception:
        process.kill()
        process.wait()
        raise
    # Decode the produced video, not just its container header.
    reader = imageio_ffmpeg.read_frames(str(WEB/'preview.mp4'), pix_fmt='rgb24')
    metadata = next(reader)
    decoded = sum(1 for _ in reader)
    assert decoded == 150 and metadata['size'] == (1280, 1280) and metadata['fps'] == 30
    assert abs(metadata['duration']-5) < .02
    with Image.open(HERE/'renders'/'keys-4k'/'frame_0150.png') as final_png:
        final_png.load()
        assert final_png.size == (3840, 3840)
        final_size = final_png.size
    video_report = dict(coffeeRevision=4, porcelainRevision=2, frames=decoded, metadata=metadata, finalPNG=final_size)
    (HERE/'video-verification.json').write_text(json.dumps(video_report, indent=2), encoding='utf-8')
    # A single contact sheet gives reviewers consistent framing at all checkpoints.
    frames = [1, 24, 45, 75, 105, 130, 150]
    sheet = Image.new('RGB', (4*360, 2*395), (10, 10, 10))
    draw = ImageDraw.Draw(sheet)
    for index, frame in enumerate(frames):
        x, y = (index % 4)*360, (index // 4)*395
        with Image.open(MASTER/f'frame_{frame:04d}.png') as raw:
            sheet.paste(black_background(raw).resize((360, 360), Image.Resampling.LANCZOS), (x, y))
            raw.convert('RGBA').resize((1024, 1024), Image.Resampling.LANCZOS).save(HERE/'renders'/'keys'/f'frame_{frame:04d}.png')
        draw.text((x+15, y+366), f'{frame:03d} / 150', fill=(190, 190, 190))
    sheet.save(HERE/'contact-sheet.jpg', quality=94)
    size_of = lambda folder: sum(path.stat().st_size for path in folder.glob('frame_*.webp'))
    report = dict(frames=150, fps=30, durationSeconds=5, renderer='Blender Cycles / OptiX, 32 samples + denoise',
                  coffeeRevision=4, porcelainRevision=2,
                  desktop=dict(width=1280, height=1280, bytes=size_of(DESKTOP)),
                  mobile=dict(width=640, height=640, bytes=size_of(MOBILE)),
                  alpha=True, previewBytes=(WEB/'preview.mp4').stat().st_size,
                  masterDirectory='coffee-3d/renders/master', complete=True)
    (WEB/'sequence.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    (HERE/'sequence-verification.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print('SEQUENCE_COMPLETE', json.dumps(report), flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--watch', action='store_true')
    package(parser.parse_args().watch)
