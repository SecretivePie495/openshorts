"""The backend comparison tool (compare_backends.py).

It exists to answer one question before anyone switches the moment picker to a
free backend: do the two pick the same moments? That answer is only worth
having if the matching is right — an overlap rule that is too generous reports
agreement that isn't there and talks someone into a downgrade they'll feel in
their clips rather than in their bill.

The env forcing matters just as much: llm_backend reads LLM_BASE_URL and
LLM_PROVIDER at call time, so if the tool failed to override whatever the shell
already had, it would cheerfully run the same backend twice and report perfect
agreement.
"""
import json

import pytest

cb = pytest.importorskip("compare_backends")


def clip(start, end, **extra):
    return {"start": start, "end": end, **extra}


class TestOverlap:
    def test_the_same_moment_scores_one(self):
        assert cb._iou(clip(10, 40), clip(10, 40)) == 1.0

    def test_disjoint_moments_score_zero(self):
        assert cb._iou(clip(0, 10), clip(20, 30)) == 0.0

    def test_touching_but_not_overlapping_is_still_zero(self):
        assert cb._iou(clip(0, 10), clip(10, 20)) == 0.0

    def test_partial_overlap_is_proportional(self):
        # 10s shared across a 30s union.
        assert cb._iou(clip(0, 20), clip(10, 30)) == pytest.approx(10 / 30)

    def test_a_contained_clip_is_penalised_by_the_union(self):
        # Same moment, very different cut: real, but not interchangeable.
        assert cb._iou(clip(0, 60), clip(20, 30)) == pytest.approx(10 / 60)

    def test_zero_length_does_not_divide_by_zero(self):
        assert cb._iou(clip(5, 5), clip(5, 5)) == 0.0


class TestMatching:
    def test_identical_picks_all_pair_up(self):
        left = [clip(0, 30), clip(60, 90)]
        pairs = cb._match(left, list(left))
        assert all(a and b for a, b, _ in pairs)
        assert len(pairs) == 2

    def test_an_unmatched_left_pick_is_reported_alone(self):
        pairs = cb._match([clip(0, 30)], [clip(200, 230)])
        assert (None in [p[0] for p in pairs]) or (None in [p[1] for p in pairs])
        assert len(pairs) == 2, "both sides' orphans must show up"

    def test_an_extra_right_pick_is_reported_alone(self):
        pairs = cb._match([clip(0, 30)], [clip(0, 30), clip(100, 130)])
        assert sum(1 for a, b, _ in pairs if a and b) == 1
        assert sum(1 for a, b, _ in pairs if a is None and b) == 1

    def test_each_right_pick_is_claimed_once(self):
        # Two left clips near one right clip must not both "match" it, or a
        # backend returning a single clip would look like full agreement.
        pairs = cb._match([clip(0, 30), clip(1, 31)], [clip(0, 30)])
        assert sum(1 for a, b, _ in pairs if a and b) == 1

    def test_a_weak_overlap_is_not_a_match(self):
        # 10/60 is well under the threshold: same region, different moment.
        pairs = cb._match([clip(0, 60)], [clip(20, 30)])
        assert all(b is None for a, b, _ in pairs if a is not None)

    def test_the_best_counterpart_wins_not_the_first(self):
        left = [clip(50, 80)]
        right = [clip(0, 30), clip(52, 78)]
        (_, matched, score), = [p for p in cb._match(left, right) if p[0]]
        assert matched == clip(52, 78)
        assert score > cb.MATCH_IOU


class TestBackendForcing:
    def test_gemini_is_forced_even_with_a_server_configured(self, monkeypatch):
        monkeypatch.setenv("LLM_BASE_URL", "http://localhost:11434/v1")
        monkeypatch.setenv("LLM_PROVIDER", "openai")
        llm_backend = pytest.importorskip("llm_backend")
        with cb._backend("gemini"):
            assert llm_backend.active() is False

    def test_the_server_is_forced_even_with_gemini_pinned(self, monkeypatch):
        monkeypatch.setenv("LLM_BASE_URL", "http://localhost:11434/v1")
        monkeypatch.setenv("LLM_PROVIDER", "gemini")
        llm_backend = pytest.importorskip("llm_backend")
        with cb._backend("openai-compatible"):
            assert llm_backend.active() is True

    def test_the_environment_is_put_back(self, monkeypatch):
        monkeypatch.setenv("LLM_BASE_URL", "http://original:1234/v1")
        monkeypatch.setenv("LLM_PROVIDER", "openai")
        with cb._backend("gemini"):
            pass
        import os
        assert os.environ["LLM_BASE_URL"] == "http://original:1234/v1"
        assert os.environ["LLM_PROVIDER"] == "openai"

    def test_a_variable_that_was_unset_stays_unset(self, monkeypatch):
        monkeypatch.setenv("LLM_BASE_URL", "http://x/v1")
        monkeypatch.delenv("LLM_PROVIDER", raising=False)
        with cb._backend("openai-compatible"):
            pass
        import os
        assert "LLM_PROVIDER" not in os.environ

    def test_it_refuses_rather_than_comparing_gemini_to_itself(self, monkeypatch):
        monkeypatch.delenv("LLM_BASE_URL", raising=False)
        with pytest.raises(SystemExit):
            with cb._backend("openai-compatible"):
                pass


class TestInputResolution:
    def test_a_metadata_file_is_taken_directly(self, tmp_path):
        f = tmp_path / "X_metadata.json"
        f.write_text("{}")
        assert cb._find_metadata(str(f)) == f

    def test_a_job_directory_is_searched(self, tmp_path):
        f = tmp_path / "My_Video_metadata.json"
        f.write_text("{}")
        assert cb._find_metadata(str(tmp_path)) == f

    def test_a_directory_without_metadata_says_so(self, tmp_path):
        with pytest.raises(SystemExit):
            cb._find_metadata(str(tmp_path))

    def test_a_bare_job_id_resolves_under_output_dir(self, tmp_path, monkeypatch):
        job = tmp_path / "job-abc"
        job.mkdir()
        (job / "V_metadata.json").write_text("{}")
        monkeypatch.setenv("OUTPUT_DIR", str(tmp_path))
        monkeypatch.chdir(tmp_path)
        assert cb._find_metadata("job-abc").name == "V_metadata.json"


class TestDuration:
    def test_it_takes_the_furthest_timestamp_mentioned(self):
        transcript = {"segments": [{"end": 90}, {"end": 120}]}
        assert cb._duration(transcript, [{"end": 200}]) == 200

    def test_transcript_alone_is_enough(self):
        assert cb._duration({"segments": [{"end": 45.5}]}, []) == 45.5

    def test_nothing_at_all_is_zero_not_an_error(self):
        assert cb._duration({"segments": []}, []) == 0.0


class TestReport:
    def test_it_flags_a_side_that_produced_nothing(self, capsys):
        rc = cb._report(
            {"kind": "gemini", "clips": [clip(0, 30)], "seconds": 1.0, "cost": {}},
            {"kind": "openai-compatible", "clips": [], "seconds": 1.0,
             "error": "returned no clips"},
        )
        assert rc == 1
        assert "Nothing to compare" in capsys.readouterr().out

    def test_full_agreement_is_reported_as_such(self, capsys):
        clips = [clip(0, 30, viral_hook_text="a"), clip(60, 90, viral_hook_text="b")]
        rc = cb._report(
            {"kind": "gemini", "clips": clips, "seconds": 2.0, "cost": {}},
            {"kind": "openai-compatible", "clips": list(clips), "seconds": 9.0,
             "cost": {}},
        )
        out = capsys.readouterr().out
        assert rc == 0
        assert "2/2" in out
        assert "same moments" in out

    def test_disagreement_warns_against_switching(self, capsys):
        cb._report(
            {"kind": "gemini", "clips": [clip(0, 30), clip(60, 90)], "seconds": 1.0,
             "cost": {}},
            {"kind": "openai-compatible", "clips": [clip(300, 330), clip(400, 430)],
             "seconds": 1.0, "cost": {}},
        )
        assert "not a drop-in" in capsys.readouterr().out


def test_a_silent_video_job_is_rejected_with_a_reason(tmp_path, monkeypatch):
    """No transcript means nothing for the text pickers to disagree about."""
    f = tmp_path / "Silent_metadata.json"
    f.write_text(json.dumps({"transcript": {"language": "none", "segments": []}}))
    monkeypatch.setattr("sys.argv", ["compare_backends.py", str(f)])
    with pytest.raises(SystemExit) as excinfo:
        cb.main_cli()
    assert "transcript" in str(excinfo.value)
