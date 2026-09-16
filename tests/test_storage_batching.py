"""R2 key deletion (cloud/storage.py).

delete_prefix has always batched, but named keys went out one API call each, so
a free-tier sweep spent a round-trip per clip. delete_keys batches them the same
way. The S3 limit is 1000 objects per DeleteObjects call, so the chunking is the
part worth pinning: one key over the line and the whole call is rejected, which
would fail a sweep rather than slow it.
"""
import pytest

storage = pytest.importorskip("cloud.storage")


class FakeClient:
    def __init__(self):
        self.calls = []

    def delete_objects(self, Bucket=None, Delete=None):
        self.calls.append(Delete["Objects"])
        return {"Deleted": Delete["Objects"]}


@pytest.fixture()
def fake(monkeypatch):
    c = FakeClient()
    monkeypatch.setattr(storage, "client", lambda: c)
    # settings.r2_bucket is a property over the environment.
    monkeypatch.setenv("R2_BUCKET", "test-bucket")
    return c


class TestDeleteKeys:
    def test_one_call_for_a_small_batch(self, fake):
        assert storage.delete_keys(["a.mp4", "b.mp4", "c.mp4"]) == 3
        assert len(fake.calls) == 1
        assert fake.calls[0] == [{"Key": "a.mp4"}, {"Key": "b.mp4"},
                                 {"Key": "c.mp4"}]

    def test_nothing_is_sent_for_an_empty_list(self, fake):
        assert storage.delete_keys([]) == 0
        assert fake.calls == []

    def test_falsy_keys_are_dropped_rather_than_sent(self, fake):
        # A None r2_key on a half-written row must not become a delete for "".
        assert storage.delete_keys(["a.mp4", "", None, "b.mp4"]) == 2
        assert fake.calls[0] == [{"Key": "a.mp4"}, {"Key": "b.mp4"}]

    def test_exactly_the_limit_still_fits_one_call(self, fake):
        assert storage.delete_keys([f"{i}.mp4" for i in range(1000)]) == 1000
        assert len(fake.calls) == 1

    def test_over_the_limit_splits(self, fake):
        assert storage.delete_keys([f"{i}.mp4" for i in range(1001)]) == 1001
        assert [len(c) for c in fake.calls] == [1000, 1]

    def test_every_key_is_sent_exactly_once(self, fake):
        keys = [f"{i}.mp4" for i in range(2500)]
        assert storage.delete_keys(keys) == 2500
        sent = [o["Key"] for call in fake.calls for o in call]
        assert sent == keys
