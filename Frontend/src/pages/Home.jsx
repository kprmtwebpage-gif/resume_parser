import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import './KprmtHome.css'
import './Home.css'
import Preloader from './kprmtHome/Preloader'
import KprmtNavbar from './kprmtHome/KprmtNavbar'
import HeroSection from './kprmtHome/HeroSection'
import AboutSection from './kprmtHome/AboutSection'
import ServicesSection from './kprmtHome/ServicesSection'
import WorkingProcess from './kprmtHome/WorkingProcess'
import TeamSection from './kprmtHome/TeamSection'
import FaqSection from './kprmtHome/FaqSection'
import IndustryTabs from './kprmtHome/IndustryTabs'
import ContactSection from './kprmtHome/ContactSection'
import KprmtFooter from './kprmtHome/KprmtFooter'

export default function Home() {
  const location = useLocation()

  useEffect(() => {
    const preloader = document.getElementById('preloader')
    document.body.classList.add('body-wrapper', 'font-oswald', 'loading')

    const timer = setTimeout(() => {
      if (preloader) preloader.style.display = 'none'
      document.body.classList.remove('loading')
    }, 2500)

    return () => {
      clearTimeout(timer)
      document.body.classList.remove('body-wrapper', 'font-oswald', 'loading')
    }
  }, [])

  useEffect(() => {
    if (!location.hash) return

    const targetId = location.hash.replace('#', '')

    const scrollToTarget = () => {
      const target = document.getElementById(targetId)
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }

    const rafId = requestAnimationFrame(scrollToTarget)
    const timerId = setTimeout(scrollToTarget, 350)

    return () => {
      cancelAnimationFrame(rafId)
      clearTimeout(timerId)
    }
  }, [location.pathname, location.hash])

  const handleScrollUp = (e) => {
    e.preventDefault()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <>
      <Preloader />
      <div id="main-content">
        <KprmtNavbar />
        <HeroSection />
        <AboutSection />
        <ServicesSection />
        <WorkingProcess />
        <TeamSection />
        <FaqSection />
        <div style={{ backgroundColor: '#001659', height: '38px', width: '100%' }} />
        <IndustryTabs />
        <ContactSection />
        <KprmtFooter />
      </div>
      <a
        id="scrollUp"
        href="#top"
        onClick={handleScrollUp}
        style={{ position: 'fixed', zIndex: 2147483647 }}
      >
        <i className="fal fa-angle-up" />
      </a>
    </>
  )
}
