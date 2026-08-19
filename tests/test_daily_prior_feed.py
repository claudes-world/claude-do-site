#!/usr/bin/env python3
"""Tests for the Daily Prior secondary feed + podcast RSS (WORLD-614, slice 1).

Builds the real site into a temp DIST (monkeypatched onto build.DIST/CONTENT)
so these exercise the actual build_daily_prior() pipeline, not a re-implementation
of it. unittest.TestCase classes are pytest-discoverable (`pytest tests/`) and
also runnable standalone: `python3 tests/test_daily_prior_feed.py` — matches
the existing tests/test_audio_tour.py convention (stdlib only, no new deps).
"""
import pathlib
import shutil
import sys
import tempfile
import unittest
import uuid
import xml.etree.ElementTree as ET

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import build  # noqa: E402
from tools import upload_media  # noqa: E402

ITUNES_NS = "{http://www.itunes.com/dtds/podcast-1.0.dtd}"


class DailyPriorBuildTests(unittest.TestCase):
    """Builds the whole site once into a scratch dist/ and asserts against
    the real output — shared across all test methods for speed, since the
    build is deterministic and none of these tests mutate content/."""

    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.mkdtemp(prefix="daily-prior-test-")
        cls._orig_dist = build.DIST
        build.DIST = pathlib.Path(cls.tmp) / "dist"
        build.build()
        cls.dist = build.DIST

    @classmethod
    def tearDownClass(cls):
        build.DIST = cls._orig_dist
        shutil.rmtree(cls.tmp, ignore_errors=True)

    # ---- podcast.xml is well-formed and carries the required tags ----

    def test_podcast_xml_is_well_formed(self):
        path = self.dist / "daily-prior" / "podcast.xml"
        self.assertTrue(path.exists(), "podcast.xml was not built")
        ET.parse(path)  # raises ET.ParseError on malformed XML

    def test_podcast_xml_required_channel_and_item_tags(self):
        path = self.dist / "daily-prior" / "podcast.xml"
        root = ET.parse(path).getroot()
        channel = root.find("channel")
        self.assertIsNotNone(channel)

        for tag in ("title", "link", "description", "language"):
            self.assertIsNotNone(channel.find(tag), f"channel missing <{tag}>")

        for tag in ("author", "summary", "owner", "image", "category", "explicit"):
            self.assertIsNotNone(channel.find(f"{ITUNES_NS}{tag}"), f"channel missing <itunes:{tag}>")
        owner = channel.find(f"{ITUNES_NS}owner")
        self.assertIsNotNone(owner.find(f"{ITUNES_NS}email"))

        items = channel.findall("item")
        self.assertGreaterEqual(len(items), 1, "expected at least one podcast item")
        for item in items:
            for tag in ("title", "link", "guid", "pubDate", "description", "enclosure"):
                self.assertIsNotNone(item.find(tag), f"item missing <{tag}>")
            guid_el = item.find("guid")
            self.assertEqual(guid_el.get("isPermaLink"), "false")
            uuid.UUID(guid_el.text)  # raises ValueError if not a real UUID
            enclosure = item.find("enclosure")
            self.assertTrue(enclosure.get("url"))
            self.assertTrue(int(enclosure.get("length")) > 0)
            self.assertEqual(enclosure.get("type"), "audio/mpeg")
            # RFC 2822 pubDate must carry an explicit numeric offset.
            pub_date = item.find("pubDate").text
            self.assertRegex(pub_date, r"[+-]\d{4}$")

    def test_podcast_xml_pubdate_offset_is_correct(self):
        path = self.dist / "daily-prior" / "podcast.xml"
        root = ET.parse(path).getroot()
        item = root.find("channel").find("item")
        # The fixture episode has date: 2026-08-18, rendered at UTC midnight.
        self.assertIn("+0000", item.find("pubDate").text)

    # ---- enclosure URLs are the media-host frontmatter value, verbatim ----

    def test_enclosure_url_is_media_host_url_verbatim(self):
        root = ET.parse(self.dist / "daily-prior" / "podcast.xml").getroot()
        enclosures = {item.find("title").text: item.find("enclosure").get("url")
                      for item in root.find("channel").findall("item")}
        # The launch episode's frontmatter audio_url, byte-for-byte.
        self.assertEqual(
            enclosures["The Daily Prior Launches"],
            "https://media.claude.do/daily-prior/2026-08-18-the-daily-prior-launches.mp3")
        for title, url in enclosures.items():
            self.assertTrue(url.startswith(build.DAILY_PRIOR_MEDIA_BASE),
                            f"{title!r} enclosure {url!r} is off the media host")

    # ---- GUID stability across rebuilds ----

    def test_guid_stable_across_rebuilds(self):
        first = self._episode_guids()
        build.build()  # rebuild into the same scratch DIST
        second = self._episode_guids()
        self.assertEqual(first, second)
        self.assertTrue(first, "no episodes found to compare")

    def _episode_guids(self):
        root = ET.parse(self.dist / "daily-prior" / "podcast.xml").getroot()
        return sorted(item.find("guid").text for item in root.find("channel").findall("item"))

    # ---- audio-less episode: page yes, podcast item no ----

    def test_episode_without_audio_is_skipped_from_podcast_feed(self):
        root = ET.parse(self.dist / "daily-prior" / "podcast.xml").getroot()
        titles = [item.find("title").text for item in root.find("channel").findall("item")]
        self.assertNotIn("Field Notes: Sourcing Without a Recorder", titles)
        # ...but it still gets a page.
        page = self.dist / "daily-prior" / "field-notes-sourcing-without-a-recorder" / "index.html"
        self.assertTrue(page.exists())

    # ---- draft exclusion: feed no, index no, page yes (under drafts/) ----

    def test_draft_excluded_from_podcast_feed(self):
        root = ET.parse(self.dist / "daily-prior" / "podcast.xml").getroot()
        titles = [item.find("title").text for item in root.find("channel").findall("item")]
        self.assertNotIn("Draft: Format Ideas We Haven't Committed To", titles)

    def test_draft_excluded_from_daily_prior_index(self):
        index_html = (self.dist / "daily-prior" / "index.html").read_text(encoding="utf-8")
        self.assertNotIn("draft-format-ideas", index_html)

    def test_draft_still_builds_under_drafts_path_for_preview(self):
        page = self.dist / "daily-prior" / "drafts" / "draft-format-ideas" / "index.html"
        self.assertTrue(page.exists())
        # And NOT at the live path.
        self.assertFalse((self.dist / "daily-prior" / "draft-format-ideas").exists())

    # ---- isolation from the main blog/rss ----

    def test_daily_prior_episode_absent_from_main_rss(self):
        main_rss = (self.dist / "rss.xml").read_text(encoding="utf-8")
        self.assertNotIn("The Daily Prior Launches", main_rss)
        self.assertNotIn("daily-prior", main_rss)

    def test_daily_prior_episode_absent_from_main_blog_index(self):
        blog_index = (self.dist / "blog" / "index.html").read_text(encoding="utf-8")
        self.assertNotIn("The Daily Prior Launches", blog_index)
        self.assertNotIn("/daily-prior/", blog_index)

    def test_main_blog_posts_still_present_and_unaffected(self):
        # Sanity: the main content pipeline still ran and wasn't shadowed.
        self.assertTrue((self.dist / "blog" / "index.html").exists())
        self.assertTrue((self.dist / "rss.xml").exists())


class DailyPriorFixRoundTests(unittest.TestCase):
    """Regression tests for the 2026-08-18 codex review fix round."""

    def test_xml_attr_quotes_survive_attribute_context(self):
        # MUST fix: a double-quote inside audio_url must not break podcast.xml.
        # quoteattr may pick single- or double-quote wrapping; the contract is
        # well-formedness + round-trip, not a specific entity.
        ugly = 'https://media.claude.do/a"b&c.mp3'
        frag = f"<enclosure url={build.xml_attr(ugly)} length=\"1\" type={build.xml_attr('audio/mpeg')}/>"
        el = ET.fromstring(frag)  # raises if not well-formed
        self.assertEqual(el.get("url"), ugly)  # value survives exactly

    def test_duplicate_slug_raises_loudly(self):
        import copy
        with tempfile.TemporaryDirectory() as td:
            td = pathlib.Path(td)
            src = td / "content" / "daily-prior"
            src.mkdir(parents=True)
            for name in ("a.md", "b.md"):
                (src / name).write_text(
                    "---\n"
                    "title: Dup\n"
                    "slug: same-slug\n"
                    "date: 2026-08-18\n"
                    f"guid: {uuid.uuid4()}\n"
                    "description: d\n"
                    "---\n\nbody\n",
                    encoding="utf-8")
            old_content, old_dist = build.CONTENT, build.DIST
            try:
                build.CONTENT, build.DIST = td / "content", td / "dist"
                with self.assertRaises(SystemExit) as cm:
                    build.build_daily_prior()
                self.assertIn("duplicate slug", str(cm.exception))
            finally:
                build.CONTENT, build.DIST = old_content, old_dist

    def test_draft_page_carries_noindex(self):
        # Fresh build: DailyPriorBuildTests' dist is torn down by the time
        # this class runs.
        td = pathlib.Path(tempfile.mkdtemp())
        old_dist = build.DIST
        try:
            build.DIST = td
            (td).mkdir(exist_ok=True)
            build.build_daily_prior()
        finally:
            build.DIST = old_dist
        dist = td
        drafts_dir = dist / "daily-prior" / "drafts"
        pages = list(drafts_dir.glob("*/index.html"))
        self.assertTrue(pages, "expected at least one built draft page")
        for p in pages:
            self.assertIn('name="robots" content="noindex', p.read_text(encoding="utf-8"))
        # control: a LIVE episode page must NOT carry noindex
        live_pages = [p for p in (dist / "daily-prior").glob("*/index.html")]
        live_pages = [p for p in live_pages if "drafts" not in str(p)]
        self.assertTrue(live_pages)
        for p in live_pages:
            self.assertNotIn('content="noindex', p.read_text(encoding="utf-8"))


class DailyPriorMediaHostGateTests(unittest.TestCase):
    """R2 media-host wiring: local/relative/off-host audio_url is a loud
    build failure — enclosures only ever point at media.claude.do."""

    def _build_with_audio_url(self, audio_url):
        with tempfile.TemporaryDirectory() as td:
            td = pathlib.Path(td)
            src = td / "content" / "daily-prior"
            src.mkdir(parents=True)
            (src / "ep.md").write_text(
                "---\n"
                "title: Local Audio Episode\n"
                "slug: local-audio-episode\n"
                "date: 2026-08-19\n"
                f"guid: {uuid.uuid4()}\n"
                "description: d\n"
                f"audio_url: {audio_url}\n"
                "audio_bytes: 12345\n"
                "audio_type: audio/mpeg\n"
                "---\n\nbody\n",
                encoding="utf-8")
            old_content, old_dist = build.CONTENT, build.DIST
            try:
                build.CONTENT, build.DIST = td / "content", td / "dist"
                build.build_daily_prior()
            finally:
                build.CONTENT, build.DIST = old_content, old_dist

    def test_local_relative_audio_path_fails_the_build(self):
        for bad in ("/audio/ep.mp3", "audio/ep.mp3", "./ep.mp3",
                    "https://claude.do/audio/ep.mp3",
                    "http://media.claude.do/daily-prior/x/episode.mp3"):
            with self.assertRaises(SystemExit, msg=bad) as cm:
                self._build_with_audio_url(bad)
            self.assertIn("media host", str(cm.exception))
            self.assertIn(bad, str(cm.exception))

    def test_media_host_audio_url_builds_clean(self):
        # Negative control: the same episode with a media-host URL builds.
        self._build_with_audio_url(
            "https://media.claude.do/daily-prior/local-audio-episode/episode.mp3")


class UploadMediaUnitTests(unittest.TestCase):
    """tools/upload_media.py — pure request-building, no network."""

    def test_content_type_mapping(self):
        self.assertEqual(upload_media.content_type_for("episode.mp3"), "audio/mpeg")
        self.assertEqual(upload_media.content_type_for("EP.MP3"), "audio/mpeg")
        self.assertEqual(upload_media.content_type_for("cover.png"), "image/png")
        self.assertEqual(upload_media.content_type_for("photo.jpg"), "image/jpeg")
        self.assertEqual(upload_media.content_type_for("photo.jpeg"), "image/jpeg")
        self.assertEqual(upload_media.content_type_for("notes.txt"),
                         "application/octet-stream")

    def test_episode_key_layout(self):
        self.assertEqual(upload_media.episode_key("the-daily-prior-launches"),
                         "daily-prior/the-daily-prior-launches/episode.mp3")
        self.assertEqual(upload_media.episode_key("x", "cover.png"),
                         "daily-prior/x/cover.png")

    def test_normalize_key(self):
        self.assertEqual(upload_media.normalize_key("/daily-prior/a/b.mp3"),
                         "daily-prior/a/b.mp3")
        for bad in ("", "/", "a//b", "a/../b", "./a"):
            with self.assertRaises(SystemExit, msg=bad):
                upload_media.normalize_key(bad)

    def test_build_put_request_shape(self):
        req = upload_media.build_put_request(
            "acct123", "worldos-media", "daily-prior/slug/episode.mp3",
            b"data", 4, "audio/mpeg", "tok")
        self.assertEqual(req.get_method(), "PUT")
        self.assertEqual(
            req.full_url,
            "https://api.cloudflare.com/client/v4/accounts/acct123/r2/"
            "buckets/worldos-media/objects/daily-prior/slug/episode.mp3")
        self.assertEqual(req.get_header("Authorization"), "Bearer tok")
        self.assertEqual(req.get_header("Content-type"), "audio/mpeg")
        self.assertEqual(req.get_header("Content-length"), "4")

    def test_object_url_percent_encodes_key(self):
        url = upload_media.object_url("a", "b", "daily-prior/ep one/f#1.mp3")
        self.assertIn("daily-prior/ep%20one/f%231.mp3", url)

    def test_public_url(self):
        self.assertEqual(
            upload_media.public_url("https://media.claude.do",
                                    "daily-prior/s/episode.mp3"),
            "https://media.claude.do/daily-prior/s/episode.mp3")


if __name__ == "__main__":
    unittest.main()
