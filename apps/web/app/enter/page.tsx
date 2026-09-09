import { Wordmark } from "@/components/brand/Wordmark";
import { safeNext } from "@/lib/gate";

export const dynamic = "force-dynamic";

/** The password screen: the wordmark, one field, one button. No accounts. */
export default async function EnterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const next = safeNext(params.next);
  return (
    <main className="gate">
      <form className="gate__card" method="post" action="/api/enter">
        <Wordmark className="gate__mark" />
        <p className="gate__lead">A living map of Switzerland · Eine lebende Karte der Schweiz</p>
        <label className="gate__field">
          <span className="label">Password · Passwort</span>
          <input
            className="gate__input"
            type="password"
            name="password"
            autoComplete="current-password"
            autoFocus
            required
          />
        </label>
        <input type="hidden" name="next" value={next} />
        {params.error ? (
          <p className="gate__error" role="alert">
            That password is not right · Dieses Passwort stimmt nicht
          </p>
        ) : null}
        <button type="submit" className="gate__button">
          Enter · Eintreten
        </button>
      </form>
    </main>
  );
}
