"use client";

import type { VoteMeta, VoteResult } from "@swiss-now/core";
import { formatDate, formatNumber } from "@/lib/format";
import { useT } from "@/lib/i18n/lang";

/**
 * The recent federal votes as a menu (MAP mode of POLITICS): pick one and the municipalities
 * recolour; TIMELINE keeps the scrubber for the same choice.
 */
export function VoteMenu({
  votes,
  selectedId,
  vote,
  onChange,
}: {
  votes: VoteMeta[];
  selectedId: string;
  vote: VoteResult | undefined;
  onChange: (id: string) => void;
}) {
  const { t, l, lang } = useT();
  const yes = vote?.national.yesPct;
  const accepted = vote?.meta.national?.accepted;
  return (
    <>
      <div className="instrument instrument--top vote-menu">
        <label className="vote-menu__field">
          <span className="label">{t("vote")}</span>
          <select
            className="vote-menu__select"
            value={selectedId}
            onChange={(e) => onChange(e.target.value)}
          >
            {votes.map((v) => (
              <option key={v.id} value={v.id}>
                {formatDate(v.date, lang)} · {l(v.title)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {yes !== undefined && yes !== null ? (
        <div className="instrument instrument--top instrument--top-2 vote-menu__result tnum">
          <strong>{formatNumber(yes, 1)} %</strong> {t("yes")}
          {accepted !== undefined ? (
            <span className={`vote-menu__badge${accepted ? " vote-menu__badge--yes" : ""}`}>
              {accepted ? t("accepted") : t("rejected")}
            </span>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
