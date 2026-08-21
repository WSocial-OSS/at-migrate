import Wizard from '@/components/Wizard'

export const dynamic = 'force-dynamic'

export default function Page() {
  return (
    <main className="shell">
      <div className="masthead">
        <h1>Move your account</h1>
        <span className="tag">atproto</span>
      </div>
      <p className="lede">
        Take your handle, your posts and your followers from one server to another. Your account keeps the same
        identity the whole way, so the move is reversible — the same tool brings you back.
      </p>
      <Wizard />
      <p className="footnote">
        This runs the standard atproto account migration: your repository is exported, imported, and your identity
        record is re-pointed with a code only you can approve. Nothing is deleted from the server you leave.
      </p>
    </main>
  )
}
