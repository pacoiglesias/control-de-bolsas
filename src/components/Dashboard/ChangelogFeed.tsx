import { Modal } from '../ui';
import { SYSTEM_CHANGELOG, type SystemRelease } from '../../lib/systemChangelog';

export { SYSTEM_CHANGELOG, type SystemRelease };

export function ChangelogModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="📜 Bitácora Histórica de Cambios del Sistema" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxHeight: '65vh', overflowY: 'auto', paddingRight: 8 }}>
        {SYSTEM_CHANGELOG.map((item) => (
          <div key={item.version} style={{ padding: 16, background: 'var(--paper-sunk)', border: '1px solid var(--line)', borderRadius: 'var(--radius)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, flexWrap: 'wrap', gap: 8 }}>
              <span className="badge" style={{ background: 'var(--ok)', fontSize: 13, fontWeight: 700 }}>Versión {item.version}</span>
              <span style={{ fontSize: 12, color: 'var(--accent-deep)', fontWeight: 600 }}>🕒 {item.date} — {item.time}</span>
            </div>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)', marginBottom: 8 }}>{item.summary}</div>
            <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: 'var(--ink-soft)' }}>
              {item.highlights.map((h, i) => (
                <li key={i} style={{ marginBottom: 4 }}>{h}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Modal>
  );
}
