'use client';

import { useEffect, useState } from 'react';
import { timeAgo } from '@/lib/time-format';

interface Comment {
  id: string;
  commenterAddress: string;
  body: string;
  createdAt: number;
}

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function ReportComments({ reportId, isAuthenticated }: { reportId: string; isAuthenticated: boolean }) {
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [input, setInput] = useState('');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/report/${reportId}/comments`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setComments(data.comments ?? []);
      })
      .catch(() => {
        if (!cancelled) setComments([]);
      });

    return () => {
      cancelled = true;
    };
  }, [reportId]);

  async function submitComment() {
    const trimmed = input.trim();
    if (!trimmed) return;

    setPosting(true);
    setError(null);
    try {
      const res = await fetch(`/api/report/${reportId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Could not post comment');

      setComments((prev) => [...(prev ?? []), data.comment]);
      setInput('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not post comment');
    } finally {
      setPosting(false);
    }
  }

  return (
    <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px dashed var(--border)' }}>
      {comments === null && <p className="muted" style={{ fontSize: 12.5 }}>Loading comments...</p>}

      {comments && comments.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          {comments.map((comment) => (
            <div key={comment.id} style={{ marginBottom: 6 }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <code style={{ fontSize: 11.5 }}>{shortAddress(comment.commenterAddress)}</code>
                <span className="muted" style={{ fontSize: 11 }}>
                  {timeAgo(comment.createdAt)}
                </span>
              </div>
              <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text)' }}>{comment.body}</p>
            </div>
          ))}
        </div>
      )}

      {isAuthenticated ? (
        <div className="row" style={{ gap: 6 }}>
          <input
            placeholder="Add a comment..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={1000}
            style={{ flex: 1 }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !posting) submitComment();
            }}
          />
          <button onClick={submitComment} disabled={posting || !input.trim()}>
            {posting ? '...' : 'Post'}
          </button>
        </div>
      ) : (
        <p className="muted" style={{ fontSize: 12 }}>Connect your wallet to comment.</p>
      )}

      {error && <p className="status-text error" style={{ fontSize: 12 }}>{error}</p>}
    </div>
  );
}
