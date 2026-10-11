// Downloadable PDF for the Draft stage. Client-side only (@react-pdf/renderer
// renders entirely in the browser here — no server route, no added Vercel
// function cost). Mirrors DraftPanel's nine sections and sourcing discipline:
// every chip still shows its source, and UNSOURCED claims are visually
// flagged red here too, exactly as on screen, so the PDF never looks more
// finished than the draft actually is.

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import type { Draft } from "@/lib/types";

// react-pdf's built-in Helvetica has no bold-italic metrics warning noise;
// register nothing extra and just use the standard family — keeps this
// dependency-free and avoids a font-loading failure mid-demo.
Font.registerHyphenationCallback((word) => [word]);

const palette = {
  oliveDeep: "#636b2f",
  olive: "#8fa050",
  ink: "#30351f",
  muted: "#4c5440",
  faint: "#5f684f",
  line: "#dce1cc",
  lineSoft: "#edf0e2",
  card: "#ffffff",
  mint: "#eef2dc",
  skyBg: "#f1ecd2",
  skyDeep: "#6e5a1e",
  block: "#9c3a2e",
  blockBg: "#f5e3de",
};

const s = StyleSheet.create({
  coverPage: {
    backgroundColor: palette.oliveDeep,
    color: "#ffffff",
    padding: 56,
    fontFamily: "Helvetica",
  },
  coverKicker: {
    fontSize: 9,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: "#d4de95",
    marginBottom: 10,
  },
  coverTitle: {
    fontSize: 28,
    fontFamily: "Helvetica-Bold",
    marginBottom: 6,
  },
  coverSub: {
    fontSize: 13,
    color: "#eef2dc",
    marginBottom: 28,
  },
  coverMetaRow: {
    flexDirection: "row",
    gap: 18,
    marginBottom: 24,
    borderTopWidth: 1,
    borderTopColor: "#8a9552",
    paddingTop: 14,
  },
  coverMetaLabel: {
    fontSize: 8,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "#bac095",
    marginBottom: 2,
  },
  coverMetaValue: {
    fontSize: 11,
    color: "#ffffff",
  },
  coverPitchBox: {
    backgroundColor: "#4f5a24",
    borderRadius: 4,
    padding: 16,
    marginBottom: 20,
  },
  coverPitchLabel: {
    fontSize: 8,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "#d4de95",
    marginBottom: 6,
  },
  coverPitchText: {
    fontSize: 11,
    lineHeight: 1.5,
    color: "#ffffff",
  },
  coverLogoNote: {
    fontSize: 9,
    fontStyle: "italic",
    color: "#d4de95",
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#8a9552",
    borderRadius: 4,
    padding: 10,
  },
  coverFooter: {
    position: "absolute",
    bottom: 40,
    left: 56,
    right: 56,
    fontSize: 8,
    color: "#bac095",
  },

  page: {
    paddingTop: 40,
    paddingBottom: 48,
    paddingHorizontal: 44,
    fontFamily: "Helvetica",
    fontSize: 9.5,
    color: palette.ink,
  },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 44,
    right: 44,
    fontSize: 7.5,
    color: palette.faint,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 0.5,
    borderTopColor: palette.line,
    paddingTop: 6,
  },

  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 18,
    marginBottom: 8,
  },
  sectionBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: palette.oliveDeep,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionBadgeText: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#ffffff",
  },
  sectionTitle: {
    fontSize: 12.5,
    fontFamily: "Helvetica-Bold",
    color: palette.ink,
  },

  label: {
    fontSize: 7.5,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: palette.faint,
    marginBottom: 2,
    marginTop: 6,
  },
  body: {
    fontSize: 9.5,
    lineHeight: 1.45,
    color: palette.ink,
  },
  muted: {
    fontSize: 9.5,
    lineHeight: 1.45,
    color: palette.muted,
  },

  card: {
    borderWidth: 0.75,
    borderColor: palette.lineSoft,
    borderRadius: 3,
    padding: 8,
    marginBottom: 6,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 5,
  },
  twoCol: {
    flexDirection: "row",
    gap: 14,
  },
  col: {
    flex: 1,
  },

  chip: {
    fontSize: 7.5,
    fontFamily: "Courier",
    borderWidth: 0.75,
    borderRadius: 3,
    paddingVertical: 1.5,
    paddingHorizontal: 4,
  },
  chipSrc: {
    backgroundColor: palette.skyBg,
    color: palette.skyDeep,
    borderColor: "#d9cba0",
  },
  chipUnsourced: {
    backgroundColor: palette.blockBg,
    color: palette.block,
    borderColor: "#debab2",
  },
  chipNeutral: {
    backgroundColor: palette.lineSoft,
    color: palette.muted,
    borderColor: palette.line,
  },

  leadBanner: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    backgroundColor: palette.mint,
    borderWidth: 1.5,
    borderColor: palette.oliveDeep,
    borderRadius: 4,
    padding: 8,
    marginBottom: 6,
  },
  leadBannerLabel: {
    fontSize: 7.5,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: palette.oliveDeep,
    fontFamily: "Helvetica-Bold",
  },
  leadBannerName: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
  },

  bullet: {
    flexDirection: "row",
    gap: 5,
    marginBottom: 3,
  },
  bulletDot: {
    fontSize: 9.5,
    color: palette.olive,
  },
});

function isUnsourced(src?: string) {
  return /UNSOURCED/i.test(src || "");
}

function Chip({ children }: { children: string }) {
  const style = isUnsourced(children) ? s.chipUnsourced : s.chipSrc;
  return (
    <View style={[s.chip, style]}>
      <Text>{children || "—"}</Text>
    </View>
  );
}

function NeutralChip({ children }: { children: string }) {
  return (
    <View style={[s.chip, s.chipNeutral]}>
      <Text>{children}</Text>
    </View>
  );
}

function SectionHeader({ n, title }: { n: number; title: string }) {
  return (
    <View style={s.sectionHeaderRow} wrap={false}>
      <View style={s.sectionBadge}>
        <Text style={s.sectionBadgeText}>{n}</Text>
      </View>
      <Text style={s.sectionTitle}>{title}</Text>
    </View>
  );
}

function Field({ label, text }: { label: string; text?: string }) {
  if (!text) return null;
  return (
    <View>
      <Text style={s.label}>{label}</Text>
      <Text style={s.body}>{text}</Text>
    </View>
  );
}

function BulletList({ items }: { items: { text: string; source?: string }[] }) {
  return (
    <View>
      {items.map((it, i) => (
        <View key={i} style={s.bullet}>
          <Text style={s.bulletDot}>•</Text>
          <Text style={{ ...s.body, flex: 1 }}>{it.text}</Text>
          {it.source && <Chip>{it.source}</Chip>}
        </View>
      ))}
    </View>
  );
}

// react-pdf's built-in fonts (Helvetica/Times/Courier) use the legacy
// WinAnsi 8-bit encoding, which has no glyph for ₹ (Indian Rupee sign,
// U+20B9) — it renders as a broken box/mojibake instead of silently
// falling back. Sanitising the whole draft once here, rather than adding a
// fetched web font as a demo-time dependency, keeps PDF generation fully
// offline and avoids a font-loading failure mid-presentation.
function sanitizeForPdf<T>(value: T): T {
  if (typeof value === "string") {
    return value.replace(/₹/g, "Rs. ") as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeForPdf) as unknown as T;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = sanitizeForPdf(v);
    }
    return out as T;
  }
  return value;
}

export function DraftDocument({
  draft: rawDraft,
  clientName: rawClientName,
  approvedBy,
}: {
  draft: Draft;
  clientName?: string;
  approvedBy?: { name: string; at: string } | null;
}) {
  const draft = sanitizeForPdf(rawDraft);
  const clientName = rawClientName ? sanitizeForPdf(rawClientName) : rawClientName;
  const coverTitle = `Proposal Response — ${draft.cover?.client_name || clientName || "Client"}`;

  return (
    <Document title={coverTitle} author={draft.cover?.firm_name || "Vertex Consulting Group"}>
      {/* Cover page */}
      <Page size="A4" style={s.coverPage}>
        <Text style={s.coverKicker}>VCG Proposal Agent — First Draft for Partner Review</Text>
        <Text style={s.coverTitle}>{draft.cover?.firm_name || "Vertex Consulting Group"}</Text>
        <Text style={s.coverSub}>Proposal response for {draft.cover?.client_name || clientName}</Text>

        <View style={s.coverMetaRow}>
          <View>
            <Text style={s.coverMetaLabel}>Reference</Text>
            <Text style={s.coverMetaValue}>{draft.cover?.reference || "—"}</Text>
          </View>
          <View>
            <Text style={s.coverMetaLabel}>Date</Text>
            <Text style={s.coverMetaValue}>{draft.cover?.date || "—"}</Text>
          </View>
          {draft.lead_department?.name && (
            <View>
              <Text style={s.coverMetaLabel}>Lead department</Text>
              <Text style={s.coverMetaValue}>{draft.lead_department.name}</Text>
            </View>
          )}
          {approvedBy && (
            <View>
              <Text style={s.coverMetaLabel}>Pursuit approved by</Text>
              <Text style={s.coverMetaValue}>{approvedBy.name}</Text>
            </View>
          )}
        </View>

        {draft.cover?.pitch && (
          <View style={s.coverPitchBox}>
            <Text style={s.coverPitchLabel}>The pitch</Text>
            <Text style={s.coverPitchText}>{draft.cover.pitch}</Text>
          </View>
        )}

        {draft.cover?.logo_note && (
          <Text style={s.coverLogoNote}>{draft.cover.logo_note}</Text>
        )}

        <Text style={s.coverFooter}>
          Internal first draft — not a client deliverable. Every claim in this
          document carries a source; items marked UNSOURCED need partner
          verification before anything is sent externally.
        </Text>
      </Page>

      {/* Content pages — auto-paginates from here */}
      <Page size="A4" style={s.page}>
        <Text
          style={s.footer}
          fixed
          render={({ pageNumber, totalPages }) =>
            `VCG Proposal Agent — internal draft, not for client distribution  ·  Page ${pageNumber} of ${totalPages}`
          }
        />

        {draft.lead_department?.name && (
          <View style={s.leadBanner}>
            <Text style={s.leadBannerLabel}>Lead department</Text>
            <Text style={s.leadBannerName}>{draft.lead_department.name}</Text>
            {draft.lead_department.reasoning && (
              <Text style={{ fontSize: 9, color: palette.muted }}>
                — {draft.lead_department.reasoning}
              </Text>
            )}
            {draft.lead_department.source && <Chip>{draft.lead_department.source}</Chip>}
          </View>
        )}

        <SectionHeader n={2} title="Executive summary" />
        <Field label="Current state" text={draft.executive_summary?.current_state} />
        <Field label="Risks of inaction" text={draft.executive_summary?.risks_of_inaction} />
        <Field label="Future state" text={draft.executive_summary?.future_state} />
        <Field label="Why VCG" text={draft.executive_summary?.why_us} />

        <SectionHeader n={3} title="Understanding of the brief & scope assessment" />
        <Field label="Root-cause diagnostic" text={draft.understanding?.root_cause_diagnostic} />
        <View style={s.twoCol}>
          <View style={s.col}>
            <Text style={s.label}>In scope</Text>
            <BulletList
              items={(draft.understanding?.in_scope ?? []).map((x) => ({
                text: x.item,
                source: x.source,
              }))}
            />
          </View>
          <View style={s.col}>
            <Text style={s.label}>Out of scope</Text>
            <BulletList
              items={(draft.understanding?.out_of_scope ?? []).map((x) => ({
                text: x.item,
                source: x.source,
              }))}
            />
          </View>
        </View>

        <SectionHeader n={4} title="Consulting methodology & frameworks" />
        {(draft.methodology?.phases ?? []).map((p, i) => (
          <View key={i} style={s.card} wrap={false}>
            <View style={s.row}>
              <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 9.5 }}>{p.phase}</Text>
              <Text style={{ fontSize: 8, color: palette.faint }}>{p.weeks}</Text>
              {p.department && <NeutralChip>{p.department}</NeutralChip>}
              {p.source && <Chip>{p.source}</Chip>}
            </View>
            <Text style={{ ...s.muted, marginTop: 3 }}>{p.activities}</Text>
            <Text style={{ fontSize: 8.5, fontStyle: "italic", color: palette.faint, marginTop: 2 }}>
              Output: {p.output}
            </Text>
          </View>
        ))}
        {(draft.methodology?.toolkits?.length ?? 0) > 0 && (
          <View>
            <Text style={s.label}>Toolkits & frameworks</Text>
            <BulletList
              items={draft.methodology.toolkits.map((t) => ({
                text: `${t.name} — ${t.use}`,
                source: t.source,
              }))}
            />
          </View>
        )}

        <SectionHeader n={5} title="Deliverables & project timeline" />
        <Text style={s.label}>Milestones (text stand-in for a Gantt chart)</Text>
        {(draft.timeline?.milestones ?? []).map((m, i) => (
          <View key={i} style={s.row}>
            <Text style={{ fontSize: 8, color: palette.faint, width: 60 }}>{m.when}</Text>
            <Text style={{ ...s.body, flex: 1 }}>{m.milestone}</Text>
            <Text style={{ fontSize: 8, color: palette.faint }}>({m.phase})</Text>
            {m.source && <Chip>{m.source}</Chip>}
          </View>
        ))}
        <Text style={{ ...s.label, marginTop: 10 }}>Concrete deliverables</Text>
        <BulletList
          items={(draft.timeline?.deliverables ?? []).map((d) => ({
            text: `${d.name} — ${d.description}`,
            source: d.source,
          }))}
        />

        <SectionHeader n={6} title="Engagement team structure & bios" />
        <Text style={s.label}>Governance</Text>
        {(draft.team?.governance ?? []).map((g, i) => (
          <View key={i} style={s.row}>
            <Text style={s.body}>
              {g.role}: {g.named_individual}
              {g.reports_to ? ` → reports to ${g.reports_to}` : ""}
            </Text>
            {g.department && <NeutralChip>{g.department}</NeutralChip>}
            {g.source && <Chip>{g.source}</Chip>}
          </View>
        ))}
        <Text style={{ ...s.label, marginTop: 10 }}>Bios</Text>
        {(draft.team?.bios ?? []).map((b, i) => (
          <View key={i} style={s.card} wrap={false}>
            <View style={s.row}>
              <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 9.5 }}>{b.name}</Text>
              <Text style={{ fontSize: 8, color: palette.faint }}>
                {b.role} · {b.allocation}
              </Text>
              {b.source && <Chip>{b.source}</Chip>}
            </View>
            <Text style={{ ...s.muted, marginTop: 3 }}>{b.bio}</Text>
          </View>
        ))}

        <SectionHeader n={7} title="Qualifications, case studies & references" />
        {(draft.case_studies ?? []).map((c, i) => (
          <View key={i} style={s.card} wrap={false}>
            <View style={s.row}>
              <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 9.5 }}>{c.client}</Text>
              {c.source && <Chip>{c.source}</Chip>}
            </View>
            <Text style={{ ...s.label, marginTop: 5 }}>Situation</Text>
            <Text style={s.body}>{c.situation}</Text>
            <Text style={s.label}>Action</Text>
            <Text style={s.body}>{c.action}</Text>
            <Text style={s.label}>Result</Text>
            <Text style={{ ...s.body, fontFamily: "Helvetica-Bold" }}>{c.result}</Text>
          </View>
        ))}
        {draft.references_note && (
          <Text style={{ fontSize: 8.5, fontStyle: "italic", color: palette.faint, marginTop: 4 }}>
            {draft.references_note}
          </Text>
        )}

        <SectionHeader n={8} title="Commercial proposal & pricing options" />
        {(draft.commercial?.fee_options ?? []).map((f, i) => (
          <View key={i} style={s.card} wrap={false}>
            <View style={s.row}>
              <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 9.5 }}>{f.structure}</Text>
              <Text style={{ fontSize: 8.5, fontFamily: "Courier" }}>{f.indicative_fee}</Text>
              {f.source && <Chip>{f.source}</Chip>}
            </View>
            <Text style={{ ...s.muted, marginTop: 3 }}>{f.detail}</Text>
          </View>
        ))}
        <Field label="Out-of-pocket expenses policy" text={draft.commercial?.expenses_policy} />
        <Field label="Margin check (38% floor)" text={draft.commercial?.margin_check} />

        <SectionHeader n={9} title="Risk management, assumptions & dependencies" />
        <Text style={s.label}>Client dependencies</Text>
        <BulletList
          items={(draft.risks?.client_dependencies ?? []).map((d) => ({
            text: d.item,
            source: d.source,
          }))}
        />
        <Text style={{ ...s.label, marginTop: 10 }}>Risk mitigations</Text>
        {(draft.risks?.mitigations ?? []).map((m, i) => (
          <View key={i} style={s.bullet}>
            <Text style={s.bulletDot}>•</Text>
            <Text style={{ ...s.body, flex: 1 }}>
              <Text style={{ fontFamily: "Helvetica-Bold" }}>{m.risk}</Text> — {m.mitigation}
            </Text>
            {m.source && <Chip>{m.source}</Chip>}
          </View>
        ))}

        <View style={{ marginTop: 18, borderTopWidth: 0.75, borderTopColor: palette.line, paddingTop: 10 }}>
          <Text style={s.label}>Sources used</Text>
          <View style={s.row}>
            {(draft.sources_used ?? []).map((src, i) => (
              <Chip key={i}>{src}</Chip>
            ))}
          </View>
          <Text style={{ ...s.label, marginTop: 10 }}>Open questions for partner</Text>
          <BulletList items={(draft.open_questions_for_partner ?? []).map((q) => ({ text: q }))} />
        </View>
      </Page>
    </Document>
  );
}
