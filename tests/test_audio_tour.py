#!/usr/bin/env python3
"""Regression tests for build.py's audio-tour wiring.

Stdlib unittest only — no new dependency, matches the "boring on purpose"
build. Run: python3 tests/test_audio_tour.py
"""
import pathlib
import sys
import unittest

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import build  # noqa: E402


class FakePath:
    """Minimal stand-in for a Path when a test only needs `.name`."""
    def __init__(self, name):
        self.name = name

    def __repr__(self):
        return f"FakePath({self.name!r})"


class TopLevelH2BoundsTests(unittest.TestCase):
    def test_blockquote_nested_heading_is_not_a_boundary(self):
        # markdown `> ## Nested Heading` renders an <h2> INSIDE a <blockquote>.
        # The old startswith("<h2")-only check treated it as a boundary anyway,
        # slicing the <blockquote> open tag into one chunk and its </blockquote>
        # into the next — tag soup. It must be ignored here.
        html = (
            "<p>Intro.</p>\n"
            "<blockquote>\n"
            "<p>Some quoted setup.</p>\n"
            '<h2 id="nested-heading">Nested Heading</h2>\n'
            "<p>More quoted text.</p>\n"
            "</blockquote>\n"
            '<h2 id="real-section">Real Section</h2>\n'
            "<p>Body.</p>"
        ).split("\n")
        bounds = build._top_level_h2_bounds(html)
        # Only ONE real boundary (the top-level "Real Section" h2) plus the
        # implicit start/end — the nested heading must not appear.
        self.assertEqual(bounds, [0, 6, 8])
        chunks = [html[bounds[i]:bounds[i + 1]] for i in range(len(bounds) - 1)]
        # chunk 0 keeps the blockquote fully intact (open AND close together)
        self.assertIn("<blockquote>", chunks[0])
        self.assertIn("</blockquote>", chunks[0])
        self.assertTrue(chunks[1][0].startswith('<h2 id="real-section"'))

    def test_plain_two_section_post(self):
        html = (
            "<p>Intro.</p>\n"
            '<h2 id="one">One</h2>\n'
            "<p>Body one.</p>\n"
            '<h2 id="two">Two</h2>\n'
            "<p>Body two.</p>"
        ).split("\n")
        bounds = build._top_level_h2_bounds(html)
        self.assertEqual(bounds, [0, 1, 3, 5])


class AudioFilesForSortTests(unittest.TestCase):
    def test_numeric_not_lexicographic_sort(self):
        # Simulate the >9-sections case: lexicographic sort would put
        # "...-audio-10.mp3" before "...-audio-2.mp3".
        names = [
            "post-audio-1.mp3", "post-audio-10.mp3", "post-audio-2.mp3",
            "post-audio-9.mp3",
        ]
        files = [FakePath(n) for n in names]
        ordered = sorted(
            files,
            key=lambda f: int(build.AUDIO_FILENAME_RE.search(f.name).group(1)),
        )
        self.assertEqual(
            [f.name for f in ordered],
            ["post-audio-1.mp3", "post-audio-2.mp3", "post-audio-9.mp3", "post-audio-10.mp3"],
        )

    def test_bad_filename_shape_is_rejected_by_the_regex(self):
        # audio_files_for() raises SystemExit for anything the glob matches
        # but this regex doesn't — assert the regex itself is the right shape
        # (the loud-error path is exercised via WrapMismatchTests' style below).
        self.assertIsNone(build.AUDIO_FILENAME_RE.search("post-audio-final.mp3"))
        self.assertIsNotNone(build.AUDIO_FILENAME_RE.search("post-audio-04.mp3"))


class WrapAudioSectionsMismatchTests(unittest.TestCase):
    def test_fewer_files_than_sections_raises(self):
        body = (
            "<p>Intro.</p>\n"
            '<h2 id="one">One</h2>\n'
            "<p>Body one.</p>\n"
            '<h2 id="two">Two</h2>\n'
            "<p>Body two.</p>"
        )
        with self.assertRaises(SystemExit):
            build.wrap_audio_sections(body, "slug", [FakePath("slug-audio-01.mp3")], "fake-path")

    def test_more_files_than_sections_raises(self):
        body = "<p>Intro only, no headings.</p>"
        with self.assertRaises(SystemExit):
            build.wrap_audio_sections(
                body, "slug",
                [FakePath("slug-audio-01.mp3"), FakePath("slug-audio-02.mp3")],
                "fake-path",
            )

    def test_exact_match_wraps_cleanly(self):
        body = (
            "<p>Intro.</p>\n"
            '<h2 id="one">One</h2>\n'
            "<p>Body one.</p>"
        )
        out = build.wrap_audio_sections(
            body, "slug",
            [FakePath("slug-audio-01.mp3"), FakePath("slug-audio-02.mp3")],
            "fake-path",
        )
        self.assertEqual(out.count('data-audio-section='), 2)
        self.assertIn("slug-audio-01.mp3", out)
        self.assertIn("slug-audio-02.mp3", out)


if __name__ == "__main__":
    unittest.main()
