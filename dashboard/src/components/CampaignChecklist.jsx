import { useState } from 'react';
import { ClipboardList, Loader2, AlertCircle } from 'lucide-react';
import { apiFetch } from '../lib/api';

const SECTIONS = [
  { key: 'tags', label: 'Tag & mention (every post)' },
  { key: 'format', label: 'Format' },
  { key: 'cta', label: 'CTA' },
  { key: 'before_you_post', label: 'Before you post (one-time)' },
  { key: 'donts', label: "Don't" },
];

export default function CampaignChecklist({ geminiApiKey, managed = false }) {
  const keyHeader = geminiApiKey ? { 'X-Gemini-Key': geminiApiKey } : {};
  const needsKey = !geminiApiKey && !managed;
  const [briefText, setBriefText] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async () => {
    if (!briefText.trim()) return;
    if (needsKey) return setError('Please set your Gemini API key in Settings first.');
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await apiFetch('/api/campaign-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...keyHeader },
        body: JSON.stringify({ brief_text: briefText }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail?.message || err.detail || `Request failed (${res.status})`);
      }
      setResult(await res.json());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto custom-scrollbar animate-fade">
      <div className="max-w-xl w-full mx-auto px-4 py-5 sm:p-6 space-y-5">
        <div className="text-center space-y-1.5">
          <ClipboardList size={22} className="mx-auto text-muted" />
          <h1 className="font-display lowercase text-2xl sm:text-3xl text-ink">Campaign Checklist</h1>
          <p className="text-muted text-sm">Paste a UGC/clipping campaign brief, get a short do-this list.</p>
        </div>

        <textarea
          value={briefText}
          onChange={(e) => setBriefText(e.target.value)}
          placeholder="Paste the full campaign brief here…"
          rows={10}
          className="w-full rounded-card border border-rule2 bg-paper3 p-3 text-sm text-ink2 focus:outline-none focus:border-brass resize-y"
        />

        <button
          onClick={handleSubmit}
          disabled={loading || !briefText.trim()}
          className="btn-primary w-full py-2.5 flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : null}
          {loading ? 'Reading brief…' : 'Make checklist'}
        </button>

        {error && (
          <div className="flex items-start gap-2 text-sm text-red-500 bg-red-500/10 rounded-card p-3">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {result && (
          <div className="space-y-4">
            {SECTIONS.map(({ key, label }) =>
              result[key]?.length ? (
                <div key={key} className="rounded-card border border-rule2 bg-paper3 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted mb-2">{label}</p>
                  <ul className="space-y-1.5">
                    {result[key].map((item, i) => (
                      <li key={i} className="text-sm text-ink2 flex gap-2">
                        <span className="text-muted shrink-0">·</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null
            )}
            {result.missing?.length ? (
              <div className="rounded-card border border-rule2 bg-paper2 p-4">
                <p className="text-xs uppercase tracking-wide text-muted mb-2">Not in the brief</p>
                <ul className="space-y-1.5">
                  {result.missing.map((item, i) => (
                    <li key={i} className="text-sm text-muted flex gap-2">
                      <span className="shrink-0">·</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
