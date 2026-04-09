import { Link } from 'react-router-dom'

export default function KprmtNavbar() {
  return (
    <header className="header-wrap header-1 header-5 sticky" id="fix">
      <div className="container d-flex justify-content-between align-items-center p-0">
        <div className="logo">
          <a href="#home">
            <h1>KPRMT</h1>
          </a>
        </div>
        <div className="header-right-area d-flex">
          <div className="main-menu d-none d-xl-block">
            <ul>
              <li><a href="#home">Home</a></li>
              <li><a href="#about">About</a></li>
              <li><a href="#services">Services</a></li>
              <li><Link to="/job-search">Job Search</Link></li>
              <li><a href="#contact">Contact</a></li>
            </ul>
          </div>
          <div className="header-right-elements d-flex align-items-center justify-content-between">
            <div className="d-inline-block ms-4 d-xl-none sf-hidden" />
          </div>
        </div>
      </div>
    </header>
  )
}
