import Wizard from '@/components/Wizard'
import { copy } from '@/lib/ui/copy'

export const dynamic = 'force-dynamic'

export default function Page() {
  return (
    <main className="shell">
      <div className="masthead">
        {/* Two files rather than one recoloured mark, matching how wsocial.news
            swaps its logo between themes. */}
        <img className="mark" data-theme="light" src="/logo/logo-LM.svg" alt="W" width={34} height={34} />
        <img className="mark" data-theme="dark" src="/logo/logo.svg" alt="W" width={34} height={34} />
        <h1>{copy.page.title}</h1>
        <span className="tag">atproto</span>
      </div>
      <p className="lede">{copy.page.lede}</p>
      <Wizard />
      <p className="footnote">{copy.page.footnote}</p>
    </main>
  )
}
