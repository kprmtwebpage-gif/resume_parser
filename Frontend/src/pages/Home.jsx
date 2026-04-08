import './Home.css'

export default function Home() {
  const basePath = import.meta.env.VITE_BASE_PATH || ''
  const iframeSrc = `${basePath}/kprmt-home.html`

  return (
    <div className="home-page-wrapper">
      <iframe
        src={iframeSrc}
        title="KPRMT - IT Consulting & Talent Solutions"
        allowFullScreen
      />
    </div>
  )
}
