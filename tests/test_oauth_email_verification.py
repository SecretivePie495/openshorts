"""Google OAuth account merging (cloud/oauth.py).

The callback merges a Google login into an existing magic-link account with the
same address, and nothing checked whether Google had actually verified it. On a
Workspace domain that allows unverified custom-domain addresses, that made
registering <victim>@<domain> at Google enough to sign in as the victim — the
merge hands over their existing account, plan and library.

The claim has to fail closed: an address nobody vouches for must be refused
outright rather than treated as new, because User.email is unique and letting
an unproven login claim it would just move the problem to squatting.
"""
import pytest

oauth = pytest.importorskip("cloud.oauth")

email_is_verified = oauth.email_is_verified


class TestGoogleVouchesForIt:
    def test_the_json_boolean_google_sends(self):
        assert email_is_verified({"email_verified": True}) is True

    @pytest.mark.parametrize("claim", ["true", "True", " TRUE "])
    def test_the_string_form_other_providers_send(self, claim):
        assert email_is_verified({"email_verified": claim}) is True


class TestItDoesNot:
    def test_an_address_google_says_is_unverified(self):
        assert email_is_verified({"email_verified": False}) is False

    def test_the_string_false(self):
        assert email_is_verified({"email_verified": "false"}) is False

    def test_a_missing_claim_fails_closed(self):
        # The takeover case itself: silence is not a vouch.
        assert email_is_verified({}) is False

    def test_an_explicit_null(self):
        assert email_is_verified({"email_verified": None}) is False

    @pytest.mark.parametrize("claim", [0, 1, "", "yes", "1", "on", [], {}])
    def test_nothing_else_counts(self, claim):
        assert email_is_verified({"email_verified": claim}) is False
