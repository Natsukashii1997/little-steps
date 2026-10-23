#!/usr/bin/env python3
"""Build transparent, padded mini-program assets from the approved source artwork.

This is a mechanical cleanup pass only: it does not redraw or AI-regenerate any
illustration.  It removes screenshot paper backplates, restores known crops, and
packs every standalone decoration inside a transparent safety area.
"""

from __future__ import annotations

from collections import deque
from pathlib import Path
from statistics import median
from typing import Iterable

from PIL import Image, ImageFilter


PROJECT = Path(__file__).resolve().parents[2]
PUBLIC = PROJECT / "public" / "assets" / "baby"
ASSETS = PROJECT / "miniapp" / "miniprogram" / "assets"


def border_color(image: Image.Image) -> tuple[int, int, int]:
    rgb = image.convert("RGB")
    width, height = rgb.size
    sample: list[tuple[int, int, int]] = []
    depth = max(2, min(width, height) // 40)
    for y in range(height):
        for x in range(width):
            if x < depth or x >= width - depth or y < depth or y >= height - depth:
                r, g, b = rgb.getpixel((x, y))
                if max(r, g, b) > 150:
                    sample.append((r, g, b))
    if not sample:
        sample = list(rgb.getdata())
    return (
        int(median(pixel[0] for pixel in sample)),
        int(median(pixel[1] for pixel in sample)),
        int(median(pixel[2] for pixel in sample)),
    )


def remove_flat_backplate(
    image: Image.Image,
    *,
    low: float = 18.0,
    high: float = 62.0,
) -> Image.Image:
    """Remove only paper pixels connected to the image boundary.

    A global color key also deletes the cream fill inside white bears, babies,
    books and calendar pages.  Flooding inward from the canvas edge keeps those
    enclosed light regions intact while still removing the screenshot panel.
    """
    source = image.convert("RGBA")
    bg_r, bg_g, bg_b = border_color(source)
    pixels = source.load()
    width, height = source.size

    distances: list[float] = [0.0] * (width * height)
    for y in range(source.height):
        for x in range(source.width):
            r, g, b, _ = pixels[x, y]
            distances[y * width + x] = (
                (r - bg_r) ** 2 + (g - bg_g) ** 2 + (b - bg_b) ** 2
            ) ** 0.5

    # Dark/colored strokes form a temporary barrier.  A tiny dilation closes
    # antialiasing gaps in the hand-drawn contour, so paper-colored body fills
    # do not leak into the outside background during the flood.
    barrier = Image.new("L", (width, height), 0)
    source_alpha = list(source.getchannel("A").get_flattened_data())
    barrier.putdata(
        [
            255 if distance >= high and source_alpha[index] > 8 else 0
            for index, distance in enumerate(distances)
        ]
    )
    barrier = barrier.filter(ImageFilter.MaxFilter(5))
    barrier_pixels = barrier.load()

    background = bytearray(width * height)
    queue: deque[tuple[int, int]] = deque()

    def seed(x: int, y: int) -> None:
        index = y * width + x
        if not background[index] and barrier_pixels[x, y] == 0:
            background[index] = 1
            queue.append((x, y))

    for x in range(width):
        seed(x, 0)
        seed(x, height - 1)
    for y in range(height):
        seed(0, y)
        seed(width - 1, y)

    while queue:
        x, y = queue.popleft()
        for nx, ny in (
            (x - 1, y - 1), (x, y - 1), (x + 1, y - 1),
            (x - 1, y),                     (x + 1, y),
            (x - 1, y + 1), (x, y + 1), (x + 1, y + 1),
        ):
            if not (0 <= nx < width and 0 <= ny < height):
                continue
            index = ny * width + nx
            if background[index] or barrier_pixels[nx, ny] != 0:
                continue
            background[index] = 1
            queue.append((nx, ny))

    for y in range(height):
        for x in range(width):
            index = y * width + x
            if not background[index]:
                r, g, b, original_alpha = pixels[x, y]
                pixels[x, y] = (r, g, b, original_alpha)
                continue
            r, g, b, original_alpha = pixels[x, y]
            distance = distances[index]
            if distance <= low:
                alpha = 0
            else:
                t = (distance - low) / (high - low)
                t = t * t * (3.0 - 2.0 * t)
                alpha = round(t * 255)
            pixels[x, y] = (r, g, b, min(original_alpha, alpha))
    return remove_tiny_islands(source)


def remove_tiny_islands(image: Image.Image, max_area: int = 18) -> Image.Image:
    """Drop isolated paper-grain dots without touching real illustration marks."""
    rgba = image.convert("RGBA")
    alpha = rgba.getchannel("A")
    # Values below this threshold are invisible antialias residue from the old
    # paper tile; zero them before component analysis so they cannot form haze.
    raw_alpha = list(alpha.get_flattened_data())
    for index, value in enumerate(raw_alpha):
        if value <= 18:
            raw_alpha[index] = 0
    alpha.putdata(raw_alpha)
    visible = bytearray(1 if value else 0 for value in raw_alpha)
    width, height = rgba.size
    visited = bytearray(width * height)
    alpha_pixels = alpha.load()

    for start in range(width * height):
        if not visible[start] or visited[start]:
            continue
        component: list[int] = []
        queue: deque[int] = deque([start])
        visited[start] = 1
        while queue:
            index = queue.popleft()
            component.append(index)
            x, y = index % width, index // width
            for nx, ny in (
                (x - 1, y - 1), (x, y - 1), (x + 1, y - 1),
                (x - 1, y),                     (x + 1, y),
                (x - 1, y + 1), (x, y + 1), (x + 1, y + 1),
            ):
                if not (0 <= nx < width and 0 <= ny < height):
                    continue
                neighbour = ny * width + nx
                if visible[neighbour] and not visited[neighbour]:
                    visited[neighbour] = 1
                    queue.append(neighbour)
        if len(component) <= max_area:
            for index in component:
                alpha_pixels[index % width, index // width] = 0

    rgba.putalpha(alpha)
    return rgba


def has_useful_alpha(image: Image.Image) -> bool:
    if image.mode not in ("RGBA", "LA") and "transparency" not in image.info:
        return False
    alpha = image.convert("RGBA").getchannel("A")
    low, high = alpha.getextrema()
    return low < 250 and high > 8


def visible_bbox(image: Image.Image, threshold: int = 8) -> tuple[int, int, int, int]:
    alpha = image.convert("RGBA").getchannel("A").point(lambda value: 255 if value > threshold else 0)
    bbox = alpha.getbbox()
    if not bbox:
        raise ValueError("asset has no visible pixels")
    return bbox


def pack(
    image: Image.Image,
    size: tuple[int, int],
    *,
    padding: int,
    key_backplate: bool = False,
    key_low: float = 18.0,
    key_high: float = 62.0,
) -> Image.Image:
    rgba = image.convert("RGBA")
    if key_backplate or not has_useful_alpha(rgba):
        rgba = remove_flat_backplate(rgba, low=key_low, high=key_high)
    rgba = rgba.crop(visible_bbox(rgba))
    target_w = max(1, size[0] - 2 * padding)
    target_h = max(1, size[1] - 2 * padding)
    scale = min(target_w / rgba.width, target_h / rgba.height)
    resized = rgba.resize(
        (max(1, round(rgba.width * scale)), max(1, round(rgba.height * scale))),
        Image.Resampling.LANCZOS,
    )
    canvas = Image.new("RGBA", size, (0, 0, 0, 0))
    x = (size[0] - resized.width) // 2
    y = (size[1] - resized.height) // 2
    canvas.alpha_composite(resized, (x, y))
    # Resampling can reintroduce tiny detached texture flecks, so clean the
    # final-size canvas as well as the source-size matte.
    return remove_tiny_islands(canvas, max_area=45)


def save(image: Image.Image, relative: str) -> None:
    destination = ASSETS / relative
    destination.parent.mkdir(parents=True, exist_ok=True)
    # The mini-program main package has a strict 2 MB ceiling.  Limit the
    # watercolor palette before converting back to RGBA: this keeps genuine
    # alpha edges (and the visual-contract guard) while avoiding the much
    # larger full-color PNG output produced by Pillow's default encoder.
    compact = image.convert("RGBA").quantize(
        colors=256,
        method=Image.Quantize.FASTOCTREE,
        dither=Image.Dither.FLOYDSTEINBERG,
    ).convert("RGBA")
    compact.save(destination, format="PNG", optimize=True, compress_level=9)


def open_image(path: Path, crop: tuple[int, int, int, int] | None = None) -> Image.Image:
    image = Image.open(path)
    return image.crop(crop) if crop else image


def build() -> None:
    approved_home = PUBLIC / "final-screens" / "zh-CN" / "01-home-dynamic-add-clean.png"

    # Home care badges.  Sleep and poop use wider approved-screen crops because
    # the old 104 px exports had already cut through the circular badge.
    care_sources: dict[str, tuple[Path, tuple[int, int, int, int] | None]] = {
        "feeding": (PUBLIC / "icon-feeding.png", None),
        "sleep": (approved_home, (442, 808, 558, 924)),
        "diaper": (PUBLIC / "icon-diaper.png", None),
        "poop": (approved_home, (45, 1187, 165, 1307)),
        "health": (PUBLIC / "icon-health.png", None),
    }
    for name, (source, crop) in care_sources.items():
        save(pack(open_image(source, crop), (104, 104), padding=7, key_backplate=True), f"care/icon-{name}.png")

    # Smaller profile and header glyphs are also standalone art, so they must
    # not carry a square swatch of the source screenshot behind them.
    for name, source, size, padding in [
        ("weight", PUBLIC / "icon-weight.png", (92, 92), 5),
        ("height", PUBLIC / "icon-height.png", (72, 92), 4),
        ("age", PUBLIC / "icon-age.png", (92, 92), 5),
    ]:
        save(pack(open_image(source), size, padding=padding, key_backplate=True), f"care/icon-{name}.png")
    save(pack(open_image(PUBLIC / "weather.png"), (112, 82), padding=4, key_backplate=True), "ui/weather.png")

    # Reuse the existing approved transparent journal bear for Today's To-do.
    save(pack(open_image(PUBLIC / "bear-journal.png"), (360, 240), padding=10), "home/todo-bear.png")

    # Memory and growth artwork.
    save(
        pack(
            open_image(PUBLIC / "memory-note-bear-v1.png"),
            (256, 256),
            padding=12,
            key_backplate=True,
            key_high=86,
        ),
        "memory/note-bear.png",
    )
    save(pack(open_image(PUBLIC / "memory-ref-smile-v1.png"), (180, 180), padding=8, key_backplate=True), "memory/smile.png")
    save(pack(open_image(PUBLIC / "memory-ref-rollover-v1.png"), (180, 180), padding=8, key_backplate=True), "memory/rollover.png")
    save(pack(open_image(PUBLIC / "growth-profile-bear-exact-v1.png"), (240, 220), padding=10), "growth/profile-bear.png")

    # Health list illustrations and hero figures.  Existing transparent source
    # art is repacked to add a reliable inset; opaque child-care cards are keyed.
    health_specs: Iterable[tuple[str, str, tuple[int, int], int, bool]] = [
        ("health-checkup-newborn-v2.png", "health/checkup-newborn.png", (250, 250), 14, True),
        ("health-checkup-one-month-v2.png", "health/checkup-one-month.png", (250, 250), 14, True),
        ("health-checkup-four-month-v2.png", "health/checkup-four-month.png", (250, 250), 14, True),
        ("health-vaccine-hepb-v1.png", "health/vaccine-hepb.png", (164, 164), 8, True),
        ("health-vaccine-five-in-one-v1.png", "health/vaccine-five-in-one.png", (164, 164), 8, True),
        ("health-vaccine-mmr-v1.png", "health/vaccine-mmr.png", (164, 164), 8, True),
        ("health-vaccine-hero-reference-v2.png", "health/vaccine-hero.png", (215, 225), 12, False),
        ("health-development-hero-bear-reference-v3.png", "health/development-hero-bear.png", (235, 230), 12, False),
        ("health-development-hero-baby-reference-v3.png", "health/development-hero-baby.png", (185, 140), 10, False),
        ("health-development-tummy-time-reference-v2.png", "health/development-tummy-time.png", (280, 220), 10, False),
        ("health-development-rollover-reference-v2.png", "health/development-rollover.png", (280, 220), 10, False),
        ("health-development-sitting-reference-v2.png", "health/development-sitting.png", (280, 220), 10, False),
        ("health-checkup-hero-stethoscope-reference-v2.png", "health/checkup-hero-stethoscope.png", (160, 170), 10, False),
    ]
    for source_name, destination, size, padding, key_backplate in health_specs:
        save(pack(open_image(PUBLIC / source_name), size, padding=padding, key_backplate=key_backplate), destination)

    # The approved child-care hero crop contains a sliver of the adjacent
    # illustration at x>=207.  Retain the whole bear and remove only that sliver.
    save(
        pack(
            open_image(PUBLIC / "health-checkup-hero-bear-reference-v2.png", (0, 0, 197, 215)),
            (235, 235),
            padding=12,
        ),
        "health/checkup-hero-bear.png",
    )


if __name__ == "__main__":
    build()
